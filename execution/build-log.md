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

## [2026-05-22] dev: seed-time API key for local MCP/v1 testing — shipped at e4ff300
- **Files**: prisma/seed.ts
- **Approach**: At seed time, mint a random `sal_devseed_<48-hex>` key, hash it with the same `sha256` scheme `withV1Auth()` uses, and insert an `ApiKey` row scoped to the seeded business with `role: "owner"` and `createdById = adminUser.id`. Print the raw key to stdout twice (once inline, once in the closing summary block) so Tester (and Auditor when poking response shapes) can curl `/api/v1/*` and `/api/mcp` without driving the NextAuth credentials/CSRF dance.
- **Verification**: `pnpm lint` ✓. `pnpm build` ✓. Not run against a live DB from the sandbox — Anas/Tester to run `npx tsx prisma/seed.ts` locally and confirm the key appears in the seed output and authenticates against `/api/v1/business`.
- **Rollback**: `git revert e4ff300` (key rotates next seed regardless, so no cleanup needed in any prod-shaped DB).

## [2026-05-22] BOOKING-CONCURRENCY-001: pg advisory lock against double-booking — shipped at 41a8f1c
- **Files**: src/lib/db/advisory-lock.ts (new), src/lib/actions/appointments.ts, src/lib/actions/public-booking.ts
- **Approach**: New `lockStaffSchedule(tx, businessId, staffId)` helper takes a `pg_advisory_xact_lock` keyed on sha256(businessId:staffId) split into two int4s. Called as the first statement inside each `$transaction` callback in all three booking write paths (createAppointment, createPublicBooking, rescheduleAppointment) before the existing overlap-check query. Reschedule locks only the new effective staff — the old slot is releasing, nothing to serialize on the previous staff. No schema migration; lock releases automatically on commit/rollback.
- **Verification**: `pnpm lint` ✓. `pnpm build` ✓. Concurrent + mixed-callsite repros pending Tester run against the pushed branch.
- **Rollback**: `git revert 41a8f1c`

## [2026-05-21] fresha-gap: calendar drag-to-reschedule + resize — shipped at 838ba33
- **Files**: src/app/(dashboard)/calendar/client.tsx, src/components/calendar/appointment-block.tsx, src/components/calendar/day-view.tsx, src/components/calendar/three-day-view.tsx, src/components/calendar/week-view.tsx, src/components/calendar/staff-column.tsx, src/lib/actions/appointments.ts
- **Approach**: dnd-kit PointerSensor with 6px activation so click-through to the detail sheet still works. Status-gated — cancelled/no-show/completed are non-draggable. 15-min snap on both drag and resize. New `resizeAppointment` server action mirrors `rescheduleAppointment`'s conflict-check transaction. Optimistic UI with rollback + toast on server error. Drag works day/3-day (cross-staff + cross-time) and week (cross-time, same staff).
- **Verification**: `pnpm lint` ✓. `tsc --noEmit` ✓. `pnpm build` ✓ — initial failures were `next dev` (PID 1588) racing the default `.next/` dir; built green into an isolated `.next-build` distDir via a temporary `NEXT_DIST_DIR` env override (next.config.mjs change reverted before commit). Tester to re-run drag flows against the pushed branch.
- **Rollback**: `git revert 838ba33` on agents/coder.
- **Phase 2 followups (deferred)**: working-hours rejection toast, keyboard a11y verification (Space / arrows / Enter / Esc — KeyboardSensor wired, behaviour to confirm), reschedule-email dedupe for rapid drags, error sanitiser pass for `rescheduleAppointment`/`resizeAppointment` (Prisma-leak pattern Tester flagged on `/api/availability`).

## [2026-05-22] regression-fix — restore local-Postgres SSL detection in seed
- **Files**: prisma/seed.ts
- **Approach**: e4ff300 hardcoded sslmode=require, clobbering the isLocal check from 9aa683c. Restored the `localhost`/`127.0.0.1` detection so local dev seeding works again without TLS.
- **Verification**: pnpm lint clean, pnpm build clean. Tester to re-run `npx tsx prisma/seed.ts` against local Postgres.
- **Rollback**: 391f95c

## [2026-05-22] regression-fix — apiKey cleanup in seed reset chain (shipped at 208a5c3)
- **Files**: prisma/seed.ts
- **Approach**: Tester caught P2003 on `business.deleteMany()` — e4ff300 added `apiKey.create(...)` but I never added `apiKey.deleteMany()` to the reverse-dependency cleanup chain, so the dev-seed key from run N held a FK on Business when run N+1 tried to nuke it. Added the deleteMany right before `location`/`business`. First-time seed unaffected; subsequent runs now idempotent.
- **Verification**: pnpm lint ✓, pnpm build ✓. Tester to confirm second consecutive `npx tsx prisma/seed.ts` runs clean.
- **Rollback**: 208a5c3
