# SAL Launch Readiness

**Date:** 2026-06-03 · **Prepared by:** automated launch-hardening pass (lead
engineer role). Honest assessment — what was verified, how, and confidence per
area. Read alongside `HANDOFF.md` (human/DB-dependent items) and
`docs/LAUNCH_READINESS_AUDIT.md` (the original gap analysis).

## How to read this

This pass ran in a sandbox with **no live Postgres**. So "verified" below means
one or more of: clean `next build`, clean `tsc --noEmit`, ESLint clean, the
33-test mock-Prisma/logic suite (run 3× consecutively, **no flakes**), and
manual code audit. It does **not** include live DB integration, real cross-tenant
probing, or a browser click-through — those are listed as "needs live verify" and
must be done on a preview/DB before paid launch (see `HANDOFF.md`).

**Overall:** Not yet certifiable for *paid public* launch, but in good shape for
a **free, no-payments beta** once the PRs below are merged + the live smoke test
and one booking click-through pass. The core flows are real and the dangerous
edges (money, tenant isolation, double-booking, prod-wipe) are closed or gated.

## Gate status (this pass, integration branch)

| Gate | Result |
|---|---|
| `next build` | ✅ pass |
| `tsc --noEmit` | ✅ clean |
| `next lint` | ✅ no errors/warnings |
| Test suite (`vitest`) | ✅ **33 passing, 3× consecutive, no flakes** |
| Committed secrets | ✅ none (verified) |

## Confidence by area

| Area | Confidence | Basis / caveat |
|---|---|---|
| **Multi-tenant isolation** | High | Audit confirmed every query/route scopes to the session business; the one financial IDOR (`stripe/dashboard-link`) is closed; 2 mock tests assert staff/services writes ignore body `businessId` + reject foreign FK ids. ⚠️ Live 2-tenant probing still recommended. |
| **Booking double-booking** | High | Advisory lock + atomic conflict-check on **all** write paths (create, v1 create, reschedule ×2, resize, recurring, group, public). Test guards `assertSlotAllowed`. ⚠️ Real concurrent-load test pending (DB). |
| **Public booking correctness** | Medium-High | Client now uses `/api/availability` (respects schedules/breaks/time-off/lead-time); server re-validates inside the lock (safety net). ⚠️ **Needs one live click-through** (most critical flow). |
| **Checkout integrity** | High | Prices recomputed server-side from DB; discount/empty-cart guards; loyalty on server amount; inventory decremented. 6 mock tests. |
| **Payments safety (beta)** | High | Online card + gift-card methods **disabled** (cash-only); webhook verifies signature on raw body; webhook silent-failure branches now logged. Online payments stay off until Stripe Connect verified. |
| **Data safety** | High | Seed guarded against non-localhost DBs; all migrations additive/nullable. ⚠️ Confirm no `admin@sal.app` on prod (HANDOFF). |
| **Email** | Medium | 6 transactional emails send; reply-to + from-domain fixed in code. ⚠️ DNS verify (SPF/DKIM/DMARC) + deliverability testing = founder (HANDOFF). |
| **Error handling / no leaks** | High | Public routes wrapped in `withSafeErrors` (generic 503, real cause logged); test guards no Prisma/stack leak. |
| **Production safety** | Medium | Incident runbook + monitoring guide written; webhook failures loud; CI gate blocks bad merges. ⚠️ Sentry/uptime/backups need founder accounts (HANDOFF). |
| **Release process** | High | `check:launch` gate + CI (lint/type/test/build) + release checklist on `main`. |

## What this pass shipped (PRs, all off `main`, each lint+type+build verified)

#22 audit doc · #23 launch-safety+CI · #24 beta money-safety (seed guard, real
reschedule, disable fake POS) · #25 hide unfinished features · #26 double-booking
locks (all paths) · #27 email reply-to + Stripe IDOR · #28 staff-break
persistence · #29 cancellation reasons · #30 test sweep (33 passing) · #31
availability-driven public booking + server re-validation · #32 monitoring +
runbook + loud webhook.

## Not done — and why (see HANDOFF.md for ready specs)

- **GAP-037 payment-tender breakdown** — needs a product decision + migration +
  DB verification.
- **P0-007 public self-service reschedule** — needs a live DB to prove no
  double-book.
- **P0-008 dashboard reschedule-email manage-URL** — small; deferred to avoid
  stacking edits on `appointments.ts`.
- **One-off time blocks** (founder request) — sizeable new model/feature;
  build-verifiable but deferred to keep PRs reviewable + because availability
  behavior wants DB verification.
- **SAL subscription billing** — deferred per founder (beta is free).
- **SMS** — intentionally off (compliance).

## Go / No-Go for a free no-payments beta

**Go, once:** all PRs merged in order (#23 first), the #29 migration deployed
(`prisma migrate deploy`), the live smoke test (`docs/RELEASE_CHECKLIST.md`)
passes, and **one real public-booking click-through** succeeds on a preview.
Payments and SMS stay off. Then it's safe to invite 1–3 friendly beta salons.

**No-Go for paid/public launch until:** SAL Payments fully tested end-to-end,
billing built (if charging), Sentry + backups confirmed, ToS/Privacy lawyer-
reviewed, and the live-verify items in `HANDOFF.md` are checked.
