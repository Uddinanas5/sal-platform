# REVIEW.md — What SAL Is and How Healthy It Really Is

*Written July 2, 2026, on branch `mission/production-hardening`. Produced by ten parallel subsystem readers plus a cross-checking critic (Phase 1 of MISSION.md). Plain English, written for the founder.*

---

## What this platform does

SAL is booking and business software for barbershops, sold at $1,500 setup + $497/month, live at meetsal.ai. A shop gets:

- **A public booking page** (meetsal.ai/book/their-name, plus a QR code) where clients book a barber, service, and time slot without creating an account, then get an email with a link to cancel or reschedule themselves.
- **An owner dashboard** with a Fresha-style calendar (drag to reschedule, drag to resize, multi-service appointments, recurring bookings, time blocks), a client book (CRM), staff scheduling, a service menu, retail inventory, reviews, email marketing, gift cards, memberships, and revenue/payroll reports.
- **A register (POS)**: cash / gift-card / loyalty checkout that writes staff commission, loyalty points, and inventory in one safe transaction. Card payments through Stripe exist in code but are deliberately switched off for beta.
- **Plumbing for the future**: a REST API, an MCP server (so an AI agent can run the shop), and OAuth — all built, mostly switched off in production.

## How it's structured

Next.js 14 (App Router) on Vercel; Supabase Postgres via Prisma 7 (prod data in the `public` schema, development in `dev`); NextAuth v5 email/password auth; Stripe for both the shop's card payments (Connect) and SAL's own subscription billing; Resend for email; Sentry for error monitoring; a daily Vercel cron for appointment reminders. ~50 database models, ~70 dashboard pages, ~49 REST endpoints, 79 test files (550 tests, all passing), and an unusually serious set of self-check scripts (15 business invariants that fail CI if a rule breaks or loses its proving test).

## Overall health: strong core, untrustworthy edges, unverified deployment

The June "AI slop" fear is now mostly outdated. The core money-and-booking machinery is genuinely well engineered — better than most human-built startups at this stage. Three problems remain, and they're different in kind:

1. **The edges lie.** A specific, identifiable set of features look real in the UI but do nothing (list below). An owner can sell memberships that never deplete and create deal codes nothing accepts.
2. **Several shipped protections are switched off.** Rate limiting, error monitoring, email, the tenant-data safety net — all built, all inert unless environment variables are set in Vercel, and the repo's own "trust report" can't tell the difference between wired and merely present.
3. **Everything is proven on dev, nothing on prod.** Every test, soak run, golden path, and restore rehearsal ran against the dev schema. There's no record that migrations were ever deployed to production, no live booking smoke test, no real restore rehearsal.

### Subsystem scorecard

| Area | Verdict | One-line reality |
|---|---|---|
| Public booking funnel | **Solid** | Hardened server-side, advisory-locked, timezone-safe; nothing fake. |
| Owner calendar & appointments | **Solid** | Best-engineered area; drag/resize real; multi-service rendering has real gaps. |
| Money (POS, Stripe, billing) | **Solid core, fragile seams** | POS checkout and webhook are excellent; online payments bypass the ledger entirely. |
| Auth & multi-tenancy | **Solid with a caveat** | Login/reset genuinely strong; tenant isolation is convention + tests, with no runtime or database backstop. |
| Data layer | **Solid** | Well-designed schema; missing a few integrity constraints the app compensates for in code. |
| CRM / back office | **Mixed** | CRUD is real; deals, membership sessions, and open-rate stats are decorative. |
| REST API / MCP / OAuth | **Solid auth, zero throttling** | All 49 routes authenticated; no rate limiting anywhere on the surface. |
| Ops & guardrails | **Strongest area** | Invariant board, golden path, restore proof — but several guards are env-gated off. |
| Docs / audit trail | **Rigorous but stale** | Newest layer trustworthy; older docs both understate fixes and overstate readiness. |

## The systemic risks (what actually threatens production)

These showed up independently across multiple readers — they're structural, not one-off bugs:

1. **Env-gated safety theater.** Upstash rate limiting, Sentry, Resend email, TENANT_GUARD, and cron secrets are all inert without Vercel env vars; `validate-env` checks none of them and the trust report marks them "wired" from file existence. The repo cannot distinguish *protected* from *looks protected*.
2. **Tenancy has no backstop.** One forgotten `businessId` filter in ~30 files leaks another shop's data. The fail-closed guard shipped but defaults off and is never wired to requests; no Postgres RLS. Verified cracks already exist: `getBundles` accepts any caller-supplied business ID with no auth; several report/review queries silently go cross-tenant when businessId is undefined.
3. **Double-booking prevention lives only in app code.** The advisory lock works and is tested, but every write path must remember to use it; the DB-level exclusion constraint is an unstarted P1 stub, and the system has never been load-tested.
4. **The money ledger diverges from reality at every seam.** Online Stripe payments skip commission/loyalty/inventory entirely; the API accepts "online" payments recorded as collected with no charge behind them; refunds never reverse commissions; growth stats are hardcoded 0; open rates permanently 0%.
5. **Multi-service appointments are second-class everywhere.** The calendar renders only the first service (other barbers' segments are invisible — inviting real double-bookings), reschedule moves only the lead staff, resize refuses, recurring silently books one service.
6. **US/USD/single-location hardcoding.** Stripe currency is hardcoded USD, Connect country US, tax rate NYC's 8.875%, and booking ignores location choice — the founder's own Dubai shop hits all four at once.
7. **Failures are silent by culture.** Emails fire-and-forget, cron errors never reach Sentry, rate-limit outages log nothing, the fake-success scanner is advisory-only.

## Honest list: features that look real but aren't

- **Deals/discount codes** — full create/edit UI; no checkout or booking flow accepts them.
- **Membership sessions & recurring billing** — sold and recorded; sessions never decrement, billing never runs.
- **Campaign open/click rates** — permanently 0%; tracking never implemented.
- **Dashboard growth percentages** — hardcoded to 0.
- **Services Edit/Duplicate** — visible "Coming soon."
- **Supplier Contact button** — toast only. **Client "Send Message"** — just opens your mail app.
- **4 optimistic success toasts** that claim success before/without the thing happening (receipt email, tag removal, subscription, onboarding templates).
- *(Honestly disabled, not fake: card payments at POS, SMS everywhere, MCP in prod.)*

## What prior audits covered vs. what this one still hasn't

Four audit generations exist (Jun 2 launch audit → Jun 3 hardening → Jun 7 security review → Jun 9–11 ultra-review + PR #37). Spot-checks confirm claimed fixes are real code. **Trust the newest layer** (docs/PRODUCTION_READINESS.md, docs/TRUST.md, docs/evidence/) and treat older docs as history — several are stale in both directions.

**Never yet examined by anyone** (Phase 2 must cover): onboarding wizard writes, settings + whole-account deletion, in-app notifications rendering, global search / sidebar-data API tenancy, the public review-request token funnel, staff invitation acceptance (a privilege-granting flow), the embeddable widget (`embed.js`), group appointments/resources/forms logic (one Jun 7 cross-tenant finding there was never re-verified), billing gate fail-open/fail-closed behavior, and the whole app in an actual browser — **this codebase has never been E2E- or load-tested.**

## Bottom line

SAL's engine room — booking writes, POS checkout, auth, webhook handling, the invariant harness — is production-grade and verifiably tested. What stands between this repo and "thousands of simultaneous users" is not the core code: it's the inert safety systems, the decorative features that can mislead paying owners, the unverified production deployment, the missing DB-level backstops, and the total absence of browser/load testing. That is exactly what Phases 2–7 of MISSION.md address, in that order.
