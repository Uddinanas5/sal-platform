# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

No test framework is configured.

## Architecture

SAL Platform is a **multi-tenant salon/spa management SaaS** built with Next.js 14 App Router, TypeScript (strict mode), Prisma 7 + PostgreSQL (Supabase), and NextAuth.js 5 (JWT sessions, credentials provider).

### Data Flow Pattern

Server page (`page.tsx`) fetches data via Prisma queries (`src/lib/queries/`) → passes props to client component (`client.tsx` with `"use client"`) → user interactions call server actions (`src/lib/actions/`) → actions mutate DB and call `revalidatePath()`.

### Multi-Tenancy

Every protected operation calls `getBusinessContext()` from `src/lib/auth-utils.ts` which extracts `{ userId, businessId, role }` from the session. All queries and mutations must be scoped by `businessId`. The middleware redirects unauthenticated users to `/login` and users without a business to `/onboarding`.

### Key Directories

- `src/lib/actions/` — Server actions organized by feature (appointments, clients, services, staff, etc.). Return type: `{ success: true; data: T } | { success: false; error: string }`
- `src/lib/queries/` — Data fetching functions using Prisma, called from server components
- `src/components/ui/` — Radix UI-based primitives (shadcn pattern) using CVA for variants
- `src/components/{feature}/` — Feature-specific components (calendar, clients, booking, etc.)
- `src/data/` — Mock data used as development fallbacks
- `prisma/schema.prisma` — Database schema; client generated to `prisma/generated/prisma/client/`

### Routing

- `src/app/(dashboard)/` — Protected dashboard routes (sidebar layout)
- `src/app/book/[businessSlug]/` — Public booking flow
- `src/app/api/` — Minimal API routes (auth handler, sidebar-data, search, notifications); business logic uses server actions instead
- Public pages: `/`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/terms`, `/privacy`

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
