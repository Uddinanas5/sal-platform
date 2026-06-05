# BOOKING-CONCURRENCY-003 — Cancel races reschedule, can produce false-positive CONFLICTs

**Priority:** P3
**Status:** Open — spec ready, defer until [[BOOKING-CONCURRENCY-001]] lock port lands
**Reported by:** Tester (noted in thread while reviewing the PATCH `?action=reschedule` path)
**Owner:** Coder (per "file it as 003 after we land the lock port and I'll grab it next")
**Related:** [[BOOKING-CONCURRENCY-001]], [[BOOKING-EXCLUSION-CONSTRAINT-001]]

---

## The bug

Cancel is a **soft-delete** — it updates `appointment.status` to `"cancelled"` and stamps `cancelledAt`, but leaves the `AppointmentService` row(s) in place. The reschedule conflict check filters by `appointment.status notIn ["cancelled", "no_show"]`, so functional correctness depends on the cancel being visible at the moment the reschedule's `findFirst` snapshot-reads.

Cancel paths do **not** acquire `lockStaffSchedule`. Reschedule paths do (after [[BOOKING-CONCURRENCY-001]] lands). So a cancel-of-X and a reschedule-of-Y-into-X's-slot can interleave:

1. T0: User A clicks "Cancel" on appointment X (staff S, 14:00). `UPDATE appointment SET status='cancelled'` begins.
2. T0+1ms: User B drags appointment Y onto staff S at 14:00. Reschedule acquires `lockStaffSchedule(businessId, S)`, runs `findFirst` for conflicts.
3. If User A's cancel hasn't committed yet, User B's snapshot sees X as `"confirmed"` and rejects the reschedule with `"This time slot is already booked…"`.
4. User A's cancel commits a millisecond later. The slot is now free, but User B already got the error toast.

Not a data-corruption bug — no double-booking results. It's a **false-positive conflict**: the user retries the drag and it works the second time. Annoying, looks flaky, surfaces in busy salons where cancellations and rebookings happen in the same minute. P3 because the user retry recovers automatically; bumping to P2 if Anas hears it from a real customer.

## Affected callsites

All paths that mutate `appointment.status` to `"cancelled"` or `"no_show"` without acquiring the staff schedule lock:

1. `src/app/api/v1/appointments/[id]/route.ts:120` — `DELETE /api/v1/appointments/:id` (soft cancel)
2. `src/app/api/v1/appointments/[id]/route.ts:99` — `PATCH /api/v1/appointments/:id` default branch (status updates including cancel/no-show)
3. `src/lib/actions/appointments.ts:~205` — `updateAppointmentStatus` (dashboard action; covers cancel + no-show + complete)
4. `src/lib/mcp/tools/appointments.ts` — any tool that sets status to cancelled/no_show (grep `appointment.update.*status` to enumerate; expect 1–2 sites)

`"no_show"` matters too: same filter, same race shape — user marks X as no-show, concurrent reschedule onto X's slot sees the stale `"confirmed"` row.

## Fix

Wrap each cancel/no-show write in a `$transaction` and call `lockStaffSchedule(tx, businessId, staffId)` **before** the update. The lock key is `(businessId, staffId)` of the appointment being cancelled — same key the reschedule path uses, so the two serialize.

```ts
// Inside DELETE / updateAppointmentStatus when status ∈ {cancelled, no_show}
const appt = await prisma.appointment.findFirst({
  where: { id, businessId: ctx.businessId },
  include: { services: { select: { staffId: true } } },
})
if (!appt) return ERRORS.NOT_FOUND("Appointment")

await prisma.$transaction(async (tx) => {
  // Lock every distinct staffId on this appointment, sorted ascending,
  // before any write. Matches the multi-staff rule in [[BOOKING-CONCURRENCY-001]].
  const staffIds = Array.from(new Set(appt.services.map(s => s.staffId))).sort()
  for (const sid of staffIds) {
    await lockStaffSchedule(tx, ctx.businessId, sid)
  }
  await tx.appointment.update({
    where: { id, businessId: ctx.businessId },
    data: { status: "cancelled", cancelledAt: new Date() },
  })
})
```

For non-cancel status transitions (`checked_in`, `in_progress`, `completed`), skipping the lock is fine — those don't change slot availability, so they can't race with a reschedule.

## Acceptance criteria

- [ ] All four callsites above acquire `lockStaffSchedule` for each distinct `staffId` on the appointment (sorted ascending) before writing, **only when** the target status is `"cancelled"` or `"no_show"`
- [ ] Repro: fire `DELETE /api/v1/appointments/:id` and `PATCH /api/v1/appointments/:otherId?action=reschedule` (target = the cancelled appt's slot) in parallel, 10× in a row. Before fix: ≥1 false-positive CONFLICT response. After fix: 0 false positives, reschedule always succeeds once cancel commits.
- [ ] Cancel of an appointment for staff A does not block a reschedule for staff B (different lock keys; smoke check)
- [ ] Status transitions other than cancel/no-show do **not** acquire the lock (avoid unnecessary contention on the staff key for completed/checked-in updates)

## Out of scope

- Hard-deleting `AppointmentService` rows on cancel — that'd make the conflict check status-independent and side-step this whole race, but it loses audit trail and breaks any "show cancelled appointments" view. Not worth the cleanup blast radius for a P3.
- The structural fix is [[BOOKING-EXCLUSION-CONSTRAINT-001]] — a partial exclusion index that excludes cancelled rows would make this race impossible at the DB level. When that lands, this spec becomes obsolete and can be closed without porting the lock.

## Why this is its own spec, not folded into 001

001 is "two writes both succeed when only one should" — a correctness bug, P0. 003 is "one legitimate write gets a spurious error" — a UX bug, P3. Different blast radius, different urgency, different test shape. Keeping them separate so 001 can ship clean on the hardening branch and 003 can wait for a calmer week.
