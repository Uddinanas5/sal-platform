# BOOKING-EXCLUSION-CONSTRAINT-001 — DB-level exclusion constraint for staff time overlaps

**Priority:** P1
**Status:** Stub — follow-up to [[BOOKING-CONCURRENCY-001]], not started
**Owner:** Unassigned
**Depends on:** [[BOOKING-CONCURRENCY-001]] shipped first

---

## Why this exists

Once [[BOOKING-CONCURRENCY-001]] ships, double-booking is prevented at the application layer via `pg_advisory_xact_lock` on `(businessId, staffId)`. That works, but it's invisible to anyone reading the schema. The risk: a future refactor of `createPublicBooking` / `createAppointment` / `rescheduleAppointment` drops the lock line because the purpose isn't documented in the DB, and the race returns silently with no test coverage to catch it.

This spec moves the guarantee into the schema so the DB itself enforces "no two non-cancelled appointment-services for the same staff overlap in time." Application code can't bypass it, refactors can't accidentally drop it.

## Approach

PostgreSQL `EXCLUDE` constraint using `btree_gist` extension on a `tstzrange` of the appointment-service's `[startTime, endTime)`.

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "AppointmentService"
  ADD COLUMN time_range tstzrange
    GENERATED ALWAYS AS (tstzrange("startTime", "endTime", '[)')) STORED;

ALTER TABLE "AppointmentService"
  ADD CONSTRAINT appointment_service_no_staff_overlap
  EXCLUDE USING gist (
    "staffId"  WITH =,
    time_range WITH &&
  ) WHERE (
    -- Only enforce on non-cancelled appointments; need a partial index condition
    -- on the joined Appointment.status column, which means materializing status
    -- onto AppointmentService OR using a trigger. See "Design questions" below.
  );
```

## Design questions to resolve before starting

1. **Status visibility.** The exclusion needs to ignore `cancelled` and `no_show` appointments. `AppointmentService` doesn't carry status — it lives on `Appointment`. Options:
   - (a) Denormalize `appointment_status` onto `AppointmentService` via trigger; the partial constraint references it directly. Adds write overhead but cleanest read.
   - (b) Use a trigger-based check instead of `EXCLUDE` — loses some of the DB-enforced guarantee since triggers can be disabled.
   - (c) Soft-delete cancelled appointment-services (set `staffId = NULL` or move to history table) — invasive.
   - Lean: (a). Trigger fires on `Appointment.status` update to sync to all child `AppointmentService` rows.

2. **Migration on existing data.** If any historical overlap already exists in production (which we should expect from the bug we just fixed), the `ALTER TABLE ... ADD CONSTRAINT` will fail. Need a pre-migration audit + cleanup pass.

3. **Generated column vs trigger-maintained.** `GENERATED ALWAYS AS ... STORED` is cleanest but means `startTime`/`endTime` updates rewrite the row. Probably fine — these rarely change after creation.

## Acceptance criteria (high-level — refine before starting)

- [ ] `btree_gist` extension enabled in a Prisma migration
- [ ] `AppointmentService` carries enough state (denormalized status or generated column) to support a partial exclusion constraint
- [ ] Exclusion constraint rejects overlap inserts for non-cancelled appointments on the same staff
- [ ] All existing data passes pre-migration overlap audit (script needed to find + report any current duplicates)
- [ ] Application-layer advisory lock from [[BOOKING-CONCURRENCY-001]] remains in place as defense-in-depth (do not remove)
- [ ] Reschedules and cancellations work without tripping the constraint
- [ ] New constraint violations surface as a clean `CONFLICT` error to the caller, not a raw Postgres error string

## Effort estimate

Larger than the advisory lock. Migration design + production data audit + Prisma migration that includes raw SQL for the exclusion + trigger work for status denormalization + thorough test of edge cases (back-to-back appointments where `endTime` of one equals `startTime` of next must NOT conflict — that's why the range is `[)` not `[]`).

Best done as a dedicated PR, not bundled with anything else.
