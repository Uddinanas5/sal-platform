# TASKS.md — SAL Production Hardening Backlog

*Phase 2 output. Every item has a checkable pass/fail condition. Findings from: (a) a 10-reader Phase-1 pass, (b) a 57-agent deep audit of never-examined areas with adversarial verification of every finding, (c) a live browser walk-through of the core flows. Work top to bottom (Phase 3), one task per iteration, verify the pass condition + relevant vitest suite, commit, log in FIXES.md.*

**Severity:** P0 = security / data-loss / money-wrong · P1 = broken core flow · P2 = degraded or misleading · P3 = polish.
**GATED** = touches a feature deliberately switched off for beta (SAL Payments, MCP, SMS) — verify the defense holds; do **not** enable the feature.

Legend: `[ ]` open · `[x]` passed.

---

## P0 — do first

- [x] **P0-1 · Removed team member keeps full access.** `src/lib/actions/invitations.ts:372` — `removeTeamMember` only soft-deletes the Staff row; the 7-day JWT keeps `businessId`/`role`, so a fired staffer retains access until the cookie expires. Root cause shared with stale-JWT claims (`src/lib/auth.config.ts` jwt callback runs only `if (user)`).
  **Pass:** after `removeTeamMember`, the target's existing session is denied at business-scoped endpoints (session re-validates membership against `isActive:true, deletedAt:null`) and a fresh login yields no businessId. Add a test proving a removed staffer gets 403 on a `/api/v1` call with their old cookie.

---

## P1 — broken core flows / real security holes

- [x] **P1-1 · Unauthenticated cross-tenant settings read.** `src/lib/actions/settings.ts:233` (`getNotificationSettings`) and `:301` (`getPaymentSettings`) are `"use server"` actions taking arbitrary `businessId` with no `auth()`/tenant check — any caller reads another shop's settings.
  **Pass:** both derive businessId from `getBusinessContext()` and reject mismatch; a POST with a foreign businessId returns not-found/forbidden. Add a cross-tenant test.
- [x] **P1-2 · Settings writes have no role gate.** `src/lib/actions/booking-settings.ts:35` + `settings.ts:105/207/275` call only `getBusinessContext()`, no `requireMinRole`. A plain staff user can rewrite deposits, tax rate, and templates.
  **Pass:** all four `update*` settings actions call `requireMinRole("admin")`; a staff-role session gets a permissions error. Test added.
- [ ] **P1-3 · Global `User.role` bleeds invite-granted roles across tenants.** `src/lib/actions/invitations.ts:246` — role is stored on `User`, not per-membership, so acceptInvitation escalation/bleed is possible in both directions.
  **Pass:** role is enforced per-business (Staff.role / membership); a user who is staff in B has only staff rights in B regardless of their role elsewhere. Test added.
- [x] **P1-4 · Emailed review links are dead.** `src/middleware.ts:30` — `sendReviewRequest` emails `/r/<token>` but publicRoutes only allows `/review/.*`, not `/r/.*`, so logged-out clients hit the auth wall. The entire review-request funnel is non-functional.
  **Pass:** GET `/r/<validToken>` with no session returns the star-rating form (200) and submitting creates a Review row. Verified in browser.
- [ ] **P1-5 · Cancelled salon can un-gate itself by replaying its old Checkout success URL.** `src/lib/billing/plan.ts:101` — `reconcileCheckoutSession` re-activates on any previously-complete session_id without checking the live subscription is still active. **GATED (billing live-mode pending) but fix the replay.**
  **Pass:** replaying an old completed session_id for a subscription that is cancelled at Stripe leaves `subscriptionStatus='cancelled'`. Test added.
- [ ] **P1-6 · Group-appointment oversell race (REST).** `src/app/api/v1/appointments/groups/[id]/participants/route.ts:30` — capacity is an unlocked check-then-insert; the server action was hardened with a lock+recount but the REST route wasn't.
  **Pass:** route wraps count+create in `$transaction` with `lockAppointment` (mirror `actions/recurring.ts:619`); concurrent-POST test shows no oversell.
- [ ] **P1-7 · OAuth consent phishing.** `src/app/oauth/authorize/client.tsx:75` — DCR is unauthenticated and lets anyone set `client_name` + arbitrary https `redirect_uri`; the consent screen shows the attacker's name but never the redirect destination. **GATED (MCP off in prod) but low-cost fix.**
  **Pass:** consent screen displays the actual redirect_uri host and marks client_name as unverified.
- [ ] **P1-8 · Custom slug edit never persists but artifacts use it.** `src/components/settings/online-presence-tab.tsx:122` — the Custom Slug input updates local state only; `handleSave` never writes `Business.slug`, yet the copied booking URL, embed code, and QR filename all use the unsaved value → owners share dead links.
  **Pass:** slug persists via a server action (with uniqueness check) and copied URL resolves, OR the field is read-only. Verified in browser.
- [x] **P1-9 · Legal/support emails point to an unregistered domain.** `src/app/terms/page.tsx:229`, `src/app/privacy/page.tsx:179,240`, `src/components/dashboard/header.tsx:153` all use `hello@salplatform.com` (no MX). Every support/legal contact bounces.
  **Pass:** `grep salplatform.com src/` returns nothing; all use a monitored address on a domain with valid MX (e.g. `support@meetsal.ai`).

### P1 — systemic (from Phase 1, carried in)
- [x] **P1-10 · `getBundles` unauthenticated cross-tenant read.** `src/lib/actions/bundles.ts:82` — exported `"use server"` fn takes caller `businessId` with no auth. **Pass:** derives/validates businessId from session; cross-tenant test added.
- [x] **P1-11 · Unscoped-fallback queries can leak all tenants.** `getReviews`/`getReviewStats` (`src/lib/queries/reviews.ts`), `getCampaignStats` (`queries/marketing.ts:31`), and most of `queries/reports.ts` query ALL tenants when businessId is undefined. **Pass:** each throws (or returns empty) on missing businessId rather than querying globally; test added.
- [ ] **P1-12 · No DB-level double-booking backstop.** `prisma/schema.prisma` Appointment has no exclusion constraint; prevention is app-layer advisory lock only. Ship the `btree_gist` + `tstzrange` EXCLUDE constraint (`execution/bugs/BOOKING-EXCLUSION-CONSTRAINT-001.md`). *(Coordinated with Phase 5 stress test.)* **Pass:** a direct SQL insert of an overlapping staff appointment on the dev schema is rejected by the DB.
- [ ] **P1-13 · Rate limiting is inert on the whole API surface + per-container in prod.** No `rateLimit()` on any `/api/v1`, `/api/mcp`, `/api/oauth`; and `src/lib/rate-limit.ts` falls back to per-container in-memory unless Upstash env is set (silently degrades on Redis error too). *(See Phase 6.)* **Pass:** documented serverless strategy decided + implemented; abusive REST calls are throttled; a Redis-outage path logs instead of silently degrading.
- [ ] **P1-14 · `method:"online"` records collected revenue with no charge.** `src/lib/checkout/record-checkout.ts:513` + `actions/checkout.ts:67` — API/MCP can log a "completed" online payment with no Stripe charge behind it. **GATED (SAL Payments off).** **Pass:** `online` tender is rejected the same way `card` is until real Stripe capture exists; test added.

---

## P2 — degraded / misleading (owners act on wrong info)

- [x] **P2-1 · Dashboard "Total Clients" shows `0000%` new this month.** Verified in browser (`/dashboard`). Hardcoded `weeklyGrowth/monthlyGrowth: 0` (`src/lib/queries/appointments.ts:198`) fed through a broken formatter. **Pass:** card shows a real percentage or is removed; no `0000%`.
- [x] **P2-2 · Dashboard "Booking Channels" legend renders `[object Object] legend icon`.** Verified in browser. **Pass:** legend shows channel names; no `[object Object]`.
- [x] **P2-3 · Reports growth deltas render `+-100%`.** Verified in browser (`/reports`) — a `+` is prepended to already-negative values. **Pass:** single correct sign (e.g. `-100%`, `+12%`).
- [ ] **P2-4 · Billing "Subscription active" toast fires purely from `?billing=success` URL param.** `src/app/(dashboard)/settings/client.tsx:257` — not driven by verified state; anyone visiting the URL sees it. **GATED.** **Pass:** toast driven by reconciled/loaded subscription state; bare URL param shows nothing.
- [ ] **P2-5 · VIP-tagged clients silently excluded from VIP campaigns.** Bulk action writes `"VIP"` (`clients/client.tsx:941`) but audience matches lowercase `"vip"` (`marketing/audience.ts:71`, `actions/marketing.ts:96`); Postgres array match is case-sensitive. **Pass:** VIP tag casing is consistent; a VIP-tagged client appears in the VIP audience count. Test added.
- [ ] **P2-6 · Partial-day time-off gap lets bookings land on a block.** `src/lib/scheduling/working-hours.ts` uses `findFirst` for the day; two same-day blocks → only one checked. **Pass:** all same-day time-off/block rows are considered; a booking overlapping the second block is refused. Test added.
- [ ] **P2-7 · Onboarding: duplicate service names throw a raw Prisma error and block Finish.** `src/lib/actions/onboarding.ts:228` (`createMany`, no dedupe) vs `@@unique([businessId,name])`. **Pass:** client blocks dupes or server maps P2002 to a human message; finishing with two same-named entries doesn't hard-fail.
- [ ] **P2-8 · Onboarding step 3 not idempotent.** `src/app/onboarding/client.tsx:509` — a partial failure wedges the user with repeated constraint errors until reload. **Pass:** re-clicking Finish after a partial failure completes onboarding (e.g. `skipDuplicates` / short-circuit when services already exist).
- [ ] **P2-9 · Onboarding resume silently overwrites saved working hours with defaults.** `src/app/onboarding/page.tsx:15` — saved BusinessHours never loaded; step 2 re-seeds defaults and overwrites. **Pass:** resuming shows previously saved hours; clicking Next preserves them.
- [ ] **P2-10 · Onboarding: no `closeTime > openTime` validation.** `src/lib/actions/onboarding.ts:24` — a reversed range makes the day silently unbookable. **Pass:** reversed/equal ranges rejected client- and server-side with a message naming the day.
- [ ] **P2-11 · Account-deletion email failure is silently swallowed.** `src/lib/actions/account.ts:147` — `sendEmail` never throws; if Resend is unconfigured the deletion request reaches no one but the user sees success. **Pass:** action checks `sendEmail` result and surfaces failure / records `emailFailed`.
- [ ] **P2-12 · Group-oversell race in MCP tool.** `src/lib/mcp/tools/appointments.ts:634` — capacity checked outside the transaction. **GATED (MCP off).** **Pass:** tool takes `lockAppointment` + recounts inside `$transaction`; ordering test added.
- [ ] **P2-13 · `addToWaitlist` server action still accepts cross-tenant IDs.** `src/lib/actions/waitlist.ts:36` — v1 route + MCP tool were fixed with `assertOwnedRefs`, the action wasn't. **Pass:** action calls `assertOwnedRefs`; foreign clientId returns not-found and creates nothing. Test added.
- [x] **P2-14 · Duplicate dead review funnel is a booby trap.** `src/lib/actions/public-reviews.ts:54` + `src/app/review/[token]` + `src/lib/reviews/review-token.ts` — an unreachable second implementation that auto-publishes 1-star reviews with no rate limit. **Pass:** exactly one review-token module + page + action exist; the dead trio is deleted.
- [ ] **P2-15 · Billing gate only on dashboard render.** `src/app/(dashboard)/layout.tsx:86` — API v1, MCP, and server actions stay usable after cancellation. **GATED.** **Pass:** with a cancelled sub, mutating `/api/v1` and MCP calls return 402/403 (billing endpoints excepted).
- [ ] **P2-16 · Business-controlled social links rendered as raw hrefs (stored `javascript:` injection).** `src/app/book/[businessSlug]/client.tsx:1818`, validated only as `z.string()`. **Pass:** schema rejects/normalizes non-http(s) URLs; stored bad values sanitized.
- [ ] **P2-17 · Online Presence QR card is a fake non-scannable pattern; Download/Print always fail.** `src/components/settings/online-presence-tab.tsx:32`. **Pass:** renders a real QR of the persisted booking URL (reuse `/api/booking-qr`); download/print work.
- [ ] **P2-18 · Landing promises "Start free — no card" but Terms describe only a paid plan.** `src/components/landing/landing-page.tsx:375` vs `terms/page.tsx` §6. **Pass:** Terms describe the free-until-subscribe model, or the landing copy is corrected — the two agree.
- [x] **P2-19 · Clients-tab retention showed a hardcoded fake "+2.3% vs last month".** `src/components/reports/clients-tab.tsx` — replaced the fabricated delta with an honest label. Found during P2-3 fix.

---

## P3 — polish / hardening (batch late)

- [x] **P3-1 · Dashboard "Average Rating" shows raw float `4.4375`.** Verified in browser. **Pass:** rounded to 1 decimal (e.g. `4.4`).
- [ ] **P3-2 · Public booking exposes internal role labels ("admin"/"staff") to clients.** Verified in browser (staff step). **Pass:** public page shows a title/no role, not the internal enum.
- [ ] **P3-3 · Reports summary label hardcodes "vs last month" for all ranges.** `src/app/(dashboard)/reports/client.tsx:485`. **Pass:** label reflects the active range.
- [ ] **P3-4 · Onboarding `saveWorkingHours` deleteMany+createMany not transactional.** `src/lib/actions/onboarding.ts:140`. **Pass:** wrapped in `$transaction`.
- [ ] **P3-5 · Onboarding actions leak raw Prisma error strings to the toast.** `src/lib/actions/onboarding.ts:108/182/247/288`. **Pass:** generic user message; details logged server-side only.
- [ ] **P3-6 · "Template services added" toast fires even when zero added.** `src/app/onboarding/client.tsx:604`. **Pass:** honest wording on the zero case.
- [ ] **P3-7 · `sidebar-data` swallows errors and returns 200 with zeros.** `src/app/api/sidebar-data/route.ts:74`. **Pass:** non-200 or explicit degraded flag on error.
- [ ] **P3-8 · Dead unreachable businessId check in search route.** `src/app/api/search/route.ts:19`. **Pass:** dead block removed.
- [ ] **P3-9 · Review tokens never expire.** `src/lib/review-token.ts:111` — `iat` signed, never checked. **Pass:** tokens past a TTL (e.g. 30d) rejected.
- [ ] **P3-10 · Review single-use is check-then-insert, no DB constraint.** `src/lib/actions/reviews.ts:209`. **Pass:** partial unique on `reviews.appointment_id` (or transactional guard) blocks concurrent dupes.
- [ ] **P3-11 · Invitations: no DB single-use/uniqueness; revoke-then-create not transactional; revoke before email delivered.** `src/lib/actions/invitations.ts:84/295`. **Pass:** partial unique on pending invitations + transactional revoke/create.
- [ ] **P3-12 · Settings JSON read-modify-write clobbers concurrent tab saves.** `src/lib/actions/settings.ts:108` (+210/278, `booking-settings.ts:38`). **Pass:** atomic sub-key writes (`jsonb_set` or `$transaction` re-read).
- [ ] **P3-13 · Delete-account dialog validates against unsaved live-edited business name.** `src/app/(dashboard)/settings/client.tsx:854`. **Pass:** validates against persisted `Business.name`.
- [ ] **P3-14 · Address fields can't be cleared; empty strings blank siblings.** `src/lib/actions/settings.ts:50`. **Pass:** clearing persists; partial edits don't blank other fields.
- [ ] **P3-15 · Account "deletion" leaves tenant fully live (booking up, Connect untouched).** `src/lib/actions/account.ts:110`. **Pass:** sets a pendingDeletion flag disabling public booking, or the support email lists the Connect account id + open appointments.
- [ ] **P3-16 · Form template `serviceIds` not ownership-validated.** `src/lib/actions/forms.ts:49` + v1 forms routes. **Pass:** reject serviceIds not owned by the business.
- [ ] **P3-17 · Unbounded OAuth DCR growth (no cap/rate limit).** `src/app/api/oauth/register/route.ts:78`. **GATED.** **Pass:** rate-limited and/or client rows expire and are GC'd. (Folds into P1-13.)
- [ ] **P3-18 · Embed snippets: param name mismatch (`embedded=1` vs `embed=true`), never read; popup has no Esc/scroll-lock/stacking guard.** `src/app/embed.js/route.ts:41,56` + `online-presence-tab.tsx:93`. **Pass:** one canonical param the page consumes (or removed); popup closes on Esc, locks scroll, no stacking.
- [ ] **P3-19 · Cascade-delete of financial/history records.** `prisma/schema.prisma` — `Review.appointment` and `AppointmentProduct.appointment` are `onDelete: Cascade` (same bug class already fixed for Commission). **Pass:** changed to `SetNull`/`Restrict` with a migration; deleting an appointment preserves its product-sale lines and reviews.
- [ ] **P3-20 · US/USD/single-location/NYC-tax hardcoding.** `src/lib/stripe.ts` (currency `usd`, country `US`), tax constant 8.875%, `createPublicBooking` ignores location. **GATED partly (payments).** **Pass:** currency/country derive from `Business`; tax from settings; document the single-location assumption or honor location choice. (Founder's Dubai shop is the trigger case.)
- [ ] **P3-21 · Stale docs/comments.** `execution/bugs/BOOKING-CONCURRENCY-001.md` marked Open though shipped; cron route comment "~15-minute cadence" vs daily `vercel.json`; `CLAUDE.md`/`MEMORY.md` "no test framework". **Pass:** docs corrected to match code.

---

## Verified FINE (do not re-audit)

Onboarding auth/ownership + transactional step-1 + timezone serialization; notifications/search/sidebar tenancy scoping (session-derived); public booking write path (advisory lock + overlap + working-hours, timezone-anchored — **money flow verified end-to-end in browser + DB**); POS `recordCheckout` (server-authoritative prices, locks, commission invariant); Stripe webhook (signature, idempotency ledger, freshness watermark); 550 vitest tests + 15/15 invariants green; calendar drag/resize real.

## Deferred to their own phases
- **Phase 4:** Playwright E2E for the money flows (booking / owner-sees / reschedule-cancel / checkout).
- **Phase 5:** k6/autocannon stress test + ship P1-12 EXCLUDE constraint.
- **Phase 6:** security pass — P1-13 rate limiting, secrets scan, `/api/_debug/sentry-test` exposure, webhook re-verify, env-gated protections (Upstash/Sentry/TENANT_GUARD) documented.
- **Phase 7:** UI polish within Frost, then re-run full E2E.
