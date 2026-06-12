# SAL — Production Readiness Report

**As of:** 2026-06-10 · **Target tenant:** Back Alive Barbershop · **Target date:** ~June 19, 2026
**Branch under review:** `harden/production-readiness` (PR #37), built on the deployed `main`.

> How to read this: each area is scored 1–10 with a one-line justification and a **proof** you can run.
> "No score without proof" — every claim below links to a test/command, not an opinion.

## Scorecard

| Area | Score | Justification | Proof |
| --- | :---: | --- | --- |
| **Tenant isolation** | 8/10 | App-layer wall **verified** across 10 `[id]` routes (68 IDOR tests, **no vulns**); every query scoped by `businessId`; no client-supplied tenant id. Missing: global fail-closed guard + RLS (fast-follow). | `npm test` → `tests/cross-tenant/*`; `docs/evidence/phase-1.md` |
| **Payments** | 8/10 | Webhook signature verified; inbound + outbound idempotency; out-of-order freshness guard; full subscription lifecycle; payment-intent idempotency added. Missing: disputes, reconciliation (fast-follow). | `tests/stripe-*.test.ts`, `tests/billing-gate.test.ts` |
| **Data integrity** | 7/10 | Double-booking impossible (advisory locks, soak-proven); **CRITICAL payroll-cascade fixed**; group oversell + checkout double-submit guarded. Pending: migration deploy + 2 unique constraints. | `tests/commission-payroll-integrity.test.ts`, `scripts/soak-test.mts`, `tests/group-oversell.test.ts` |
| **Reliability / observability** | 5/10 | Rate limiting (Upstash + fallback) + email timeout/retry hardened; errors sanitized; cron fail-closed; health check. **Missing: Sentry + structured logging** (the biggest remaining gap — founder is blind to prod errors without it). | `tests/rate-limit.test.ts`, `tests/email-resilience.test.ts` |
| **Test harness** | 7/10 | 495 tests, mock-Prisma, run under 2 timezones; soak harness for concurrency. Missing: one-command grouped runner + automated golden-path smoke. | `npm test`, `npm run test:tz` |
| **Launch ops** | 4/10 | Rollback pattern exists (git tag + Vercel promote + DB snapshot). **Missing: consolidated runbook + a PROVEN backup restore.** | (pending — Phase 5D) |
| **UI / UX** | 6/10 | Functional; the design system is genuinely distinctive (emerald/cream/glow, Sora/DM Sans); error/loading boundaries everywhere. Not redesigned; first-run zero-data states thin. | live app |

**Overall:** a strong, well-tested core with two concrete launch gaps to close (observability + launch-ops) and a set of fast-follows. **Not yet go**, but a short, well-defined distance from it.

## Known issues by severity

**SEV1 (blocks launch)**
- No production error monitoring (Sentry) — a failure in Back Alive's first days could go unseen. → Phase 4A.
- The commission payroll-cascade fix is committed but **not deployed to prod** (needs the orphan-sweep + migration window). → Phase 3A deploy.
- No automated end-to-end golden-path proof and no proven backup-restore. → Phase 5C/5D.
- Upstash env not yet set → rate limiting falls back to per-container in-memory (no global limit). → founder provisions Upstash.

**SEV2 (ship, fix in week 1)**
- Stripe disputes/chargebacks unhandled; no billing reconciliation job.
- Tenancy still fails-open on a *forgotten* clause (no global guard yet); no RLS second wall.
- Structured logging only on critical paths (full sweep pending).

**SEV3 (post-launch)**
- The two deferred unique constraints (payroll period, client email) — mitigated by app locks today.
- Phase 6 UI redesign; full a11y sweep.

## Launch decision

| BLOCKS launch (must be green first) | Ships now, fix after |
| --- | --- |
| Sentry wired + verified reporting | Disputes + reconciliation (week 1) |
| Commission migration deployed (post orphan-sweep) | Global Prisma guard prod-throw flip |
| Golden-path smoke green on dev schema | Supabase RLS (rehearsed) |
| Backup restore proven (restore-into-scratch) | Full structured-logging sweep |
| Upstash env set in Vercel | Phase 6 UI redesign |
| One live booking + cash-checkout smoke on prod | The 2 deferred unique constraints |

## Known gaps a human should still review

Things automated proof can't cover before launch — worth a senior engineer's / the founder's eyes:
1. **Resend deliverability** — DNS (SPF/DKIM/DMARC) on meetsal.ai so confirmation emails actually land (not just "attempted").
2. **Stripe identity verification** + flipping billing from test → live, and confirming Connect payout config.
3. **A live 2-tenant browser probe** — the mock tests prove scoping; a human clicking as two real tenants is the final cross-tenant check.
4. **Legal** — ToS/Privacy skim (§6 billing terms flagged previously).
5. **Relation-scoped tenancy models** (Staff, Commission, AppointmentService, …) — covered by per-resource tests + `assertOwnedRefs` today; RLS is what closes them at the DB level (fast-follow).
6. **Real load** — the soak harness proves no oversell at 50 concurrent on dev; production traffic shape is unverified.
