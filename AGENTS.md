# AGENTS.md

Guidance for ANY AI agent (Codex, Claude, etc.) working in this repository.
**Read the Constitution below before writing a single line. It overrides convenience, speed, and your own instincts.**

---

# THE SAL CONSTITUTION (read first, every session)

You have no memory of previous sessions. These rules are how SAL stays coherent
across amnesiac AI sessions. Follow them or your change will be blocked by CI.

## 1. What SAL is (the one thesis)
SAL helps appointment businesses (salons/barbershops/spas) **turn calendar time
into paid appointments, stop revenue leakage, and bring clients back.** The whole
product is ONE loop: **Book → Show up → Pay → Rebook.**

## 2. The Money-Loop test (apply to EVERY feature)
Before building anything, answer in one sentence:
> "Which link in the money loop (fill the calendar / prevent the no-show /
> capture the money / bring them back) does this strengthen, and what NUMBER will move?"

If the answer is "none" or "it's cool" — **do not build it.** No feature bloat.
Generic dashboards, chatbots, and clever extras are NOT the product.

## 3. Never ship a fake success (the #1 sin)
A control that shows "success" but does nothing is the most dangerous thing you
can create — it passes a demo and fails a real customer. **A feature is NOT done
because the UI works.** Every button/toggle/form must either (a) call a real
server action that truly persists/does what the label says, or (b) be visibly
disabled and labelled "Coming soon." A `toast.success(...)` with no awaited
server action behind it is a bug. (`npm run check:fake-success` scans for this.)

## 4. Sacred zones — extra proof, never re-implement
A mistake in these ends the business. Do NOT create a second implementation of
any of them; change them only with a named invariant test that fails-without:
- **Booking/availability engine** — `src/lib/availability.ts`, `src/lib/scheduling/`, `assertSlotAllowed`, the advisory locks in `src/lib/db/advisory-lock.ts`.
- **Checkout single-writer** — `src/lib/checkout/record-checkout.ts` (money math is server-authoritative; never trust client prices/totals).
- **Tenancy primitives** — `getBusinessContext`, `withV1Auth`, `assertOwnedRefs`, `scopedWhere`. Every query on tenant data is scoped by `businessId`.
- **Auth** — `src/lib/auth.ts`, `src/lib/auth.config.ts`, `src/middleware.ts`.
- **Stripe webhook** — `src/app/api/stripe/webhook/route.ts` (idempotent + signature-verified + freshness-guarded).
- **Migrations** — additive, schema-scoped, idempotent, with a `rollback.sql`. Never run against `public` (prod) without explicit founder approval.

## 5. One way to do each thing
Reuse the existing helper. Before adding a util/pattern, grep for an existing one.
Do not invent new architecture. If two ways exist, that is a bug to fix, not a choice.

## 6. The Evidence rule (definition of done)
"Done" = a named artifact a non-technical founder can point at: a passing test
named for the risk, a screenshot, a runbook output, or a number on the Trust
board. Risky changes leave a `docs/evidence/phase-X.md` ("what it is / what
proves it / what I could NOT verify"). The founder's question "what proves this
works?" must always resolve to a LINK, not a sentence.

## 7. Proof commands (run before claiming done)
- `npm run typecheck && npm run lint && npm test` — must be green.
- `npm run test:tz` — green under UTC AND America/New_York (timezone is a known trap).
- `npm run check:invariants` — the business-invariant board (cross-tenant, no-double-booking, money-authoritative, etc.) must be all-green.
- `npm run check:fake-success` — no new fake-success controls.
- `npm run trust` — regenerates the founder-readable Trust board (`docs/TRUST.md`).
- Sacred-zone or migration change → also run the relevant `check:migrations` / `check:transactions` and an adversarial review.

---

## Commands

```bash
pnpm dev              # Start dev server (Next.js)
pnpm build            # Generate Prisma client + build production
pnpm lint             # Run ESLint
pnpm prisma generate  # Regenerate Prisma client after schema changes
pnpm prisma db push   # Push schema changes to database
pnpm prisma migrate dev --name <name>  # Create a migration
npx tsx prisma/seed.ts # Seed the database
```

Test framework: **vitest** (`npm test`, `npm run test:tz`). Plus the safety checks
in §7 of the Constitution above (`check:invariants`, `check:fake-success`, `trust`).

## Testing & Database Safety

The Supabase database has three walled-off schemas. Keep testing in the correct lane:

| Schema | Who uses it | Purpose |
| --- | --- | --- |
| `public` | Deployed Vercel app only | Production. Real users/data only. Do not seed, reset, or stress test here. |
| `dev` | Local laptop development (`pnpm dev`) | Manual local testing with demo data. Safe to break/reset. |
| `agents` | VPS bots/agents | Automated signup, booking, checkout, and stress tests. Safe for fake users/bookings. |

Production was cleaned after backup. A snapshot exists in `cleanup_backup_20260605`; the cleanup manifest is at `~/sal-cleanup-dryrun.md`.

Before running any E2E, smoke, signup, booking, checkout, or stress test, print and verify:

```text
TEST TARGET:
DATABASE SCHEMA:
LIVE PRODUCTION URL? yes/no
```

Rules:

- Agents must test against localhost, the VPS preview, or the `agents` schema.
- Never run automated tests, seed scripts, smoke tests, or stress tests against the live production URL.
- Production is only for tiny real-user smoke checks after explicit approval.
- Use `dev`/`agents` to break things; use production only to confirm the live app works.
- The `sal_agent` database role is intended for agent testing and should not have production table access.
- Do not put production database credentials in local or agent `.env` files. Production credentials should live only in Vercel.

## Architecture

SAL Platform is a **multi-tenant salon/spa management SaaS** built with Next.js 14 App Router, TypeScript (strict mode), Prisma 7 + PostgreSQL (Supabase), and NextAuth.js 5 (JWT sessions, credentials provider).

### Data Flow Pattern

Server page (`page.tsx`) fetches data via Prisma queries (`src/lib/queries/`) → passes props to client component (`client.tsx` with `"use client"`) → user interactions call server actions (`src/lib/actions/`) → actions mutate DB and call `revalidatePath()`.

### Multi-Tenancy

Every protected operation calls `getBusinessContext()` from `src/lib/auth-utils.ts` which extracts `{ userId, businessId, role }` from the session. All queries and mutations must be scoped by `businessId`. The middleware redirects unauthenticated users to `/login` and users without a business to `/onboarding`.

### Key Directories

- `src/lib/actions/` — Server actions organized by feature (appointments, clients, services, staff, etc.). Return type: `{ success: true; data: T } | { success: false; error: string }`
- `src/lib/queries/` — Data fetching functions using Prisma, called from server components
- `src/lib/api/` — REST API v1 helpers: `auth.ts` (`withV1Auth()` for Bearer token + session auth), `response.ts` (standardized JSON responses)
- `src/lib/mcp/` — MCP server: `create-server.ts` (factory), `resources.ts` (14 read-only resources), `tools/` (57 tools across 15 files)
- `src/components/ui/` — Radix UI-based primitives (shadcn pattern) using CVA for variants
- `src/components/{feature}/` — Feature-specific components (calendar, clients, booking, etc.)
- `src/data/` — Mock data used as development fallbacks
- `prisma/schema.prisma` — Database schema; client generated to `prisma/generated/prisma/client/`

### Routing

- `src/app/(dashboard)/` — Protected dashboard routes (sidebar layout)
- `src/app/book/[businessSlug]/` — Public booking flow
- `src/app/api/` — Auth handler, sidebar-data, search, notifications, public booking widget
- `src/app/api/v1/` — REST API v1 (55+ endpoints, Bearer API key or session cookie auth)
- `src/app/api/mcp/` — MCP server endpoint (Streamable HTTP transport, stateless/serverless-compatible)
- Public pages: `/`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/terms`, `/privacy`

### REST API v1

All v1 endpoints use `withV1Auth()` from `src/lib/api/auth.ts` which accepts Bearer API key (`sal_<hex>`) or session cookie. Response format: `{ data: T }` for success, `{ error: { code, message } }` for errors. See `docs/API_ARCHITECTURE.md` for full endpoint reference.

### MCP Server

The MCP (Model Context Protocol) server at `/api/mcp` exposes 57 tools and 14 resources for AI assistants (Codex Desktop, Cursor, Windsurf, etc.). Uses `@modelcontextprotocol/sdk` with Streamable HTTP transport in stateless mode. Auth reuses the same `withV1Auth()` system. Each request creates a fresh `McpServer` instance with the authenticated context captured in tool closures. See `docs/MCP_SERVER.md` for full documentation.

### Auth

NextAuth.js 5 beta with credentials provider. `src/lib/auth.ts` has the full config; `src/lib/auth.config.ts` is the edge-compatible subset used by `src/middleware.ts`. Session includes custom claims: `userId`, `role`, `businessId`, `email`, `name`.

## Path Aliases

- `@/*` → `./src/*`
- `@/generated/prisma` → `./prisma/generated/prisma/client/client`

## Styling

Tailwind CSS with `class`-based dark mode. Brand colors use `sal-*` tokens (emerald green palette). Custom fonts: DM Sans (body), Sora (headings). Use `cn()` from `@/lib/utils` for className merging (clsx + tailwind-merge).

## Key Conventions

- Pages that need interactivity: server `page.tsx` fetches data, passes to a `client.tsx` component
- Forms use React Hook Form + Zod validation
- Toast notifications via Sonner
- Utility functions (formatting, CSV export, etc.) live in `src/lib/utils.ts`
- Prisma client is a singleton via `src/lib/prisma.ts` using PrismaPg adapter for pooled connections
- Icons from `lucide-react`
