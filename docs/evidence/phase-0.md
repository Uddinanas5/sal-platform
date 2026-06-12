# Phase 0 — Codebase Reconnaissance (Evidence)

Date: 2026-06-10. Method: 3 read-only exploration agents + 3 architect designs over the full repo. No code changed in this phase.

## Architecture map

- **Stack:** Next.js 14 App Router + TypeScript (strict), Prisma 7 + Postgres (Supabase), NextAuth v5 (JWT), Stripe (subscription billing + Connect "SAL Payments"), Resend email. Hosted on Vercel (Hobby tier → daily cron only).
- **Tenant key:** `businessId`. Established ONLY from the authenticated session/token via `getBusinessContext()` (`src/lib/auth-utils.ts`) for server actions/pages and `withV1Auth()` (`src/lib/api/auth.ts`) for the v1 REST API + MCP. Verified: **no endpoint trusts a client-supplied businessId** (grep of `req.json().businessId` / `searchParams.businessId` / `body.businessId` returns nothing; `tests/v1-services-cross-tenant.test.ts` codifies it).
- **Data flow:** server `page.tsx` (Prisma queries in `src/lib/queries/`) → `client.tsx` props → server actions (`src/lib/actions/`) → `revalidatePath`.
- **Surfaces:** dashboard `(dashboard)/*`; public booking `book/[businessSlug]` + `/api/availability` + `/api/bookings`; v1 REST `api/v1/*` (≈25 `[id]` routes); Stripe webhook `api/stripe/webhook`; cron `api/cron/dispatch` (CRON_SECRET fail-closed); MCP `api/mcp` (**gated OFF** via `MCP_ENABLED`).
- **Auth model:** credentials provider; global `User.role` (owner/admin/staff/client); middleware (`src/middleware.ts`) protects dashboard pages + gates v1/MCP on Bearer-or-session; server actions re-check via `getBusinessContext`. Role hierarchy in `src/lib/permissions.ts`.

## Already solid (verified)
- Tenancy scoping discipline (`getBusinessContext`/`withV1Auth`/`scopedWhere`/`assertOwnedRefs`); good `@@index` coverage on hot tenant tables.
- Stripe: webhook **signature verified before processing**; **inbound idempotency** (`StripeEvent` record-after-success); **out-of-order freshness guard** (`lastBillingEventAt` watermark) on all subscription/invoice writes; **full subscription lifecycle** mapped in `src/lib/billing/gate.ts`; refunds handled; outbound idempotency keys on subscription/customer creation.
- Booking: double-booking prevented via `pg_advisory_xact_lock` + `assertSlotAllowed`; `scripts/soak-test.mts` proves no oversell at 10/25/50 concurrent.
- Error hygiene: `src/lib/api/safe-handler.ts` sanitizes (no stack-trace/SQL leak); `/api/health`; cron fail-closed.
- Tests: 54 vitest files, mock-Prisma, run under `TZ=UTC` and `America/New_York`.

## Top 10 riskiest areas (ranked, with the plan item that addresses each)
1. **CRITICAL — `commissions.appointment_id` ON DELETE CASCADE** destroys payroll when an appointment is deleted. → Phase 3A (DONE this branch: → SET NULL).
2. **HIGH — tenancy fails OPEN on a forgotten clause** (no global Prisma guard). → Phase 1B (fail-closed `$extends`).
3. **HIGH — no Supabase RLS** (app-layer is the only wall). → Phase 1C (rehearsed fast-follow).
4. **HIGH — Stripe disputes/chargebacks unhandled** (silent money loss). → Phase 2B.
5. **HIGH — no billing reconciliation** (Stripe↔DB drift undetectable). → Phase 2C.
6. **CRITICAL ops — no Sentry / structured logging** (founder blind to prod errors). → Phase 4A/4C.
7. **HIGH — rate limiting is in-memory** (useless on serverless multi-container). → Phase 4B (Upstash).
8. **MED — `createPaymentIntent` lacked an idempotency key** (double-charge on retry). → Phase 2A (DONE this branch).
9. **MED — two deferred unique constraints** (payroll period, client email) mitigated only by app locks. → Phase 3C.
10. **MED — no automated E2E golden-path or proven backup restore.** → Phase 5C / 5D.

## Prompt corrections
- **No OpenClaw / WhatsApp / Telegram customer agent exists** in the repo. The only automation surface is the **gated-off MCP server**; SMS/Twilio is a stub. The prompt's "MCP + OpenClaw" item reduces to "keep MCP off; harden its tool ownership checks as a fast-follow."
- Pricing is **$1,500 setup + $497/mo**, not $500/mo.
- **CI has no database** → DB-level proofs (RLS, unique constraints, onDelete, real concurrency) require a new `pg-integration` CI job; until then they are manual-on-dev.

## What I could NOT verify in Phase 0
- Real cross-tenant behavior under a live 2-tenant browser session (only code-traced + mock-tested).
- That the app's Supabase DB role actually has BYPASSRLS (assumed from "no RLS + app works"); confirm before Phase 1C.
- Production data cleanliness (orphans/duplicates) — needs the Phase 3E orphan sweep run read-only against prod.
