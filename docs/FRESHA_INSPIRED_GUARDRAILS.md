# Fresha-Inspired Guardrails

These are not copied Fresha product features. They are practical engineering habits inspired by Fresha's public tooling:

- `pgdoctor` -> keep the Postgres database healthy.
- `strong_migrations` -> catch dangerous schema changes before they reach production.
- `bunker` -> keep slow outside services out of database transactions.
- `api-tools` -> make API validation consistent instead of one-off per route.

## Commands

```bash
pnpm check:migrations
pnpm check:transactions
pnpm check:db
pnpm check:launch
```

## What Each Check Does

### `pnpm check:migrations`

Reviews new or changed Prisma migrations for risky SQL:

- dropping tables
- dropping columns
- renaming columns
- creating blocking indexes
- setting columns to `NOT NULL`
- adding function defaults

By default it only checks migrations changed in the current git diff. To review migration history:

```bash
pnpm check:migrations -- --all
```

If a risky migration is truly intentional, add a short acknowledgement inside the SQL:

```sql
-- sal:safety-assured reason this is safe
```

### `pnpm check:transactions`

Scans app code for external side effects inside `prisma.$transaction`, including:

- email sends
- Stripe calls
- `fetch`
- Resend calls

The rule of thumb is simple: write database rows inside the transaction, commit, then call outside services.

### `pnpm check:db`

Runs read-only Postgres health checks against the configured `DATABASE_URL`:

- idle transactions
- tables without primary keys
- invalid indexes
- duplicate indexes
- tables with high dead tuple counts

The script refuses to run against the `public` schema unless you pass:

```bash
pnpm check:db -- --allow-production
```

Use `dev` or `agents` for normal development checks.

## API Route Pattern

New v1 routes should use:

```ts
import { parseJsonBody, requireV1Context } from "@/lib/api/route-helpers"
```

This keeps auth, role checks, bad JSON handling, and Zod validation consistent across endpoints.
