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

## [2026-05-22] BOOK-500-001: public booking page returns 503 + friendly UI on DB outage — shipped at a78ecce
- **Files**: src/app/book/[businessSlug]/page.tsx, src/app/book/error.tsx (new), src/app/api/health/route.ts
- **Approach**: Wrap `prisma.business.findFirst` in `page.tsx` with a try/catch that detects Prisma connection failures (`PrismaClientInitializationError`, codes `P1001`/`P1002`/`P1017`) and rethrows as a `ServiceUnavailableError`; other errors propagate untouched. New `book/error.tsx` route-segment boundary renders a calm "Booking temporarily unavailable" page with Try-again / Go-home actions instead of the Next.js default 500 overlay. Also tightened `/api/health` while in the same file: error is now categorized (`db_unreachable` / `db_request_error` / `db_panic`) and `error.message` is only returned in non-prod, closing the small source-leak window Tester would otherwise have to revisit.
- **Verification**: `pnpm lint` ✓. `pnpm build` ✓. Manual repro against preview deferred to Tester — needs a DB-down simulation (stop Postgres, hit `/book/<slug>`) to confirm the 503 + friendly page.
- **Rollback**: `git revert a78ecce`

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

## [2026-05-24] MULTITENANT-SCOPE-001 (partial) + ref-race cleanup — shipped at <PENDING>
- **Files**: src/lib/ownership.ts (new), src/lib/actions/memberships.ts, src/lib/actions/resources.ts, src/lib/actions/appointments.ts, src/lib/actions/recurring.ts, src/app/api/v1/checkout/route.ts
- **Approach**: New `src/lib/ownership.ts` exports `assertServicesOwned`, `assertClientOwned`, `assertClientsOwned`, `assertStaffOwned` (single batched `findMany` + length-equality for the array variants; staff goes through `primaryLocation.businessId` since `Staff` has no direct `businessId`). Memberships and resources now import the shared helpers (de-duped their local copies). Appointments `createAppointment` and recurring `createRecurringAppointment` + `createGroupBooking` + `addGroupParticipant` now assert ownership of client/clientIds/staff before persisting, and look up the service via `findFirst({ id, businessId })` rather than the unscoped `findUnique({ id })` — closes the path where a foreign service's name/price/duration would get baked into the local appointment. Same file: replaced both `SAL-${count+1}` count-based booking-ref schemes in recurring with a shared `generateBookingReference()` helper (timestamp-base36 + random suffix), matching the scheme already in `createAppointment`. Bonus: `checkout/route.ts` `paymentReference` swapped off `PAY-${count+1}` and onto `PAY-<YYYYMMDD>-<8 hex>` via `randomBytes`. Note: `ServiceBundle` site Auditor flagged is on `fix/production-hardening-round2` (Anas's branch), not here.
- **Verification**: `pnpm lint` ✓. `pnpm build` ✓. Functional verification deferred to Tester — needs two-tenant repros that try to (a) create an appointment with another tenant's serviceId, (b) subscribe a client to another tenant's plan, (c) submit `clientIds[]` mixing tenants into a group booking. All three should now return "Invalid <x> id" instead of persisting cross-tenant data.
- **Rollback**: `git revert <commit>` on agents/coder.

## [2026-05-24] API-CROSS-TENANT-STAFF-ORACLE-001 — Block cross-tenant staff oracle in appointments reschedule
- **Files**: src/app/api/v1/appointments/[id]/route.ts
- **Approach**: PATCH ?action=reschedule accepted `newStaffId` without ownership check. Now calls `assertStaffOwned(newStaffId, ctx.businessId)` and returns the same NOT_FOUND("Appointment") body on failure so wrong-tenant and missing both look identical. Also added `appointment.businessId` to the conflict-check `where` as belt-and-braces so the schedule probe can't reach cross-tenant rows even if the helper were bypassed.
- **Verification**: pnpm lint clean, pnpm build green. Tester to re-curl with two tenant API keys.
- **Rollback**: HEAD~1

## [2026-05-25] GAP: client allergies/medical alert — committed locally (push blocked, see below)
- **Files**: prisma/schema.prisma, prisma/migrations/20260525075047_add_client_allergies/migration.sql, src/lib/queries/clients.ts, src/lib/actions/clients.ts, src/app/api/v1/clients/route.ts, src/app/api/v1/clients/[id]/route.ts, src/components/clients/edit-client-dialog.tsx, src/app/(dashboard)/clients/client.tsx, src/app/(dashboard)/clients/[id]/client.tsx, src/data/mock-data.ts
- **Approach**: `Client.allergies TEXT NULL` on schema + migration. Surfaces as a red "Allergies / Medical Alert" banner above the existing notes banner on the client detail page so it can't be missed. Add-client and edit-client dialogs both expose the field with red-themed Textarea (500-char cap). Edit dialog was previously toast-only — now actually calls `updateClient` server action and router.refresh()es. v1 POST/PATCH `/clients` accept `allergies` too. Treats empty string as `null` on write.
- **Verification**: `pnpm lint` ✓, `pnpm build` ✓ (commit 497d7df). Local preview at http://178.105.195.98:3001/clients picks up changes from sandbox without push.
- **Rollback**: HEAD~1
- **NOTE**: `git push origin agents/coder` failed — no git credential helper / no GH token in this env. Local branch is now 18 commits ahead of origin/agents/coder. Diff link to GitHub won't reflect this (or any of the last 17 commits) until push auth is restored. Flagging to Anas.
