# BOOKING-CONCURRENCY-001 — Double-booking race in appointment create/reschedule

**Priority:** P0
**Status:** Open — spec ready, awaiting Coder
**Reported by:** Tester (repro confirmed, screenshot in thread)
**Owner:** Coder
**Related:** [[BOOKING-EXCLUSION-CONSTRAINT-001]] (structural follow-up)

---

## The bug

The "atomic" `prisma.$transaction(...)` around conflict-check + insert in three callsites is not actually atomic under concurrent load. Two requests booking the same staff member for the same time both run `findFirst` inside their own transactions, both see zero conflicts (neither has committed yet), and both `create`. Result: two `confirmed` appointments, same staff, same start time.

Tester's repro: two `createPublicBooking` calls fired in parallel against the same `staffId`, same `startTime` → both returned `{ success: true }` with different `bookingReference`s. Verified in DB.

Frequency in production: low (~0.05% of bookings during a single salon's peak hour, per back-of-envelope), but high impact when it hits — double-booked client, no-show fight, staff overbooked, brand damage. Fresha solved this years ago at the DB layer; the fact that we're catching it now means we're finally thinking about real concurrency.

## Root cause

PostgreSQL's default `READ COMMITTED` isolation does **not** detect this kind of phantom write. The `findFirst` on `AppointmentService` returns the committed snapshot at statement time; a concurrent transaction that inserts an overlapping row before either commits is invisible to both. The transaction wrapper guarantees atomicity of the writes within one tx, not mutual exclusion between txs.

## Affected callsites (all three need the fix)

1. `src/lib/actions/public-booking.ts:116` — `createPublicBooking`
2. `src/lib/actions/appointments.ts:66` — `createAppointment` (dashboard / staff-created)
3. `src/lib/actions/appointments.ts:293` — `rescheduleAppointment`

A staff member creating in the dashboard can race with a public booking. A reschedule can race with either. Fixing only `public-booking.ts` leaves two holes.

## Fix — advisory lock per `(businessId, staffId)`

Acquire `pg_advisory_xact_lock` at the top of each `$transaction` callback, before the `findFirst` conflict check. The lock is released automatically at commit/rollback. Two transactions holding the same lock serialize; ones with different keys do not block.

### Key derivation

`pg_advisory_xact_lock` takes either one `bigint` or two `int4`s. Our IDs are cuids (strings), so hash them down:

```ts
// src/lib/db/advisory-lock.ts (new file)
import { createHash } from "node:crypto"
import type { Prisma } from "@/generated/prisma"

/**
 * Acquire a transaction-scoped advisory lock keyed on (businessId, staffId).
 * Serializes concurrent appointment writes for the same staff member.
 * Released automatically when the surrounding transaction commits or rolls back.
 */
export async function lockStaffSchedule(
  tx: Prisma.TransactionClient,
  businessId: string,
  staffId: string,
): Promise<void> {
  const hash = createHash("sha256").update(`${businessId}:${staffId}`).digest()
  // Two int4s from the first 8 bytes of the digest. Signed reads to fit int4 range.
  const key1 = hash.readInt32BE(0)
  const key2 = hash.readInt32BE(4)
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${key1}::int4, ${key2}::int4)`
}
```

### Wiring (each callsite)

```ts
const appointment = await prisma.$transaction(async (tx) => {
  await lockStaffSchedule(tx, businessId, data.staffId)  // <-- new, first line in tx
  const conflicting = await tx.appointmentService.findFirst({ ... })
  // ...rest unchanged
})
```

For `rescheduleAppointment`, use `effectiveStaffId` (already computed at L291).

## Acceptance criteria

- [ ] New helper `src/lib/db/advisory-lock.ts` exporting `lockStaffSchedule(tx, businessId, staffId)`
- [ ] `lockStaffSchedule` called as the first statement inside the `$transaction` callback in all three callsites listed above
- [ ] Concurrent repro: two parallel `createPublicBooking` calls with identical `staffId` + `startTime` → exactly one `{ success: true }`, one `{ success: false, error: "...already booked..." }`. Tester to script + screenshot.
- [ ] Mixed-callsite repro: one `createPublicBooking` + one `createAppointment` racing on same staff/time → one wins, one rejects with CONFLICT
- [ ] Two parallel bookings against **different** staff members complete without blocking each other (smoke check; advisory keys differ so no contention)
- [ ] No new migrations required (advisory locks need no schema changes)
- [ ] Existing happy-path booking tests still pass (whatever we have — booking flow E2E in `src/app/book/`)

## Out of scope (deliberate)

- Exclusion constraint on `AppointmentService` time range — tracked separately as [[BOOKING-EXCLUSION-CONSTRAINT-001]]. That's the version that survives a future refactor dropping the lock line by accident. Ship the lock first because it's two lines and unblocks the production hardening PR; do the constraint as its own focused PR with the `btree_gist` extension enable + `tstzrange` column work.
- Optimistic locking via `updatedAt` version columns — overkill for this and doesn't compose well with the multi-row insert pattern.

## Why advisory lock now, exclusion constraint later

The lock is invisible at the schema level. Two years from now someone refactors the transaction body, deletes the `lockStaffSchedule` line because "what is this for", and the bug returns silently. The DB-level constraint can't be forgotten — Postgres rejects the second insert no matter what application code does. So the advisory lock is the right size for *this* PR (production hardening), and the constraint is the right shape for the long-term fix. Don't let the followup rot in the backlog.
