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

## [2026-05-25] CROSS-TENANT-WRITE-STAFF-POST-001: scope `/api/staff` POST to caller's business; validate locationId + serviceIds — committed locally at c0c239e, push BLOCKED (auth)
- **Files**: src/app/api/staff/route.ts
- **Approach**: `/api/staff` POST used `auth()` directly and never pulled `businessId` from session. `locationId`, `userId`, and `serviceIds[]` were taken straight from body with zero tenant validation, so Tenant A could POST `locationId=<Tenant B>` + `serviceIds=[Tenant C]` and create a Frankenstein staff row stapling three tenants together. Fix swaps to `getBusinessContext()`, then before the transaction runs two scope checks: `location.findFirst({ id: locationId, businessId: ctx.businessId })` rejects foreign locations with 400; `service.count({ id: { in: serviceIds }, businessId: ctx.businessId }) === serviceIds.length` rejects any foreign serviceId. Schedule rows already reused the verified locationId (left a comment so it's obvious it's not a body field). userId tenant-check left as follow-up — User has no businessId column, so the right policy needs Anas's input (Staff has no @@unique on userId, so a single user *can* legitimately work across multiple tenants).
- **Verification**: `pnpm lint` ✓. `pnpm build` ✓. Push BLOCKED (same auth issue). Backlog now **31 commits** on `agents/coder`.
- **Rollback**: `git revert c0c239e` (still local)

## [2026-05-25] PUBLIC-BOOKING-PAGE-500 / api-services-nullable-orderby: sort by category sortOrder in-memory — committed locally at 2dcde56, push BLOCKED (auth)
- **Files**: src/app/api/services/route.ts
- **Approach**: GET /api/services was passing `orderBy: [{ category: { sortOrder: 'asc' } }, …]` to Prisma. With nullable categoryId in the schema (some services have no category), this orderBy on a nullable relation throws at runtime → 500 on every call, ghost or real businessId. Fix is one line: drop the relation orderBy, add `sortOrder: true` to the included category select, and re-sort the result array in-memory by `category?.sortOrder ?? MAX_SAFE_INTEGER`. DB-level sortOrder/name ordering stays. Tester gave the green light to ship without a real-businessId smoke test — theory was strong, fix is contained. Same patch is suspected behind the :3000 public-booking-page 500s (PUBLIC-BOOKING-PAGE-500-001, though :3001 was already 200 — that one's a deploy-staleness issue, not code).
- **Verification**: `pnpm lint` ✓. `pnpm build` ✓. `git push` still fails — `could not read Username for 'https://github.com'`. Backlog now **39 commits** on `agents/coder`.
- **Rollback**: `git revert 2dcde56` (still local)

## [2026-05-25] QUERIES-BUSINESSID-REQUIRED-001: flip 4 leaky query fns to required businessId, patch all callers — committed locally at 5f7b439, push BLOCKED (auth)
- **Files**: src/lib/queries/{clients,products,services,staff}.ts, src/app/api/notifications/route.ts, src/app/api/search/route.ts, src/app/(dashboard)/{clients,inventory,memberships,services,staff,checkout,settings}/page.tsx
- **Approach**: Per Auditor's spec, flipped `businessId?: string` → required `businessId: string` on `getClients`, `getServices`, `getStaff`, `getProducts` (and `getLowStockProducts`), deleting the `businessFilter = businessId ? { businessId } : {}` ternary at the source so the next caller can't repeat the footgun. Ripple fix: 2 non-dashboard routes (notifications, search) early-return empty payloads when no businessId; 7 dashboard pages add `if (!businessId) redirect("/onboarding")` matching the pattern already in dashboard/page.tsx. **Currently-exploitable surface: zero** — middleware already redirects business-less sessions, v1 doesn't import from this layer, and onboarding does its own scoped Prisma calls. This closes the *latent* footgun: type system now enforces business scoping at the call boundary. The broader queries-layer refactor (reports.ts has 14 same-pattern fns, plus marketing/memberships/waitlist/reviews/resources/forms) lands in a separate PR per Auditor.
- **Verification**: `pnpm lint` ✓. `pnpm build` ✓. Push BLOCKED (same auth issue). Backlog now **38 commits** on `agents/coder`.
- **Rollback**: `git revert 5f7b439` (still local)

## [2026-05-25] APPT-RESCHEDULE-PARTIAL-SHIFT-001: shift all services on reschedule, not just lead (option 3 chosen) — committed locally at 1c3f8bf, push BLOCKED (auth)
- **Files**: src/lib/actions/appointments.ts, src/app/api/v1/appointments/[id]/route.ts
- **Approach**: Reschedule was only updating `appointment.startTime/endTime` and `services[0]`. For 2+ service appointments, services[1..N] stayed pinned to the old slot — parent and children out of sync. Fix: compute `deltaMs = newStart - oldStart` once, apply to every service row's start/end (sorted by original startTime to preserve ordering and gaps). Conflict check now walks each resolved staff per service and bails atomically on first collision; locks every distinct staffId (sorted) before the check for deadlock safety. **Option (3) per Auditor's bug doc**: `newStaffId` continues to reassign the lead service only — implicit contract documented inline at the assignment site (Auditor's ask) so the next reader doesn't relitigate. Applied identically to the server action and the v1 PATCH endpoint.
- **Verification**: `pnpm lint` ✓. `pnpm build` ✓ (after fixing a `Set` iteration target error with `Array.from`). `git push` still fails — `could not read Username for 'https://github.com'`. Tester is queued to add a regression check pinning the option-(3) semantic once writes are restored.
- **Rollback**: `git revert 1c3f8bf` (still local)

## [2026-05-25] AVAILABILITY-CROSS-TENANT-STAFF-ORACLE-001: scope explicit staffId to service business — committed locally at 1a0489e, push BLOCKED (auth)
- **Files**: src/app/api/availability/route.ts
- **Approach**: `GET /api/availability?staffId=...` accepted a foreign staffId and resolved it via `staff.findMany({ where: { id: staffId } })` with no business scope — a cross-tenant oracle, and inconsistent with the locationId branch which already gates by `service.businessId`. Added `primaryLocation: { businessId: service.businessId }` to the explicit-staffId where clause. When the staffId doesn't resolve under the business, returns 404 "Staff not found" instead of an empty-slots envelope (empty-slots is indistinguishable from "fully booked" and would silently leak the signal we're closing).
- **Verification**: `pnpm lint` ✓. `pnpm build` ✓. Push BLOCKED (same auth issue).
- **Rollback**: `git revert 1a0489e` (still local)

## [2026-05-25] API-V1-TEAM-USERID-ORACLE-001: close cross-tenant user existence oracle on DELETE/PATCH — committed locally at 86db73f, push BLOCKED (auth)
- **Files**: src/app/api/v1/team/[userId]/route.ts
- **Approach**: Both DELETE and PATCH did `prisma.user.findUnique({id})` globally first, then a businessId-scoped staff lookup second. That two-stage flow leaked tenant-isolation: callers received `"User not found"` for truly-absent ids vs `"Team member not found"` for users that exist in *another* business — a clean oracle for enumerating user ids across tenants. Inverted the order: lookup `Staff` row scoped to `ctx.businessId` first with `include: { user: true }`, bail with uniform `NOT_FOUND("Team member")` if absent, then read `role` off the included user for the admin-can-only-remove-staff and `cannot change owner role` guards. Single 404 shape regardless of cross-tenant existence.
- **Verification**: `pnpm lint` ✓. `pnpm build` ✓. `git push` fails — `could not read Username for 'https://github.com'`. Backlog now **29 commits** on `agents/coder`.
- **Rollback**: `git revert 86db73f` (still local)

## [2026-05-25] API-V1-APPOINTMENTS-CROSS-TENANT-WRITE-001: scope recurring + groups + conflict-check by businessId — committed locally at 03e39b3, push BLOCKED (auth)
- **Files**: src/app/api/v1/appointments/route.ts, src/app/api/v1/appointments/recurring/route.ts, src/app/api/v1/appointments/groups/route.ts
- **Approach**: Replaced `service.findUnique({id})` in both `recurring/route.ts:29` and `groups/route.ts:29` with `findFirst({id, businessId})`. Added client + staff validation matching the main POST: client by `{id, businessId}`, staff by `{id, primaryLocation.businessId, staffServices.some({serviceId, isActive})}`. `groups` validates the whole `clientIds[]` batch via `count` + length-equality. Also tightened the conflict-check at `route.ts:128-138` to filter by `appointment.businessId`, closing the calendar-collision side-channel Tester flagged. Same fix template as 8d942b9 / b9ba744. Generic `NOT_FOUND` strings, no existence-oracle leak.
- **Verification**: `pnpm lint` ✓. `pnpm build` ✓. `git push` still fails — `could not read Username for 'https://github.com'`. Backlog now **28 commits** on `agents/coder`. Tester can repro fix from local sandbox; preview frozen until auth provisioned.
- **Rollback**: `git revert 03e39b3` (still local)

## [2026-05-25] BOOKING-CROSS-TENANT-RW-001 + BOOKING-CROSS-TENANT-WRITE-001: scope /api/bookings/[id] verbs + /api/v1/appointments POST — committed locally at b9ba744, push BLOCKED (auth)
- **Files**: src/app/api/bookings/[id]/route.ts, src/app/api/v1/appointments/route.ts
- **Approach**: `[id]` route — replaced bare `auth()` + `findUnique({where:{id}})` in GET/PATCH/DELETE with `getBusinessContext()` + `findFirst({id, businessId})`. Cross-tenant ids now 404 instead of leaking PII or accepting mutations. The downstream `client.update` (totalSpent increment) and `appointment.update` reuse the gated `existing.*` so they inherit the same tenant gate without needing extra checks. v1 POST — service is now scoped by businessId, client by businessId, and staff via `primaryLocation.businessId` AND an `isActive` `staffServices` link to the requested service. Blocks both cross-tenant booking creation AND franken-mix bookings (biz-A service paired with biz-B staff). Companion to 8d942b9 which closed the same hole on the non-[id] route.
- **Verification**: `pnpm lint` ✓. `pnpm build` ✓. `git push` fails — `could not read Username for 'https://github.com'`. Backlog now **27 commits** on `agents/coder`. Tester can repro from local sandbox but preview is still frozen until auth is provisioned.
- **Rollback**: `git revert b9ba744` (still local)

## [2026-05-25] error-boundaries: root + global app error fallbacks — committed locally at defe979, push BLOCKED (auth)
- **Files**: src/app/error.tsx (new), src/app/global-error.tsx (new)
- **Approach**: `src/app/error.tsx` is the nearest fallback for any uncaught render error in the app tree (calm retry + go-home UI). `src/app/global-error.tsx` owns its own `<html>`/`<body>` and only fires when the root layout itself throws — the last resort that prevents Next.js from rendering its default error page (which leaks `notFound` strings + stack traces via `__NEXT_DATA__` in production). Closes the public info-leak path Tester reproduced on `/book/manage/<invalid-ref>`.
- **Verification**: `pnpm lint` ✓. `pnpm build` ✓. Cannot push — `git push` fails with `could not read Username for 'https://github.com'`. This is the same auth blocker that has now stranded **26 commits** on `agents/coder` (up from 25). Anas needs to provision a credential helper or SSH key on the sandbox before any of this reaches origin or the preview.
- **Rollback**: `git reset --hard HEAD~1` (still local)

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

## [2026-05-25] FAKE-TOAST: inventory stock adjustment dialog wired to DB — committed locally (push still blocked)
- **Files**: src/components/inventory/stock-adjustment-dialog.tsx, src/app/(dashboard)/inventory/client.tsx
- **Approach**: `handleSubmit` was toast-only — clicked "Adjust Stock" showed success but stock level never moved. Now computes delta from adjustmentType (add/remove/set) and calls `adjustStock(productId, delta, reason)` server action (already existed at src/lib/actions/products.ts:88). Disables both buttons during submit, swaps button label to "Saving…", surfaces server errors as toast.error. Parent passes an `onAdjusted` callback that patches local product state + router.refresh() so the table updates without a full reload. Treats delta=0 (set-to-current) as a no-op with toast.info instead of a useless write.
- **Verification**: `pnpm lint` ✓, `pnpm build` ✓ (commit b223878). Preview at http://178.105.195.98:3001/inventory picks up live.
- **Rollback**: HEAD~1
- **NOTE**: Push still blocked, now 19 commits ahead of origin/agents/coder.

## [2026-05-25] PERMISSION-STOCK-ADJUST-ASYMMETRY-001 — admin-gate adjustStock + scrub raw errors — committed locally (push still blocked)
- **Files**: src/lib/actions/products.ts
- **Approach**: Tester logged the asymmetry — v1 route checks `hasRole(ctx.role, "admin")` but the server action used `getBusinessContext()` and let any signed-in user adjust stock. Swapped line 99 to `requireMinRole("admin")`. Line 133 was also leaking raw `(e as Error).message` to the client toast — replaced with sanitized "Failed to adjust stock", but still pass through the three known auth-error strings ("Not authenticated", "No business context", "Insufficient permissions…") verbatim so the UI shows the real reason when it's an auth failure.
- **Verification**: `pnpm lint` ✓, `pnpm build` ✓ (commit d50821e).
- **Rollback**: HEAD~1
- **NOTE**: Push still blocked — now 20 commits ahead of origin/agents/coder. Anas needs to drop a GH token / credential helper before any of this becomes visible on the diff link.

## [2026-05-25] GAP-020 — calendar deep-link `?appointmentId=<id>` opens detail sheet — committed locally (push still blocked)
- **Files**: src/app/(dashboard)/calendar/client.tsx
- **Approach**: Added a `useSearchParams()` effect that reads `appointmentId`, finds the matching row in the already-hydrated `appointments` state, and calls the same `setSelectedAppointment`/`setDetailSheetOpen` pair the row click handler uses. Guards with a `useRef` so it only opens once per id (won't re-fire if user closes the sheet, won't loop on appointments refresh). Also `setSelectedDate(startOfDay(target.startTime))` so deep-linking to a future/past appointment also navigates the calendar to that day instead of leaving the user on today's view with a sheet popped open out of context. Effect dep list is `[deepLinkAppointmentId, appointments]` — re-runs once data hydrates, which covers the slow-network case where the searchParams are present before the appointments resolve. Auditor confirmed one-off is the right shape (search panel + client activity feed deep-links have different contracts — those will be GAP-021/GAP-022).
- **Verification**: `pnpm lint` ✓, `pnpm build` ✓ (commit 25224a3). Live preview at http://178.105.195.98:3001/calendar?appointmentId=<id> — Tester to pick a real id from the seed and confirm the sheet opens + calendar lands on the right day.
- **Rollback**: HEAD~1
- **NOTE**: Push still blocked — now 21 commits ahead of origin/agents/coder. Same auth blocker as the last four entries.

## [2026-05-25] BOOKING-CROSS-TENANT-WRITE-001 + read sibling — `/api/bookings` GET & POST scoped to session businessId — committed locally (push still blocked)
- **Files**: src/app/api/bookings/route.ts
- **Approach**: Tester + Auditor flagged P1 cross-tenant write on POST (and on a re-read the GET has the same shape — `businessId` came from query string, no comparison to `session.user.businessId`). Swapped both handlers from raw `auth()` to `getBusinessContext()`, then forced `businessId = ctx.businessId` and ignore any value in the request body/querystring. POST now also scopes every nested lookup: `location.findFirst({where:{id, businessId}})`, `client.findFirst({where:{id, businessId}})` if `clientId` provided, `service.findFirst({where:{id, businessId}})`, and `staffServices.where` is extended with `staff: { primaryLocation: { businessId } }` (Staff has no direct businessId — scoped through its primary Location). Closes both the cross-tenant boundary and the frankenstein-mix integrity hole Auditor called out. Dropped the now-redundant `business.findUnique` existence check (session.businessId is authoritative).
- **Verification**: `pnpm lint` ✓, `pnpm build` ✓.
- **Rollback**: HEAD~1
- **NOTE**: Push still blocked — now 28 commits ahead of origin/agents/coder. Same auth blocker.

## [2026-05-25] SERVICES-CROSS-TENANT-WRITE — `/api/services` POST scoped to session businessId — committed locally (push still blocked)
- **Files**: src/app/api/services/route.ts, execution/bug-log.md
- **Approach**: Tester flagged the third in the cross-tenant-write family (after bookings GET/POST). POST handler was pulling `businessId` from the request body and writing it straight to `tx.service.create({ data: { businessId, ... } })` — auth() check only verified "logged in," not "logged in to that tenant." Swapped to `getBusinessContext()`, force `businessId = ctx.businessId` and ignore any body value. Added two scope-checks before mutating: `categoryId` (if supplied) must belong to caller's business via `serviceCategory.findFirst({where:{id, businessId}})`, and every `staffIds[]` entry must scope through `staff.primaryLocation.businessId` (Staff has no direct businessId). Each invalid reference 400s with a clear error instead of writing a frankenstein record that mixes tenants. Bug-log entry filed in same commit.
- **Verification**: `pnpm lint` ✓, `pnpm build` ✓ (commit 977661c). First type-check failed on `Staff.businessId` (doesn't exist) — fixed to use `primaryLocation: { businessId }` per schema, build re-ran clean.
- **Rollback**: HEAD~1
- **NOTE**: Push still blocked — now 30 commits ahead of origin/agents/coder. Same auth blocker.

## [2026-05-25] API-INVALID-DATE-ACCEPTED-001 (+ availability half of -ERROR-MESSAGE-LEAK-001) — strict YYYY-MM-DD parse, shared util — committed locally (push still blocked)
- **Files**: src/lib/date-utils.ts (new), src/app/api/availability/route.ts, src/app/api/bookings/route.ts
- **Approach**: Tester confirmed `new Date('2026-06-31')` silently rolls to July 1 (and `2026-02-30` → Mar 2), so `/api/availability` already had a local `parseYmd` that round-trips year/month/day to reject. Pulled that into `src/lib/date-utils.ts` as the single source of truth, then applied to `/api/bookings` GET which still used raw `new Date(str)` on `date`, `dateFrom`, and `dateTo` — would silently shift the filter window by a day on impossible inputs. Each now returns 400 with `Invalid date. Use YYYY-MM-DD` (matching the availability error shape) on malformed or impossible calendar dates. Avoids two copies of the parser drifting.
- **Verification**: `pnpm lint` ✓, `pnpm build` ✓ (commit 8c2fe15). Tester's matrix (Feb 30, Apr 31, Sep 31, `2026/06/31` with slash, `2026-13-45`) all now reject at the API boundary instead of being silently coerced.
- **Rollback**: HEAD~1
- **NOTE**: Push still blocked — now 29 commits ahead of origin/agents/coder. Same auth blocker.
