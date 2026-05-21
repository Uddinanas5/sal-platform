# Fresha Feature Gap Audit

Append-only log from the Fresha auditor agent. Each entry maps one Fresha feature/flow to its SAL equivalent (or absence), with screenshots and a concrete spec the coder can pick up.

Format per entry:

```
## <Fresha feature path, e.g. Calendar > Appointment > Reschedule>
- **Fresha behavior**: <what Fresha does, with screenshot URL or description>
- **SAL today**: <missing | partial | present-but-different>
- **Gap**: <what's missing in SAL>
- **Spec for coder**: <concrete files to touch + acceptance criteria>
- **Priority**: P0 (table-stakes) | P1 (parity) | P2 (delight)
- **Status**: open | building | shipped
```

---

## Calendar > Appointment > Drag-and-drop reschedule
- **Fresha behavior**: On the day/week calendar, the user grabs an appointment block and drags it to a new time slot (and optionally a different staff column). The block follows the cursor with a "ghost" indicator showing the proposed new time. Drop commits the change, the block snaps to the time-grid increment (default 15min, configurable), shows a toast "Appointment rescheduled to <time>", and triggers a reschedule notification to the client. If the drop target conflicts with another booking or falls outside the staff member's working hours, the drop is rejected with a clear message. Vertical edge of the block is draggable to **resize** (change duration) — affects the linked service duration on that appointment only, not the master service. Source: https://www.fresha.com/for-business/help/article/calendar-overview-115004017487 and product screenshots.
- **SAL today**: **partial** — `rescheduleAppointment()` server action exists at `src/lib/actions/appointments.ts:254` with atomic conflict checking and reschedule emails. `@dnd-kit/core` is in `package.json`. But `src/components/calendar/appointment-block.tsx` and `day-view.tsx`/`week-view.tsx`/`staff-column.tsx` have **zero drag handlers**. Users can only reschedule via the detail sheet form. No resize handle on blocks.
- **Gap**: No drag-to-reschedule UI. No drag-between-staff-columns. No drag-to-resize (duration change). No visual ghost/drop indicator. No snap-to-increment.
- **Spec for coder**:
  - **Files**:
    - `src/components/calendar/appointment-block.tsx` — wrap motion.div in `useDraggable` from `@dnd-kit/core`. Add bottom-edge resize handle (8px tall, cursor `ns-resize`, only visible on hover) that captures pointer events separately and triggers a resize gesture (not a drag).
    - `src/components/calendar/day-view.tsx`, `week-view.tsx`, `three-day-view.tsx` — wrap the time grid in `DndContext` with `PointerSensor` (activation distance 6px to avoid accidental drags) + `KeyboardSensor`. Each time slot row should be a `useDroppable` keyed by `${staffId}|${ISODateTimeAtSlotStart}`. Use `restrictToVerticalAxis` modifier for single-staff view, no modifier for multi-staff view.
    - `src/components/calendar/staff-column.tsx` — same droppable wiring per staff column.
    - New: `src/components/calendar/drag-ghost.tsx` — `DragOverlay` content showing the in-flight block with current time label.
    - `src/lib/actions/appointments.ts` — add `resizeAppointment(id, newDurationMinutes)` action mirroring `rescheduleAppointment` (same conflict check transaction, updates `endTime`, `totalDuration`, and the linked `appointmentService.endTime`/`durationMinutes`; does NOT touch master `service.durationMinutes`).
    - `src/app/(dashboard)/calendar/client.tsx` — wire `onDragEnd` handler: parse drop droppableId → `{staffId, slotStart}` → call `rescheduleAppointment(id, slotStart, staffId)`, optimistic update with rollback on `{success:false}`, sonner toast.
  - **Snap**: drop time snaps to the calendar's `slotIncrementMinutes` setting (already in `calendar-settings-popover.tsx`). Compute via `Math.round(droppedMinuteOffset / increment) * increment`.
  - **Acceptance criteria**:
    1. Click + hold an appointment block; after 6px movement, block becomes semi-transparent and a ghost follows the cursor showing new start time.
    2. Drop on a time slot in the same staff column → appointment moves to that time, snaps to increment, toast appears, DB updated, reschedule email queued (existing code path).
    3. Drop on a different staff column → same behavior; staff is reassigned on the linked `appointmentService`.
    4. Drop on a conflicting slot → drop is rejected with toast "Time slot is already booked for <staff name>", appointment stays in original position (no DB call needed — frontend pre-check against currently-loaded appointments; the server-side `CONFLICT` error is the safety net).
    5. Drop outside the working-hours band → drop rejected with toast "<staff name> is not working at <time>" (read `staff.schedule` for that weekday — same data the grey overlay uses).
    6. Drag bottom edge of block downward → block grows in real time, on release calls `resizeAppointment` with new duration, snapped to increment, conflict-checked.
    7. Keyboard: Tab to block, press Space to "pick up", arrow keys move by one increment, Enter to drop, Esc to cancel. (dnd-kit `KeyboardSensor` handles this.)
    8. No layout shift on month-view (drag disabled there — keep current click-through behavior).
    9. Works in three-day view and on the multi-staff team view.
    10. Status `cancelled` and `no-show` blocks are non-draggable (cursor remains pointer, no drag activation).
- **Priority**: P0
- **Status**: open

