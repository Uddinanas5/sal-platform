# SAL Platform — Production-Readiness & Security Audit Brief

**Engineering handoff for an independent audit.**

A multi-tenant salon/barbershop management SaaS handling client PII, staff payroll
data, and (post-beta) card payments. This brief orients an independent engineer to
run a full readiness & security audit: what to look at, what's already hardened, and
— candidly — what is known-open. **Treat every "done" claim as a hypothesis to verify
against the code, not as gospel.**

| | |
|---|---|
| **Stack** | Next.js 14 (App Router) · TypeScript (strict) · Prisma 7 · PostgreSQL |
| **Hosting** | Vercel + Supabase · live at meetsal.ai |
| **Auth** | NextAuth 5 (beta) · JWT sessions · credentials provider |
| **Current gate verdict** | `PENDING` (P0 infra/owner items open) |
| **Test state** | 666 unit tests green · 15/15 business invariants |
| **Under review** | branch `loop/engine-bootstrap` · PR #45 |
| **Brief version** | v1 · 2026-07-09 |

> ⚠️ **Data-handling rule for the auditor.** Production data lives in the Postgres
> `public` schema and **must not be touched**. All testing runs against the `dev` or
> `agents` schemas, or a local instance. Do **not** run seeds, migrations, load tests,
> or destructive queries against the production URL. Live payment keys exist only in
> Vercel production; use Stripe **test** keys everywhere else.

---

## 0. Executive brief for the auditor

The codebase has a strong, well-tested core and a recently and thoroughly hardened
authentication/authorization surface. The launch scoreboard is `PENDING` primarily on
**operational** gates (observability, backup/restore drills, deploy rollback, browser
E2E) and a small number of **known-open security items** catalogued in §5.

We are **not** asking you to rubber-stamp — we want an adversarial read: hunt for
tenant-isolation escapes, auth/session weaknesses, payment-flow correctness bugs, and
injection/PII exposure. The §5 risk register is our honest self-assessment; please
confirm, expand, or refute it, and add anything we missed.

**Requested output:** a prioritized findings report (Critical / High / Medium / Low)
with reproduction + remediation for each, and an explicit **go / no-go recommendation
for public GA** of a multi-tenant, PII-and-payments SaaS. See §10.

---

## 1. Audit objective & scope

### In scope
- **Multi-tenancy & authorization** — tenant isolation across all reads/writes/reports; the live-role model; IDOR surfaces.
- **Authentication & session lifecycle** — credentials login, JWT sessions, API keys, OAuth tokens, account lifecycle (suspend/delete).
- **Payments** — Stripe Connect integration, checkout/commission correctness, idempotency, webhook verification (test-mode; live is gated).
- **Data handling / PII** — client & staff PII exposure, deletion/retention, secrets management.
- **REST API v1** — authn/authz coverage, input validation, rate limiting.
- **Core business correctness** — booking/availability (double-booking), checkout math, timezone handling.
- **Operational readiness** — observability, backups/restore, deploy/rollback, dependency vulnerabilities.

### Out of scope (this pass)
- **The MCP / AI-assistant server** — hard-disabled in production (`MCP_ENABLED` gate returns 404). Known-open items exist here (see L-045); flag but deprioritize.
- **Live card payments & SMS** — intentionally gated off during beta.
- The marketing site and any VPS-hosted automation agents (separate infrastructure).

---

## 2. System architecture

Next.js 14 App Router. The dominant pattern: a server component (`page.tsx`) fetches
via Prisma query modules and passes props to a client component; user actions call
server actions (`src/lib/actions/*`) that mutate and revalidate. A parallel REST API
(`src/app/api/v1/*`) exposes the same domain to API-key / session callers.

| Layer | Notes | Key paths |
|---|---|---|
| Rendering & app | RSC pages + `"use client"` components; server actions for mutations; dashboard pages are `force-dynamic`. | `src/app/(dashboard)/*`, `src/lib/actions/*`, `src/lib/queries/*` |
| Data | Prisma 7 + PostgreSQL (Supabase) via PrismaPg pooled adapter; singleton client. | `prisma/schema.prisma`, `src/lib/prisma.ts` |
| Auth | NextAuth 5 (beta), 7-day JWT, credentials provider (bcrypt); edge-safe subset drives middleware. | `src/lib/auth.ts`, `src/lib/auth.config.ts`, `src/middleware.ts` |
| REST API v1 | 55+ endpoints; every route authenticates via `withV1Auth()` (Bearer API key, OAuth token, or session cookie). | `src/app/api/v1/*`, `src/lib/api/auth.ts` |
| Payments | Stripe Connect (destination charges, Stripe-hosted onboarding); webhooks verify signatures; live keys only in Vercel prod. | `src/lib/stripe.ts`, `src/app/api/stripe/*` |
| Booking engine | Availability from schedules/breaks/time-off/buffers with salon-timezone handling; double-booking guarded by a Postgres advisory lock at write time. | `src/lib/availability.ts`, `src/lib/db/advisory-lock.ts` |

### Database schemas (isolation model)
One Supabase Postgres instance, three walled-off schemas: `public` = production (real
data only), `dev` = local development, `agents` = automated tests. A locked-down
`sal_agent` DB role (no production table access) is used for non-prod work.

---

## 3. Security & multi-tenancy model

This is the area most recently and heavily reworked; understanding it is essential to
a useful audit.

### Tenancy & the live-role principle
Every protected operation resolves `{ userId, businessId, role }` via
`getBusinessContext()`, and all queries/mutations must be scoped by `businessId`.
Crucially, role and membership are **re-validated against the live DB on every request**
through `resolveBusinessRole(userId, businessId)` — never trusted from the 7-day JWT
claim. It returns the current role or `null` if the user is suspended/removed. All four
credential paths (session, OAuth token, API key, and login itself) were recently
unified onto this live check.

```
// src/lib/auth-utils.ts — single source of truth for "may this user act on this tenant now?"
resolveBusinessRole(userId, businessId): "owner" | "admin" | "staff" | null
  -> null if user.status !== "active"  (suspended/inactive)
  -> null if not (owns the business OR is active, non-deleted staff there)

// Role hierarchy — src/lib/permissions.ts
hasRole(role, min): staff(0) < admin(1) < owner(2)
```

### Authentication surface
- **Login** (`authorize()` in `src/lib/auth.ts`): bcrypt compare, per-email rate limit, failed-attempt lockout, and an active-status gate (rejects suspended accounts).
- **Sessions**: JWT, 7-day, custom claims (userId, role, businessId). **[VERIFY]** There is **no server-side session invalidation** — see L-034.
- **API keys** (`sal_…`): hashed at rest; validated + creator-liveness-checked in `withV1Auth()`; carry their own configured role.
- **OAuth 2.0 access tokens** (for the MCP surface): hashed, revocable, re-validated via `resolveBusinessRole`.

### Payments & secrets
- Checkout writes are single-writer transactions with idempotency keys and an already-paid guard; commission is ledgered with a rounding-tolerance invariant.
- Stripe webhooks verify signatures; the billing-gate mirrors the dashboard on the API.
- `.env` is gitignored/untracked; production credentials live only in Vercel; a repo secret-scan guard exists (`scripts/check-audit.mjs` / allowlist).

---

## 4. Recent hardening (context, not a substitute for your review)

The branch under review closed the authn/authz/data-exposure surface end-to-end.
Summarised so you can focus effort elsewhere — but please independently verify these
hold and that no regressions were introduced.

- **Stale-JWT-role class eliminated** — six dashboard read pages, three admin-only report/payroll/staff routes, the shared data layer (`getStaff`, sidebar-data), and the v1 staff REST endpoints all now gate on the live DB role; pay/revenue/PII stripped for non-admins by default.
- **Credential liveness unified** — login rejects non-active accounts; API keys die when their creator loses active membership; account deletion revokes API keys + OAuth tokens.
- **Payments** — an already-paid guard added to the (gated) online charge path to prevent a cross-hour double-charge before go-live.
- **Booking safety oracle** — metamorphic tests lock "adding a booking can only remove availability; a slot is never offered over an existing booking."

Prior merged hardening exists on the mainline (earlier PRs); this brief focuses on the
current open branch. The full per-change log lives in `loop/state.json` and
`loop/progress.md`.

---

## 5. Known-open risk register

Our honest self-assessment of what is **not** yet closed. Please validate severity, add
reproductions, and surface anything absent. Severity reflects our current read;
challenge it.

Legend: **CRIT** exploitable/launch-blocking · **HIGH** real risk, fix before GA ·
**MED** hardening · **LOW** latent/minor.

| ID | Issue | Sev | Status / notes |
|---|---|---|---|
| **L-034** | **Password reset does not invalidate existing sessions.** Stateless 7-day JWT; a stolen session/token keeps full access after the victim resets their password. | HIGH | Open. Needs a schema field (e.g. `sessionsValidAfter`) + reject-stale-token logic + "log out everywhere". OWASP ASVS 3.3. |
| **L-035** | **Login lockout enables targeted account-lockout DoS** (+ residual enumeration). No per-IP throttle on the login callback; an attacker can re-lock an account indefinitely. | HIGH | Open. Needs per-IP throttle (serverless-aware), backoff/CAPTCHA over hard-lock, reset counter after lockout expiry. |
| **L-022** | **Dependency vulnerabilities.** Triaged high-severity advisories (Next.js + transitive deps) pending remediation. | HIGH | Open. Version bump + regression run. **Please re-run `npm audit` / SCA and confirm current exposure.** |
| **RL-1** | **Rate limiter is in-memory (module-level map).** Ineffective across serverless instances; applied to a subset of actions, not all ~38 API routes. | HIGH | Open (architectural). Decision needed: shared store (e.g. Upstash) vs documented limitation. `src/lib/rate-limit.ts`. |
| **BK-1** | **No DB-level exclusion constraint on bookings.** Double-booking is prevented by an application advisory lock only; no `btree_gist` EXCLUDE as defense-in-depth. | MED | Open. Advisory lock covers the app path; verify no write path bypasses it. |
| **L-037** | **Registration is an account-enumeration oracle** — distinct "already exists" response, per-email-only throttle. | MED | Open. Uniform response and/or per-IP cap; email verification before creation. |
| **L-038** | **Login / password-reset timing side-channel** leaks account existence. | LOW | Open. Dummy bcrypt on no-user branch; fire-and-forget reset email. |
| **L-041** | **Online charge guard is COMPLETED-only** — two PENDING PaymentIntents can co-exist across hours (narrow race). | LOW | Latent (online payments off). Needs pending-intent reuse + stale-pending expiry at go-live. |
| **L-045** | **MCP staff tools** return commission + PII (incl. full user row) without an admin gate. | LOW | Latent — MCP disabled in prod. Close (select-list + admin gate) before enabling. |
| **OPS** | **Operational gaps:** no browser E2E suite; no staging rollback drill; no automated restore-from-backup drill; structured logging/alerting incomplete. | MED | Open. Non-code / infra. **Primary blockers to the GA verdict.** |

IDs prefixed `L-` map to the internal backlog (`loop/backlog.json`) with fuller notes
and file:line references.

---

## 6. Test & verification strategy

- **Unit / integration:** Vitest, ~90 test files, **666 passing**. Notable suites: cross-tenant IDOR (`tests/cross-tenant/*`), membership revocation, checkout idempotency, DST/timezone write paths, and metamorphic availability relations.
- **Business invariants:** a 15-rule board (`scripts/check-invariants.mjs`) runs `tsc --noEmit` + the full suite and fails on any type error or failing test.
- **Launch gate battery:** categories A–J (tenant isolation, payments, observability, deploy, capacity, security, DR, functional E2E). Runner: `node loop/gate.mjs`; verdict currently `PENDING`.
- **Gaps to note:** no Playwright/browser E2E; no load/soak harness in CI; mutation testing not yet wired.

> **Suggested auditor validation:** don't trust the green suite alone. Spot-check that
> tenant-scoping tests actually assert zero cross-tenant rows (not just 200s), and that
> the metamorphic/booking tests are non-vacuous. Consider a short property-based or
> fuzzing pass on availability + checkout math.

---

## 7. Running it locally

```bash
# install & generate the Prisma client
pnpm install
pnpm prisma generate

# point at a DEV/AGENTS schema or a local Postgres — NEVER production
# .env: DATABASE_URL=...?schema=dev   STRIPE_*=sk_test_...

pnpm dev                 # run the app
npm test                 # full Vitest suite (666)
npm run test:tz          # suite under UTC + NY timezones
npm run check:launch     # pre-ship guard battery
node loop/gate.mjs       # launch-readiness scoreboard (A–J)
```

Before any signup/booking/checkout/stress test, print and confirm the target:
`TEST TARGET` / `DATABASE SCHEMA` / `LIVE PRODUCTION URL? yes/no`. The answer to the
last must be **no**.

---

## 8. Areas to scrutinize (auditor checklist)

- [ ] **Tenant isolation completeness.** Grep for any Prisma query/mutation/report missing a `businessId` scope, or accepting an id without a tenant check (IDOR). Confirm reports/analytics enforce role, not just tenant.
- [ ] **Session lifecycle (L-034).** Confirm the 7-day JWT cannot be invalidated server-side; assess real-world impact of a stolen token post-password-reset and post-role-change.
- [ ] **Auth abuse (L-035, L-037, L-038).** Login lockout DoS, registration/timing enumeration, and whether rate limits actually hold in a serverless deployment (RL-1).
- [ ] **Payment correctness.** Webhook signature verification & replay handling; idempotency across retries; commission/tax/tip math; the COMPLETED-only guard (L-041) at go-live.
- [ ] **Booking concurrency (BK-1).** Try to force a double-booking around the advisory lock; check every create/reschedule path takes it; evaluate the missing DB EXCLUDE constraint.
- [ ] **Input validation & injection.** Zod coverage on all mutating routes/actions; any raw SQL; SSRF via user-supplied URLs (social links, webhooks); stored-XSS on public booking pages.
- [ ] **PII & data lifecycle.** Client/staff PII exposure across API + RSC payloads; deletion/retention (does "delete" actually anonymize?); secret handling & logs.
- [ ] **Dependencies (L-022).** Fresh SCA / `npm audit`; transitive CVEs; supply-chain posture.
- [ ] **Operational readiness (OPS).** Observability, backup/restore validation, deploy rollback, and end-to-end (browser) coverage of the money flows.

---

## 9. Assumptions & boundaries

- Beta posture: **live card payments and SMS are gated off**; the MCP/AI server is disabled. Findings in those areas are "fix-before-enable," not live exposure.
- Single-region deployment on Vercel serverless functions + Supabase Postgres; no self-managed infra.
- Threat model prioritizes: cross-tenant data access, auth/session compromise, payment manipulation, PII leakage. Physical/insider threats are out of scope.
- Internal backlog IDs (`L-###`) and the loop harness (`loop/*`) are automation bookkeeping; treat `loop/feature_board.json`, `loop/gate.mjs`, and `CODEOWNERS` as frozen references.

---

## 10. Requested deliverable

- **Prioritized findings** (Critical / High / Medium / Low), each with: description, reproduction, affected files, and concrete remediation.
- **Confirmation / refutation** of the §5 register, with severity adjustments and anything we missed.
- **A go / no-go recommendation** for public GA, with the minimum set of must-fix items to reach "go."
- Optionally: a re-audit checklist we can run ourselves after remediation.

**Key files to start from:** `src/lib/auth.ts`, `src/lib/auth-utils.ts`,
`src/lib/api/auth.ts`, `src/lib/permissions.ts`, `src/lib/availability.ts`,
`src/lib/checkout/record-checkout.ts`, `src/app/api/v1/*`, `src/app/api/stripe/*`,
`prisma/schema.prisma`, `src/middleware.ts`.

---

*Prepared for independent review · SAL Platform · v1 · 2026-07-09 · gate verdict PENDING.*
*Several figures (endpoint counts, CVE specifics, deployment details) are drawn from
project documentation and should be re-verified against the live repo during the audit.*
