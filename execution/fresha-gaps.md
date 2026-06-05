# Fresha Feature Gaps

Spec format: Fresha behavior → SAL today → Gap → Spec (files + acceptance criteria) → Priority.

One entry per gap. Grep before adding to avoid duplicates.

---

## GAP-001 — Structured cancellation reasons (who cancelled + why)

**Fresha behavior**
A cancelled appointment records *two* things separately: a categorical "who initiated" field (Client / Business / No-show) and an optional reason note. The client-app cancel flow stamps `client_initiated`; the staff calendar cancel flow stamps `business_initiated` and forces a reason picker (Staff sick / Double-booked / Other → free text). No-shows are a third terminal state, not a flavor of cancel. Downstream:
- The no-show fee policy only fires on `no_show` and `client_initiated` within the cancellation window — never on `business_initiated`.
- The client retention report ("at-risk clients") counts client-initiated cancels against the client; business-initiated cancels do not.
- The calendar visually distinguishes the three (red strikethrough, grey strikethrough, dashed outline).
- The "rebooking" prompt in the client profile fires after a business-initiated cancel ("we need to reschedule Maria") but stays quiet after a client-initiated one.

**SAL today**
- `AppointmentStatus` enum collapses both flavors into a single `cancelled` value (`prisma/schema.prisma:76`).
- `Appointment.cancellationReason` is a free-text `String?` (`prisma/schema.prisma:715`); no enum, no required-on-staff-cancel rule.
- `Appointment.cancelledBy` is a `User?` FK (`prisma/schema.prisma:716, 744`) — only resolvable to a staff user, structurally cannot represent "client cancelled via the public manage link."
- The public manage-link cancel path (`src/lib/actions/public-booking.ts:362-368`) writes neither `cancellationReason` nor `cancelledBy` — every client self-cancel is indistinguishable from a stale staff cancel.
- The v1 DELETE cancel (`src/app/api/bookings/[id]/route.ts:265-302`) accepts `cancelledBy` from a query param with no validation; the dashboard status action (`src/lib/actions/appointments.ts:~205`) doesn't prompt for reason at all.
- Reports (`src/lib/queries/reports.ts`) treat all cancelled rows uniformly — at-risk client logic, if it ever lands, will misattribute business-cancels to clients.

**Gap**
SAL cannot answer "was this the client's fault or ours?" — which is the load-bearing question for (1) the no-show fee policy spec, (2) any client-retention report, (3) any client-loyalty / VIP logic that should be forgiving of business-cancels.

**Spec**

Schema (`prisma/schema.prisma`):
- Add enum `CancellationInitiator { client, business, system }`. (`system` = auto-cancelled by a future expiry job; out of scope to implement now but reserve the enum slot.)
- Add enum `CancellationReasonCode { client_schedule_conflict, client_illness, client_other, business_staff_unavailable, business_overbooked, business_other, no_show }` — note `no_show` is included so the same picker drives the no-show-marking flow.
- Replace `Appointment.cancellationReason String?` with: `cancellationInitiator CancellationInitiator?`, `cancellationReasonCode CancellationReasonCode?`, `cancellationReasonNote String?` (kept as the free-text rider). Keep `cancelledBy User?` for staff-cancel audit, allow null for client-initiated.
- Backfill migration: existing `cancelled` rows → `cancellationInitiator = business`, `cancellationReasonCode = business_other`, copy old `cancellationReason` text into `cancellationReasonNote`. Existing `no_show` rows → `cancellationInitiator = client`, `cancellationReasonCode = no_show`.

Actions / routes:
- `src/lib/actions/public-booking.ts` `cancelPublicBooking` — set `cancellationInitiator = client`, `cancellationReasonCode = client_other` by default, accept optional `reasonCode` + `note` params from the manage page form.
- `src/lib/actions/appointments.ts` `updateAppointmentStatus` cancel branch — require `reasonCode` when status transitions to `cancelled` from a staff context; default `cancellationInitiator = business`, stamp `cancelledBy = session.userId`.
- `src/app/api/v1/appointments/[id]/route.ts` DELETE — accept `initiator` + `reasonCode` in body/query; reject if `initiator=business` but no auth'd user.
- `src/lib/mcp/tools/appointments.ts` cancel tool — add `reasonCode` + `note` params, default initiator from the calling auth context (API key = business, never client).

UI:
- `src/app/book/manage/[bookingReference]/client.tsx` cancel dialog — add reason picker (3 client_* options) before confirm; "Other" reveals note textarea.
- Calendar cancel modal (dashboard) — required reason picker (3 business_* + optional note).
- Calendar event styling — distinct visual treatment for client-cancelled (red strikethrough), business-cancelled (grey strikethrough), no-show (dashed outline). Adds a legend item.
- Appointment detail drawer — show initiator + reason on cancelled appointments with an icon.

Reports:
- `src/lib/queries/reports.ts` — revenue stats stay unchanged (still count all cancelled correctly). Add a `cancellationBreakdown` query: counts by initiator × reasonCode for a date range. Surface in a new "Cancellations" card on the reports page.

Acceptance criteria:
1. Client cancels via public manage link → row has `initiator=client`, `cancelledBy=null`, `reasonCode` set, no toast/email difference for the client.
2. Staff cancels via calendar → cancel modal blocks confirm until `reasonCode` is picked; row has `initiator=business`, `cancelledBy=session.userId`.
3. Existing cancelled appointments still render correctly after migration (no null-reference crashes on the detail drawer).
4. Calendar visually distinguishes all three cancel flavors at a glance, with a legend.
5. New "Cancellations" reports card shows `client_initiated / business_initiated / no_show` totals for the selected period with an export button.
6. No-show fee policy spec (future) can reference `cancellationReasonCode IN (client_*, no_show)` as the trigger predicate — i.e. the data model supports the eventual policy without further migration.

**Priority**: P2

**Why not higher**: No active feature today (no-show fee, retention report) is broken by the current model — it's a data-modeling gap that *will* block those features when they're scoped. Worth landing before either of those starts so the migration doesn't have to backfill twice.

**Why not lower**: Touching `AppointmentStatus` / cancel paths later — after the no-show-fee flow ships on the current single-enum model — would be a much messier rip-up. Cheaper now.

**Related**
- [[BOOKING-CONCURRENCY-003]] — the cancel/reschedule race uses the same cancel surfaces; coordinating the lock + schema change in adjacent PRs avoids touching the same files twice.
- Pending: no-show fee policy (not yet specced).
- Pending: at-risk client / retention report (not yet specced).

---

## GAP-002 — Recurring appointments: edit-modes, modified-instance tracking, expressive rules

**Fresha behavior**
Recurring appointments in Fresha are a proper first-class concept, not just N pre-materialized rows. The interesting bits:

1. **Rule expressiveness**: Repeat dropdown offers Daily / Weekly / Every 2 weeks / Every 4 weeks / Monthly (same day of month) / Monthly (same weekday-ordinal, e.g. "2nd Tuesday") / Custom. Termination is either an end date *or* a number of occurrences ("12 times"). The series stores the rule once; instances are generated against it.

2. **Three edit modes**: When you open an instance and change something (time, staff, service, notes), Fresha asks "this appointment only" / "this and following" / "all in series". 
   - *This only* → marks that instance as `modified_from_series = true` and detaches the changed fields from the template.
   - *This and following* → splits the series at this date: original series ends at `instance.start_time - 1`, a new series is created from this instance onward with the new fields.
   - *All in series* → rewrites the template; existing modified instances are *not* clobbered by default — see (3).

3. **The "apply to modified instances too?" prompt** (this is the detail I got nerd-sniped on): when you edit the whole series, Fresha checks if any future instances have `modified_from_series = true` and asks "Apply these changes to modified appointments as well?" with a list of which ones are modified and how. The default is *No* — your earlier per-instance tweaks are preserved. This is meaningfully better than Google Calendar's silent-orphan model, where editing the series after modifying an instance just leaves the modified one as an island with no way to find it later.

4. **Staff-leave edge case**: When the assigned staff member is on approved leave during a future instance's start time, Fresha doesn't auto-cancel and doesn't auto-reassign — both are wrong defaults. Instead it surfaces those instances in a "Needs reassignment" filter on the calendar sidebar, with a count badge. The business owner reassigns or cancels manually. The instances stay `confirmed` in the DB so they still hold the slot.

5. **Calendar surfacing**: Every recurring occurrence shows a small "↻" icon in the calendar cell. The appointment detail drawer has a "View series" link that opens a side panel listing all occurrences (past + future) with their status, so you can see at a glance "Maria, weekly, 12 of 26 completed, 1 modified, 0 cancelled."

**SAL today**
- Schema has `recurrenceRule String?`, `recurrenceEndDate Date?`, `seriesId Uuid?`, `parentAppointmentId Uuid?` on `Appointment` (`prisma/schema.prisma:730-734, 750-751`). No standalone `RecurringSeries` model — the rule is denormalized onto every row in the series, and `parentAppointmentId` points at the first occurrence, which is brittle (if the parent is deleted, the rest of the series has a dangling FK; FK is `ON DELETE` default = `RESTRICT`, so the deletion silently fails).
- `createRecurringAppointment` (`src/lib/actions/recurring.ts:32-144`) materializes every occurrence up front as a real `Appointment` row. Rules are limited to `"weekly" | "biweekly" | "monthly"` (`src/lib/actions/recurring.ts:19`). No daily, no every-N-weeks, no day-of-week-ordinal, no count-based termination. Hardcoded 52-occurrence safety cap (`src/lib/actions/recurring.ts:75`).
- Only one series-level mutation exists: `cancelRecurringSeries` (`src/lib/actions/recurring.ts:146-190`) which bulk-cancels with optional "from date" — no UI for editing the series, no "this and following" split, no per-instance modified flag.
- No `modifiedFromSeries` field; editing a single appointment via the normal update path silently makes it diverge from its siblings with no audit trail. From the DB you cannot tell which instances were touched.
- The create dialog (`src/components/calendar/new-appointment-dialog.tsx`) has a recurrence section but I haven't traced the full UI flow yet — at minimum it doesn't surface the edit-mode dialog because the actions don't exist.
- v1 routes exist at `src/app/api/v1/appointments/recurring/route.ts` and `.../[seriesId]/route.ts` but mirror the same limited shape.
- No "needs reassignment" filter; no staff-leave check at series-creation or staff-leave-approval time. If a stylist goes on leave, their future recurring appointments just sit there as ticking time bombs.
- No calendar visual indicator for "this is part of a series" — recurring occurrences render identically to one-offs.

**Gap**
SAL can *create* a recurring series and *cancel* it. It cannot edit one without orphaning, cannot edit "this and following," cannot tell you which instances diverged from the template, cannot survive the staff-leave case, and cannot express the recurrence patterns most salon use cases actually want (every-3-weeks color refresh, every-2nd-Tuesday standing appointment, "10 sessions then done" for a package). This is the #1 most-requested calendar feature in the salon vertical and the current implementation is a demo, not a product.

**Spec**

Schema (`prisma/schema.prisma`):
- New model `RecurringSeries`:
  - `id Uuid pk`
  - `businessId Uuid fk → Business`
  - `clientId Uuid fk → Client`
  - `templateServiceId Uuid fk → Service` (the default service; instances may diverge)
  - `templateStaffId Uuid fk → Staff` (same)
  - `templateDurationMinutes Int`
  - `templateStartTimeOfDay String` (e.g. "14:30" — local, not UTC, since DST matters across a year of weekly appointments)
  - `templateTimezone String` (IANA, e.g. "Europe/London")
  - `recurrenceFreq RecurrenceFreq` (new enum: `daily | weekly | monthly_by_date | monthly_by_weekday`)
  - `recurrenceInterval Int @default(1)` (every N units)
  - `recurrenceByWeekday Int[]?` (for weekly: 0=Sun..6=Sat; null = "same weekday as start")
  - `recurrenceCount Int?` (terminate after N occurrences) — exactly one of count/endDate must be set
  - `recurrenceEndDate Date?`
  - `status SeriesStatus { active, ended, cancelled }`
  - `createdBy Uuid?`, timestamps
- On `Appointment`:
  - Replace `recurrenceRule`, `recurrenceEndDate`, `parentAppointmentId` with `recurringSeriesId Uuid? fk → RecurringSeries`. Keep `seriesId` as-is (now redundant — drop in same migration, but read both during transition).
  - Add `modifiedFromSeries Boolean @default(false)` — flips true the moment any field on this instance is updated to differ from the series template.
  - Add `seriesSequenceNumber Int?` — 1-indexed position in the series (1, 2, 3, …). Stable identifier for "view series" UI.
- Migration: existing recurring rows → create a `RecurringSeries` per unique `seriesId`, populate template from the first occurrence, point all instances at it. The 52-cap-materialization model continues to work — series just becomes a label + template, not a generator (for now; lazy materialization is a follow-up).

Actions / routes:
- `src/lib/actions/recurring.ts`:
  - Rewrite `createRecurringAppointment` to create a `RecurringSeries` row, then materialize occurrences against it. Expand rule input to match the new schema. Validate exactly-one-of count/endDate. Cap at 104 occurrences (2 years weekly) — make configurable later.
  - New: `updateAppointmentWithMode(appointmentId, changes, mode: 'this_only' | 'this_and_following' | 'all_in_series', applyToModified?: boolean)`.
    - `this_only` → update instance fields, set `modifiedFromSeries=true`.
    - `this_and_following` → end original series at this instance's `startTime - 1ms`, create new `RecurringSeries` from this instance onward with the changed template, re-point future instances.
    - `all_in_series` → update template; if `applyToModified=true`, also update modified instances; otherwise leave them alone.
  - New: `getSeriesModifiedInstances(seriesId)` → returns list of `{ appointmentId, sequenceNumber, startTime, modifiedFields[] }` so the UI can show "these will be skipped unless you opt in."
  - New: `splitSeriesAt(seriesId, atAppointmentId)` — helper for `this_and_following`.
- `src/lib/actions/staff-leave.ts` (or wherever leave approval lives): on leave approval, query future `Appointment` rows where assigned staff = the on-leave staff and `recurringSeriesId IS NOT NULL`, flag them via a new `Appointment.needsReassignment Boolean @default(false)`. Same on series creation: refuse to materialize occurrences that land inside an approved leave window — surface them in `needsReassignment` instead.

UI:
- Calendar cell — render "↻" icon for any appointment with `recurringSeriesId IS NOT NULL`. Hover tooltip: "Part of weekly series, 12 of 26."
- Appointment detail drawer — new "Series" section: link to "View series" panel; if `modifiedFromSeries=true`, show "Modified from series" badge with a "revert to series default" action.
- Edit appointment modal — when the appointment has `recurringSeriesId`, before submit, show the 3-mode picker ("this only" / "this and following" / "all in series"). If user picks "all in series" and `getSeriesModifiedInstances` returns any rows, show a secondary prompt: "X future instances were modified. Apply this change to them too?" with a list and default-No.
- New calendar sidebar filter: "Needs reassignment" with count badge, lists future appointments where `needsReassignment = true`.
- Series detail panel — table of all occurrences with status, modified-flag, and a "Skip this date" action (creates a cancelled instance with `cancellationReasonCode = business_other` — depends on [[GAP-001]]).

Acceptance criteria:
1. Creating a series with `recurrenceFreq=weekly, interval=3, count=10` produces exactly 10 appointments at 3-week intervals, all linked to one `RecurringSeries` row.
2. Editing one instance's start time with mode=`this_only` sets `modifiedFromSeries=true` and does not touch siblings.
3. Editing the series with mode=`all_in_series` and `applyToModified=false` skips the modified instance; with `applyToModified=true` it overwrites it. UI shows the prompt only when modified instances exist.
4. Editing with `this_and_following` from instance #5 of 10 leaves instances 1-4 on the original series (status=ended at instance #5's start time) and 5-10 on a new series with the new template.
5. Approving a staff leave that overlaps 3 future series instances marks those 3 as `needsReassignment=true`; they appear in the sidebar filter and the calendar surfaces a yellow border. Reassigning the staff clears the flag.
6. Existing recurring appointments (created under the old schema) render correctly post-migration and can be edited with all three modes.
7. The legacy single `cancelRecurringSeries` action still works (back-compat for the v1 API consumers) — it becomes a thin wrapper that updates `RecurringSeries.status=cancelled` and bulk-cancels future instances.

**Priority**: P1

**Why P1, not P0**: The current implementation works for the happy path (create a weekly series, never edit it, eventually cancel). It's not actively broken in prod — it's threadbare. P0 is "Maria cannot cancel her appointment and is on hold with the salon" tier; this is "the salon owner gives up on the recurring feature and books each instance manually because editing it always destroys her schedule."

**Why P1, not P2**: Recurring appointments are how salons keep their best clients on the books. Standing weekly blowout, monthly cut, every-3-week color refresh — this is the loyalty backbone of the business. Shipping a calendar product with a half-built recurring feature is a credibility hit at demo time. Also, the schema rework gets *much* more expensive once we have real customer data with the current flat shape.

**Sequencing**
- Block on [[BOOKING-CONCURRENCY-003]] landing first — the cancel/reschedule lock work touches the same `updateAppointment` path that `updateAppointmentWithMode` will call, and I'd rather not merge-conflict ourselves.
- After [[GAP-001]] lands (cancellation initiator/reason), the "Skip this date" action in the series panel can use the proper `business_other` reason code without a placeholder.
- Lazy materialization (generate occurrences on-demand for a date range view instead of all up front) is a P3 follow-up — fine to keep the eager-materialize model for the v1 of this gap, just raise the cap.

**Related**
- [[GAP-001]] — series cancel paths need the new cancellation initiator/reason fields.
- [[BOOKING-CONCURRENCY-003]] — shared cancel/reschedule lock surface.
- Pending: lazy occurrence materialization for long-running series (not yet specced).
- Pending: package/membership model ("10 sessions then done") — the `recurrenceCount` field lays groundwork but the billing side is separate.

---

## GAP-003 — Mid-day blocks: recurring breaks, one-off time-blocks, and the calendar visual layer

**Fresha behavior**
Fresha treats "the calendar slot is unbookable" as a first-class, *visible* concept distinct from "no appointment here yet." Three primitives:

1. **Recurring breaks** live on the staff's weekly schedule template. Lunch every weekday 12:00-13:00, gym Wednesdays 17:00-18:00. Set once, repeats forever.
2. **One-off time blocks** attach to a specific date+time, no recurrence. "Out 14:00-15:30 today for the dentist." Salon owner drag-creates them on the day grid in 3 seconds. No approval flow, no multi-day shape.
3. **Time off / leave** is multi-day (or full-day), goes through approval, has a reason category (vacation/sick/personal), and shows up in reports.

All three render visually on the calendar as **diagonal-striped grey blocks**, distinguishable by icon: coffee for recurring break, lock for one-off block, airplane for approved time-off. Hours outside the staff's working window render as a muted grey background. The result: staff scrolling the day instantly sees what's bookable vs not, without trying to book.

The drag-to-create gesture is the small detail Fresha got right: dragging across an empty slot pops a 3-option menu on release — "Book appointment" / "Block this time" / "Add break to schedule." Same gesture, three intents, picker chooses persistence layer. Blocks are then movable/resizable like appointments, with a hover tooltip showing the reason text.

**SAL today**
- `StaffBreak` model exists (`prisma/schema.prisma:484-497`), attached to `StaffSchedule` (recurring weekly only — startTime/endTime are `@db.Time`, no date).
- Availability engine respects breaks: `src/lib/availability.ts:51-73` fetches the schedule with `include: { breaks: true }`, lines 219-224 add them to `blockedRanges`. Booking is correctly refused inside a break.
- Staff schedule UI collects break input: `src/components/staff/staff-schedule-tab.tsx:31` tracks `breakStart`, `breakEnd`, `hasBreak` per day; Coffee button toggles, time pickers set range.
- **BUT** `updateStaffSchedule` (`src/lib/actions/staff.ts:10-97`) — its zod schema (lines 10-18) only accepts `{ dayOfWeek, startTime, endTime, isWorking }`. No break fields. The create loop (lines 72-86) writes the schedule but never touches `StaffBreak`. UI collects breaks, save discards them silently, reload resets to defaults. The Coffee toggle is a UI ghost.
- `StaffTimeOff` (`prisma/schema.prisma:499-521`) covers multi-day leave properly — date range, optional partial-day times, approval status, type enum (vacation/sick/personal/other). UI: `src/components/staff/staff-timeoff-tab.tsx`, action: `requestTimeOff` in `src/lib/actions/staff.ts:99-134`. Availability engine respects it (`availability.ts:134-148, 227-232`).
- **No model for one-off ad-hoc blocks.** Today the only way for "block 14:00-15:30 just today" is to file a partial-day `StaffTimeOff` request with `type: other` and wait for approval. Wrong tool: approval-gated, multi-day shape, shows up in reports as "time off." A salon owner blocking 30 minutes for an errand shouldn't generate an approval workflow.
- **Calendar renders nothing.** `src/components/calendar/staff-column.tsx` has no rendering for breaks, time-off, or out-of-schedule hours. The booking engine quietly rejects bookings inside these ranges, but the calendar visually pretends they're empty. Staff scrolling the day cannot distinguish "free" from "blocked" without attempting to book.

**Gap**
Three concrete failures, increasing in severity:
1. **Silent data loss on break save.** UI collects, action drops. Worst-of-both-worlds half-implementation.
2. **No one-off block primitive.** Salon owner cannot say "out for an hour today" without misusing the time-off approval flow.
3. **Zero visual signal on the calendar.** Breaks, time-off, and out-of-schedule hours all render as empty cells. The calendar is lying about what's bookable.

**Spec**

Schema (`prisma/schema.prisma`):
- New model `TimeBlock`:
  - `id Uuid pk`
  - `staffId Uuid fk → Staff`
  - `locationId Uuid fk → Location`
  - `businessId Uuid fk → Business` (denormalized for query scoping)
  - `startTime DateTime @db.Timestamptz` (full timestamp — not just time-of-day, since this is date-specific)
  - `endTime DateTime @db.Timestamptz`
  - `blockType BlockType` (new enum: `break | personal | training | admin | other`)
  - `reason String?` (free-text, e.g. "Dentist", "Errand", "Inventory count")
  - `createdBy Uuid? fk → User` (audit)
  - `createdAt`, `updatedAt`
  - Indices: `(staffId, startTime)`, `(locationId, startTime)`, `(businessId, startTime)`
- No changes needed to `StaffBreak` or `StaffTimeOff` — they already model their concepts correctly.

Actions:
- Fix `src/lib/actions/staff.ts` `updateStaffSchedule`:
  - Extend zod schema to accept `breaks: { startTime: string, endTime: string }[]` per day item.
  - After `prisma.staffSchedule.create`, materialize breaks: `await prisma.staffBreak.createMany({ data: day.breaks.map(b => ({ staffScheduleId: created.id, startTime: new Date('2000-01-01T' + b.startTime + ':00'), endTime: new Date('2000-01-01T' + b.endTime + ':00') })) })`. The existing `deleteMany` on line 70 handles cleanup via cascade.
  - Update `src/components/staff/staff-schedule-tab.tsx` save handler to send the break fields it already has in state.
- New `src/lib/actions/time-blocks.ts`:
  - `createTimeBlock({ staffId, startTime, endTime, blockType, reason? })` — scoped via `getBusinessContext()`, validates the staff belongs to the business, checks no existing appointment overlaps (use the same lock as [[BOOKING-CONCURRENCY-003]]).
  - `updateTimeBlock(id, partial)` — partial updates for drag-to-resize.
  - `deleteTimeBlock(id)` — staff/admin only.
  - `listTimeBlocksForDay(staffId, date)` — used by both calendar render and availability check.
- Wire `src/lib/availability.ts`:
  - Add a 7th parallel query in the `Promise.all` (line 39): `prisma.timeBlock.findMany({ where: { staffId, startTime: { gte: startOfDay }, endTime: { lte: endOfDay } }, select: { startTime: true, endTime: true } })`.
  - Push results into `blockedRanges` alongside appointments and breaks (around line 217-224).
- Wire `src/lib/booking/availability.ts` (the lock surface from [[BOOKING-CONCURRENCY-003]]) to include `TimeBlock` overlap-check in the same row-locked transaction. A booking attempting to land on a `TimeBlock` must return `409 CONFLICT`, not just "no slots available" — the lock fast path needs to catch it.
- v1 API: new endpoints `POST/GET/PATCH/DELETE /api/v1/staff/[id]/time-blocks` mirroring the time-off shape. MCP tool: `create_time_block`, `delete_time_block`.

UI:
- `src/components/calendar/staff-column.tsx`:
  - Render hours outside `StaffSchedule.startTime..endTime` for the day as a muted grey background (no diagonal stripes — just "not on shift").
  - Render each `StaffBreak` for the day's `dayOfWeek` as a diagonal-striped light-grey block with a coffee icon and "Break" label.
  - Render each `TimeBlock` for the day as a diagonal-striped medium-grey block with a lock icon and the `reason` text (or `blockType` label if no reason).
  - Render approved `StaffTimeOff` with partial-day times as a diagonal-striped blue-grey block with an airplane icon. Full-day time-off greys the whole column with a centered "Off" label.
  - Click on any block opens an edit popover (delete/edit reason/resize); recurring breaks deep-link to the staff schedule tab instead of editing in place.
- New drag-create flow in `src/components/calendar/calendar.tsx` (or wherever drag-create lives):
  - On drag-release inside an empty cell, show a popover with 3 options: "Book appointment" (existing flow), "Block this time" (one-off, opens block dialog), "Add break to schedule" (deep-links to staff schedule tab with day+time pre-filled).
- New `src/components/calendar/time-block-dialog.tsx`:
  - Fields: reason (free-text), block type (radio: break/personal/training/admin/other), optional repeat-this-weekly checkbox (creates a `StaffBreak` instead if checked).
- Calendar legend addition: 4 patterns (appointment / break / time-block / time-off) with their visual treatments.

Acceptance criteria:
1. Setting a break in the staff schedule UI (Coffee toggle on, 12:00-13:00 Mon-Fri), clicking save, reloading the page → break fields are still populated. `prisma.staffBreak.count()` returns 5 rows. Booking that staff at 12:30 via the v1 API returns 400 CONFLICT.
2. Drag-creating a one-off block on today's calendar at 14:00-15:00 via the "Block this time" option creates a `TimeBlock` row. Booking the staff at 14:30 via the v1 API returns 400 CONFLICT. Deleting the block immediately re-opens the slot for booking.
3. Calendar renders four visually-distinguishable patterns at a glance: solid-colored appointments, light-grey-stripe breaks (coffee), medium-grey-stripe time-blocks (lock + reason), blue-grey-stripe partial-day time-off (airplane). Out-of-schedule hours are a muted background. A new calendar legend documents the patterns.
4. Public booking widget at `/book/[businessSlug]` cannot book a slot that overlaps any `StaffBreak`, `TimeBlock`, or approved `StaffTimeOff` — all three return "no available slots" from the availability endpoint.
5. The "repeat this weekly" checkbox in the time-block dialog routes to `StaffBreak` creation instead of `TimeBlock` — i.e. the dialog is the unified entry point for both primitives.
6. Existing `StaffTimeOff` rows render correctly on the calendar post-migration; no double-counting (an approved partial-day time-off does not also need a `TimeBlock` row).

**Priority**: P1

**Why P1, not P0**: Salons can operate today — the booking engine refuses overlapping bookings, so no double-booking results from this gap. Staff can train themselves to "check the calendar before promising a slot" and work around the invisible breaks. Not actively broken in the data-integrity sense.

**Why P1, not P2**: The break-save data-loss bug alone justifies P1 — a salon owner spending 10 minutes setting up the team's lunch schedule, hitting save, seeing a success toast, then reloading to find an empty form is the kind of "this product is broken" moment that kills trust on day one. Compounded with the missing calendar visual layer (where a calendar product *looks* threadbare next to Fresha at demo time), this is the single biggest "feels half-built" issue I've seen in the calendar surface so far.

**Sequencing**
- The break-save fix is *cheap and independent* — zod schema extension + a `createMany` after the schedule create, plus the UI sending fields it already has. Worth splitting off as a quick win that ships before the bigger TimeBlock work. Maybe 30 lines total.
- `TimeBlock` model + calendar visual layer should wait for [[BOOKING-CONCURRENCY-003]] to land so the lock surface picks up TimeBlocks from day one. Otherwise we'd ship a feature with a known race condition and have to revisit.
- The drag-create 3-option popover is a UI primitive [[GAP-002]] (recurring) and future flows would reuse — coordinate the component design.

**Related**
- [[BOOKING-CONCURRENCY-003]] — TimeBlock conflict-check must share the same row-locked surface as appointment booking.
- [[GAP-001]] — orthogonal; no overlap.
- [[GAP-002]] — shares calendar visual-layer work; recurring breaks and recurring appointments use adjacent rendering primitives.
- Pending: client-visible "closed for lunch 12-1" surfacing on the public booking widget (today the slots just disappear with no explanation — passable but not great UX).

---

## GAP-003 — Staff breaks (recurring) + ad-hoc time blocks, with calendar surfacing

**Fresha behavior**
Two distinct concepts, both first-class:

1. **Recurring breaks** live on the staff schedule. "Every Tuesday I take lunch 12:00–13:00." Configured once on the staff profile, applies to every Tuesday until edited. Shows on the calendar as a diagonal-striped lane in the staff column with the label ("Lunch"). The booking widget won't offer a slot that overlaps a break.

2. **Ad-hoc time blocks** are one-off, date-specific, owner- or staff-initiated. "I have to leave at 2pm today for the dentist." Created from the calendar itself by click-dragging in a staff column (same UX as creating an appointment, but with a "Block time" toggle). Optional label, optional reason. Shows on the calendar with the same diagonal-stripe pattern but in a slightly different color (or a small icon) to distinguish from a recurring break.

The visual language matters: Fresha uses diagonal stripes for both — meaning "unavailable forever," distinguished from gray (no appointment yet, still bookable) and from a colored block (appointment booked). A scheduler looking at the day knows at a glance: gray = pitch here, stripes = don't pitch, colored = already filled. This is the *whole reason* a hot calendar is more legible than a grid of empty cells.

There's also a subtle policy distinction: breaks are visible to staff in their own calendar but not visible to clients in the public booking widget (slots just don't appear), while blocks may carry a reason that's surfaced internally on the appointment-detail-style drawer. Neither type is bookable by clients.

**SAL today**
- Schema has `StaffBreak` (`prisma/schema.prisma:484-497`) — `staffScheduleId`, `startTime`, `endTime`, `isPaid`, `createdAt`. Recurring (via the schedule) but no name/label field.
- `getAvailability` (`src/lib/availability.ts:70-72, 219-224`) correctly fetches `staffSchedule.breaks` and adds them to `blockedRanges` so booking-widget slot generation already respects them. Engine works.
- **But — the input pipe is severed.** `StaffScheduleTab` (`src/components/staff/staff-schedule-tab.tsx:30-31, 57-59, 90-105, 239-297`) has a full Break editor: a per-day toggle, default times of 12:00–13:00, two `TimePicker`s, and even a visual gap rendered in the weekly hours overview bar. The owner thinks they're configuring a lunch break.
- The save path drops it on the floor. `handleSave` (`src/components/staff/staff-schedule-tab.tsx:108-124`) builds `scheduleData` from `dayOfWeek/startTime/endTime/isWorking` only — `hasBreak/breakStart/breakEnd` are never included. The server action `updateStaffSchedule` (`src/lib/actions/staff.ts:10-18, 41-97`) accepts the same four fields, deletes all `staffSchedule` rows, and recreates without touching the `staff_breaks` table. **A break configured in the UI is never persisted.** This is the bug part of the gap: the owner clicks Save, sees a success toast, and quietly gets booked over lunch.
- No `TimeBlock` (or similar) model exists. `StaffTimeOff` (`prisma/schema.prisma:499-521`) is the closest cousin but is a *request → approval* workflow with date ranges, designed for vacation/sick/personal — wrong shape for "I'm out for 90 minutes at 2pm today." No one-click create from the calendar, no drag-to-create.
- Calendar views (`src/components/calendar/{day,week,three-day,staff-column}.tsx`) render appointments only. No diagonal-stripe overlay for breaks; no rendering of `StaffBreak` at all even if rows exist; no entity type to render for ad-hoc blocks.

**Gap**
Three nested issues:
1. **Bug**: the schedule UI promises to save breaks but silently drops them. Pure regression / half-finished feature.
2. **Missing model**: no ad-hoc time block — the salon owner cannot say "block 2pm–3:30pm on Tuesday because I have a dentist appointment" without inventing a fake appointment with a fake client.
3. **Missing surfacing**: even if breaks/blocks existed in the DB, the calendar wouldn't show them — the booking widget would honor them (engine reads breaks), but the staff and owner looking at their day couldn't see *why* a slot was unavailable.

Together this is "the salon owner cannot make the calendar match reality." Which is the entire job of a calendar.

**Spec**

Schema (`prisma/schema.prisma`):
- Extend `StaffBreak`: add `label String? @db.VarChar(50)` (default "Break" in UI, configurable per row), `isPaid` stays. Already has FK cascade — fine.
- New model `TimeBlock`:
  - `id Uuid pk`
  - `businessId Uuid fk → Business` (for tenant scoping)
  - `staffId Uuid fk → Staff` (the staff column it lives in)
  - `locationId Uuid fk → Location`
  - `startTime DateTime` (full timestamp with date — *not* time-of-day like `StaffBreak`)
  - `endTime DateTime`
  - `label String? @db.VarChar(100)` (optional, e.g. "Dentist", "School run")
  - `reason String? @db.Text` (longer note, optional)
  - `createdBy Uuid? fk → User`
  - timestamps + `@@index([staffId, startTime])`
- Migration: add the new model, add the `label` column to `staff_breaks` (nullable, no backfill needed since rows are currently empty in prod).

Actions / routes:
- `src/lib/actions/staff.ts` `updateStaffSchedule`:
  - Widen the zod schema to accept `breaks: { startTime, endTime, label?, isPaid? }[]` per day, optional.
  - After creating the `staffSchedule` row, create the corresponding `staffBreak` rows in the same transaction. Keep "delete and recreate" semantics — fine here since breaks cascade.
- `src/components/staff/staff-schedule-tab.tsx` `handleSave`:
  - Include `hasBreak/breakStart/breakEnd` in the payload (only when `hasBreak=true && !isOff`).
  - Allow > 1 break per day in a follow-up (Fresha caps at 3). v1 of this gap: just persist the single break the UI already collects.
- New `src/lib/actions/time-blocks.ts`:
  - `createTimeBlock({ staffId, startTime, endTime, label?, reason? })` — scope by business, validate `endTime > startTime`, validate the staff exists in this business, return the row.
  - `updateTimeBlock(id, changes)`.
  - `deleteTimeBlock(id)`.
- `src/lib/availability.ts`:
  - Fetch `TimeBlock` rows for the day (alongside breaks/appointments/time-off) and add them to `blockedRanges`. Same shape, different source.
- v1 API: new `src/app/api/v1/time-blocks/{,[id]}/route.ts` mirroring the action shape.
- MCP: add `create_time_block` / `delete_time_block` tools in `src/lib/mcp/tools/calendar.ts` (or new `time-blocks.ts`).

UI:
- Calendar staff column / day-view / week-view: render `StaffBreak` and `TimeBlock` overlays. Diagonal-stripe SVG pattern background (`<pattern id="stripes">` in a defs block, reused across views) with a soft fill color. Labels rendered if the block is tall enough; tooltip on hover. Breaks use one color (e.g. `bg-stone-200/60`), blocks use a slightly different shade (e.g. `bg-amber-100/60`) so they're distinguishable at a glance — both clearly "not bookable" via the stripe pattern.
- New "Block time" entry: from the calendar, click-drag in a staff column the same way you'd start a new appointment. The new-appointment dialog gets a top-level toggle "Appointment / Block time." When "Block time" is selected, the form collapses to `{ staff (locked), start, end, label?, reason? }`.
- Time-block detail drawer: clicking an existing block opens a small editor with edit/delete. Simpler than the appointment drawer.
- Legend item on the calendar header explaining the stripe pattern.
- Public booking widget: no change to the user-facing UI — slots simply don't appear. (Already works via the availability calc once blocks are wired in.)

Acceptance criteria:
1. Setting a Monday break of 12:00–13:00 in the staff schedule tab, hitting Save, then reloading the page shows the break still configured. (Today: lost.)
2. A `StaffBreak` row exists in the DB after that save, FK'd to the right `staffSchedule`.
3. The public booking widget does not offer a slot that overlaps the saved break.
4. The dashboard calendar (day view) renders a diagonal-stripe band over the 12:00–13:00 lane in that staff's column on Mondays, labeled "Break."
5. Clicking and dragging in a staff column opens the new-appointment dialog with the "Block time" toggle visible; switching to "Block time" hides client/service/staff-select and shows label + reason fields.
6. Creating a block at 14:00–15:30 today writes a `TimeBlock` row, renders a diagonal-stripe band on the calendar, and causes the booking widget to skip overlapping slots within 30s (or on next fetch — no need for live invalidation in v1).
7. Deleting a block removes the band and re-enables booking those slots.
8. A staff user (role `staff`) can create blocks only for themselves; owners/admins can create for any staff member.
9. Breaks and blocks are visually distinguishable (different fill colors under the same stripe pattern); the legend explains both.

**Priority**: P1

**Why P1, not P0**: It's not breaking active appointments — engine respects breaks if they exist, and ad-hoc blocks aren't a thing yet so nothing to break. P0 is "Maria's booking just double-booked"; this is "the owner is being booked over lunch because the UI lied about saving her break."

**Why P1, not P2**: There is a real, shipping bug in the schedule UI today — every owner who set a break thinks they have one and doesn't. That alone is a credibility hit. Layer on the fact that "block out time for personal stuff" is one of the most common scheduling actions in a salon (more frequent than vacation requests, which already have a model), and the surfacing-on-calendar piece is what makes the day legible — and this earns its way to P1.

**Sequencing**
- Can ship the break-persistence fix as a standalone smaller PR first — it's just plumbing the existing UI fields through `handleSave` and `updateStaffSchedule`. ~50 lines. Unblocks the bug-fix half.
- `TimeBlock` model + calendar surfacing is the bigger chunk. Land after [[BOOKING-CONCURRENCY-003]] (the availability lock work) — `src/lib/availability.ts` is the shared file and merge-conflicting on it would be annoying.
- Multi-break-per-day (Fresha caps at 3) is a P3 follow-up; v1 of this gap is one break per day, matching what the UI already collects.

**Related**
- [[BOOKING-CONCURRENCY-003]] — shared `src/lib/availability.ts` editing surface.
- Pending: multi-break-per-day (P3 follow-up).
- Pending: location-level closures (e.g. "Christmas Day, all staff closed") — a separate model that uses the same diagonal-stripe surfacing pattern. Worth scoping together since the rendering work is identical.

---

## GAP-004 — Front-desk workflow: status quick-actions, late detection, today panel

**Fresha behavior**
The single biggest reason a busy salon adopts Fresha over a spreadsheet is the front desk's working memory of the day. Three primitives, working together:

1. **Status quick-action on the calendar block.** The appointment block on the day grid is not just a colored rectangle — it carries a clickable status chip in its top-right corner. One click on the chip cycles to the next state (Booked → Confirmed → Arrived → In progress → Completed). No drawer, no popover, no "save" button — the chip itself is the control. The state visibly updates on the block (icon + color shift) and the row in the today panel re-sorts. Receptionist can check in 5 clients in 10 seconds without ever opening a detail view.

2. **Running-late detection.** When `now() > appointment.startTime + graceMinutes` and the status is still `confirmed` or `pending` (i.e. they haven't been checked in), the block automatically gets a pulsing red left border and a "Late" badge with the over-by duration ("12 min late"). At `now() > startTime + lateThresholdMinutes` (default 15), the block also gets a soft toast/notification on the today panel: "Sarah Mitchell is 15+ min late — call her?" with a one-click call button. Crucially: this is purely derived state from existing fields, not a separate flag — the badge appears and disappears as time passes, no cron job needed.

3. **Today panel (the "front desk sidebar").** A pinnable sidebar on the calendar showing today's appointments grouped by status: "Up next" (next 60min), "Running late" (auto-flagged), "Here now" (checked-in + in-progress), "Awaiting checkout" (in-progress with completed services), "Completed today." Each row has the same status chip + a one-click action button. Scrolling the panel mirrors scrolling the calendar — clicking a row scrolls to the block.

The synergy is the point: a receptionist working from the today panel never has to open a single detail sheet during a normal day's work. The detail sheet is for editing notes, rescheduling, viewing history — not for the 80% case of "Maria's here, mark her arrived."

**SAL today**
- Status lifecycle is correctly modeled and persists. `updateAppointmentStatus` (`src/lib/actions/appointments.ts:175-218`) handles the full transition graph and stamps `checkedInAt`, `completedAt`, `noShowAt`, `cancelledAt` — bones are right.
- The detail sheet (`src/components/calendar/appointment-detail-sheet.tsx:335-444`) has all the right transition buttons (Confirm, Check In, Start Service, Complete, Checkout, Mark No-Show, Cancel), correctly gated by current status. The detail-sheet UX itself is good.
- The dashboard appointment card (`src/components/dashboard/appointment-card.tsx:37-46`) even has a single "next action" inline button — Fresha-style progressive flow. But this only lives on the dashboard's "today's appointments" card, not the actual calendar.
- **But on the actual calendar** (`src/components/calendar/appointment-block.tsx`):
  - No status chip on the block. Status is encoded only as the block's fill color, which is subtle and depends on which `colorBy` mode is active (`status` / `staff` / `service`). In `staff`-color mode (the default), there is *zero* visual signal of the appointment's status until you open the detail sheet.
  - No quick-action affordance. The block has one onClick that opens the sheet. To check in five clients, the receptionist makes five click → open sheet → find button → click → close trips. ~5 seconds each in good lighting, far more under pressure.
  - No keyboard shortcut for status transitions on the focused block.
- **No drag-and-drop reschedule.** Grep for `drag|onDrag|draggable|react-dnd|@dnd-kit` in `src/components/calendar/` → no matches. The only reschedule path is open sheet → Reschedule button → dialog → pick date/time/staff → confirm. ~6 clicks. (This will be a separate gap, but worth noting since it compounds the friction.)
- **No late detection anywhere.** Grep for `late|running.?late|overdue|tardy` in app code → no logic. The calendar happily renders a `confirmed` appointment whose start time was 25 minutes ago with no warning. Receptionist has to mentally scan the day for "wait, was she supposed to be at 2pm?"
- **No today panel.** No "front desk" sidebar exists. `WaitlistPanel` is the only sidebar component on the calendar; nothing analogous for the day's running flow. Receptionist's only view of "what's happening right now" is to scroll the day grid and visually parse colored rectangles.

**Gap**
The receptionist's working day is dominated by ~40 status transitions on a busy Saturday. SAL makes each one a 4-click sheet trip; Fresha makes it 1 click on the block. The compound difference at a 100-appointment-day salon is on the order of *15-20 minutes* of literal mouse-movement per receptionist per day. More importantly: when no-shows and late arrivals aren't auto-flagged, the receptionist *misses* them — the client sits in the lobby for 10 minutes before someone notices their service started 10 minutes ago. This is the difference between "calendar product" and "salon-operations tool."

**Spec**

Schema: **no changes**. All the data needed already exists (`startTime`, `status`, `checkedInAt`). Late-detection is pure derived state.

Server actions: no new actions needed for the chip — it calls the existing `updateAppointmentStatus`. One new query helper:
- `src/lib/queries/today-panel.ts` (new file):
  - `getTodayPanelData({ businessId, locationId?, date = today() })` → returns `{ upNext, runningLate, hereNow, awaitingCheckout, completedToday }`, each an array of appointments with the fields needed for the row (id, clientName, serviceName, staffName, startTime, status, minutesLate?). Sorted within each bucket. Computed in one query, bucketed in TS.
  - `runningLate` predicate: `status IN (pending, confirmed) AND startTime < now() - graceMinutes` (default `graceMinutes = 0`, configurable per business in a follow-up).
  - `awaitingCheckout` predicate: `status = in_progress AND now() > startTime + service.duration` (i.e. they should be done but haven't been checked out yet).

Helper:
- `src/lib/calendar/late-status.ts` (new, pure function, no DB):
  - `getLateStatus(appointment, now = new Date(), graceMinutes = 0): { isLate: boolean; minutesLate: number; severity: "none" | "soft" | "hard" }`
  - `soft` = 1-14 min late; `hard` = 15+ min late.
  - Used by both the calendar block (for the badge) and the today panel (for the bucket).

UI:
- `src/components/calendar/appointment-block.tsx` — add a clickable status chip in the top-right corner:
  - Visible on hover always; visible at all times if `status IN (pending, confirmed, checked-in, in-progress)` (the active states). On `completed/cancelled/no_show`, the chip is the final state badge, no click.
  - Click cycles to next state per the transition map (`pending → confirmed → checked-in → in-progress → completed`). Right-click (or alt-click) opens a popover with all options including no-show and cancel.
  - Receives `onStatusChange` directly (re-uses the same handler from the parent calendar client — no new wiring).
  - When `getLateStatus(appointment).isLate` is true: add a 2px red pulsing left-border *in addition* to the existing colored border, and render a small "X min late" badge bottom-right. `severity=hard` makes the badge solid red instead of soft amber.
  - Block must auto-re-render once per minute to update late state. Add a `useNowMinute()` hook in `src/hooks/use-now-minute.ts` (new) — returns a `Date` that ticks every 60s. Pass `now` as a prop from the calendar client (single tick source, not per-block timers).
- `src/components/calendar/today-panel.tsx` (new):
  - Right-pinned sidebar, toggleable from the calendar header (new "Today" button, mirrors the existing "Waitlist" button).
  - Five collapsible sections matching the buckets above; each row has client avatar + name, service, time, status chip, and a primary action button matching the bucket ("Check In" / "Start" / "Complete" / "Checkout" / "Call client" for late).
  - Empty buckets render a one-line "Nothing here" placeholder, not a hidden section, so the panel structure stays predictable.
  - Clicking a row scrolls the calendar to that appointment's block (and briefly pulses it).
  - Auto-refreshes every minute (same tick source as the block).
  - Persists open/closed state in localStorage like the other calendar prefs (`sal-calendar-todayPanelOpen`).
- `src/components/calendar/calendar-header.tsx`:
  - Add "Today" toggle button next to the existing "Waitlist" button.
  - When the today panel surfaces a hard-late appointment, show a small red dot badge on the "Today" button.

Acceptance criteria:
1. On the day grid, hovering over a `confirmed` appointment reveals a status chip in the top-right. One click on the chip transitions to `checked-in` *without* opening the detail sheet, persists via `updateAppointmentStatus`, the block's color/icon updates immediately (optimistic), and a toast confirms. Five consecutive check-ins take ≤10 seconds of input time.
2. An appointment with `status=confirmed` and `startTime` 12 minutes in the past renders with a pulsing red left border, a "12 min late" amber badge bottom-right, and (if the today panel is open) appears in the "Running late" bucket. At 16 min late, the badge turns solid red.
3. The today panel renders five buckets: "Up next" (next 60 min, not yet arrived), "Running late" (per the derived predicate), "Here now" (checked-in + in-progress), "Awaiting checkout" (in-progress past expected end), "Completed today." Each bucket auto-refreshes once per minute. Clicking a row scrolls the calendar viewport to that appointment.
4. Late status is purely derived — no cron, no flag column. Refreshing the page at a different wall-clock time yields the correct late badges with no DB writes between renders.
5. Right-click (or long-press on touch) on a status chip opens a small menu with all valid transitions for the current status, including the destructive ones (No-Show, Cancel). The detail sheet still works as before — this is additive.
6. Keyboard: focus an appointment block, press `c` to check in (or advance to next state), `n` to mark no-show, `x` to cancel (with confirm). These are off by default behind a feature flag (`SAL_CALENDAR_KEYBOARD=1`) for v1 — wire the listeners but document the flag.
7. Today panel open/closed state persists across page reloads. On first-ever load, default = closed on mobile, open on desktop wider than 1280px.
8. No double-render storms when the once-per-minute tick fires — confirmed by adding a render counter to the dev calendar and observing one block render per appointment per tick, not N².

**Priority**: P1

**Why P1, not P0**: SAL today *can* manage a day — the detail sheet works, persistence is correct, the data model is right. A determined receptionist gets the job done. P0 is "the booking just broke"; this is "the booking works but the front desk hates the tool."

**Why P1, not P2**: This is the wedge feature where Fresha's product feels like a salon-ops tool and SAL feels like a generic calendar. At demo time, the side-by-side is brutal: Fresha receptionist clicks once per check-in; SAL receptionist clicks four times. The compound effect over a Saturday is "we're switching back to Booksy" tier. Also: late detection is genuinely the most asked-for feature in salon forums because no-shows are an expensive problem — the calendar should *help* catch them, not just record them.

**Sequencing**
- Ship in three independent landings to keep the PR sizes sane:
  1. **Status chip on the block** (smallest, ~150 lines) — wires existing action through a new UI primitive. Independent of everything.
  2. **Late detection** (~100 lines) — adds the `useNowMinute` hook, the `getLateStatus` helper, and the visual treatment on the block. Independent.
  3. **Today panel** (~400 lines) — the bigger chunk; depends on the late-status helper from (2) for the "Running late" bucket.
- The drag-to-reschedule gap (separate, not specced here) shares the calendar grid surface — coordinate the component boundaries so the chip's click handler and the block's drag handler don't fight for the same pointer event. Probably means the chip needs `e.stopPropagation()` on mousedown.

**Related**
- [[GAP-001]] — the chip's right-click menu's "Cancel" entry needs the cancellation initiator/reason picker (depends on GAP-001 to be fully Fresha-parity; ship without it first, layer the reason picker on after GAP-001 lands).
- [[GAP-002]] — recurring series occurrences should show the same chip; the chip's click on a recurring instance should default to `this_only` edit mode (no series-wide cascade for routine check-ins).
- [[GAP-003]] — TimeBlocks should not appear in any today-panel bucket; only `Appointment` rows.
- [[BOOKING-CONCURRENCY-003]] — the chip's status transitions go through the same `updateAppointmentStatus` action, which is on the lock surface. No conflict expected, but verify the chip's optimistic update doesn't paper over a lock-conflict error from the server.
- Pending: drag-to-reschedule on the calendar (next gap to spec — needs a separate write-up).
- Pending: per-business `graceMinutes` and `lateThresholdMinutes` settings (P3 — defaults of 0/15 cover the common case).
