# Build Log

Append-only log from the coder agent. One entry per change shipped.

Format per entry:

```
## [<timestamp>] <bug-log entry id OR fresha-gap title> — <one-line summary>
- **Files**: <paths touched>
- **Approach**: <2-3 sentences>
- **Verification**: <build passed? lint passed? manual test? tester re-run?>
- **Rollback**: <commit hash to revert if regressions appear>
```

---

## [2026-05-21] fresha-gap: calendar drag-to-reschedule + resize — full DnD across day/3-day/week views
- **Files**: src/app/(dashboard)/calendar/client.tsx, src/components/calendar/appointment-block.tsx, src/components/calendar/day-view.tsx, src/components/calendar/three-day-view.tsx, src/components/calendar/week-view.tsx, src/components/calendar/staff-column.tsx, src/lib/actions/appointments.ts
- **Approach**: dnd-kit PointerSensor with 6px activation distance so single-click still opens the detail sheet. Status-gated — cancelled/no-show/completed are not draggable. 15-min snap on both drag and resize. New `resizeAppointment` server action mirrors `rescheduleAppointment`'s conflict-check shape. Optimistic UI updates with rollback on server error toast.
- **Verification**: pnpm lint clean, pnpm build clean on `.next/` after Tester killed the racing dev server (PID 1588). Tester to re-run against the pushed branch.
- **Rollback**: pending push, will update with hash.
- **Known followup**: `error.message` is being mirrored into the action response in `rescheduleAppointment` + `resizeAppointment` — same Prisma-leak pattern Tester flagged on `/api/availability`. Sanitizer helper coming in the post-calendar PR; will also strip Prisma error codes (P2002 etc) per Tester's ask, and sweep `withV1Auth` callers per the apiKey-lookup gap.
