# Loop Iteration 5 — Launch Polish Micro-Batch (Evidence)

Date: 2026-06-11
Branch: `loop/launch-polish` (cut from `origin/main` @ `36215c3`)
Scope: small, individually verified fixes from the iteration-4 discovery pass.

---

## Fix 1 — stats-card decimal rendering

**File:** `src/components/dashboard/stats-card.tsx`

**Before:** the count-up hardcoded a ×10 scale for any value containing `.` and rendered
`(count / 10).toFixed(1)` — so `"$0.00"` rendered as `$0.0` and `"$1,234.56"` as `$1234.6`
(wrong precision *and* lost thousands separator).

**After:** decimal places are derived from the numeric portion of the formatted value
(`(String(value).replace(/[^0-9.]/g, "").split(".")[1] ?? "").length` — the strip makes
suffixed values like `"4.8★"` safe), the count-up target is scaled by `10**decimals`, and the
render uses `toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })`.
For integers `decimals === 0`, so the target and rendering are byte-identical to before
(animation behavior unchanged).

**Verification** — no component/DOM test pattern exists (vitest is node-env, `tests/**/*.test.ts`
logic tests only), so per plan the math was verified with a node snippet mirroring the
component logic at animation end (count == target):

```text
"$0.00"        old: 0.0        new: 0.00
"$1,234.56"    old: 1234.6     new: 1,234.56
"$12,847"      old: 12,847     new: 12,847
"248"          old: 248        new: 248
"4.8"          old: 4.8        new: 4.8
1234           old: 1,234      new: 1,234
86             old: 86         new: 86
```

Decimals are now preserved exactly; all integer cases are unchanged.

## Fix 2 — looped blur panel in staff services tab

**File:** `src/components/staff/staff-services-tab.tsx` (line 109)

**Before:** the bare `<Card>` inside `categories.map()` defaulted to `variant="panel"`
(`glass-panel` = 44px backdrop blur), stacking one heavy blur per service category.

**After:** `<Card variant="tile">` (`glass-tile`, the lightweight surface intended for
repeated/nested cards). The single empty-state `<Card>` above the loop was intentionally
left as a panel (renders at most once).

**Verification:** `npm run typecheck` + `npm run lint` green; `tile` is a declared CVA
variant in `src/components/ui/card.tsx`.

## Fix 3 — `check:db` broken out of the box

**File:** `package.json`

**Before:** `"check:db": "node scripts/db-health-check.mjs"` — the script reads
`process.env.DATABASE_URL` but nothing loaded `.env`:

```text
$ node scripts/db-health-check.mjs
DATABASE_URL is required.
(exit 1)
```

**After:** `"check:db": "node --env-file=.env scripts/db-health-check.mjs"`.

```text
TEST TARGET: local check:db health script (read-only SQL checks)
DATABASE SCHEMA: dev
LIVE PRODUCTION URL? no

$ npm run check:db
PASS connection-health
PASS missing-primary-keys
PASS invalid-indexes
WARN duplicate-indexes: Possible duplicate indexes: public.users_auth_id_idx / users_auth_id_key; ... (idx/key pairs repeated across public/agents/dev/dev_claude/rehearsal_jun6 schemas)
PASS large-dead-tuples

1 database health warning(s) found.
(exit 1)
```

The script now runs and connects (previously it died before connecting). The remaining
exit-1 is a **pre-existing, genuine health finding** (Prisma `@@index` duplicating
`@unique` indexes across all schemas), not a script failure — left for a future pass since
fixing it requires schema/migration work, which is out of scope for this micro-batch.

## Fix 4 — Prisma 7.4.0 → 7.8.0 + audit-chain cleanup

**Files:** `package.json`, `package-lock.json`, `pnpm-lock.yaml`

- `prisma`, `@prisma/client`, `@prisma/adapter-pg`: `^7.4.0` → `^7.8.0` (latest 7.x).
- **Honest finding:** the bump alone does *not* clear the `@prisma/dev` → `@hono/node-server`
  audit chain as the discovery pass claimed. `prisma@7.8.0` pins `@prisma/dev@0.24.3`
  exactly, which pins vulnerable `@hono/node-server@1.19.11` exactly
  (GHSA-92pp-h63x-v22m, fixed in 1.19.13). The fixed pin (`^1.19.14`) only ships in
  `@prisma/dev@0.24.12`.
- So a scoped, dev-only override was added: `"overrides": { "@prisma/dev": "^0.24.12" }`
  (npm) and the matching `"pnpm": { "overrides": ... }` (pnpm). `@prisma/dev` is a
  transitive dependency of the `prisma` CLI only (the `prisma dev` local-DB feature, which
  this repo does not use) — zero runtime surface.
- The pnpm lockfile additionally still had the MCP SDK's copy locked at vulnerable
  `1.19.9`; `pnpm update --lockfile-only @hono/node-server` brought every instance to
  `1.19.14` (within the SDK's declared `^1.19.9` range — same resolution npm picked
  naturally).

**Both lockfiles updated and validated:**

- `npm install` → tree shows `prisma@7.8.0`, `@prisma/client@7.8.0`, `@prisma/adapter-pg@7.8.0`,
  `@prisma/dev@0.24.12`, all `@hono/node-server@1.19.14`.
- `pnpm install --lockfile-only` + `pnpm update --lockfile-only @hono/node-server`; lockfile
  validated with `pnpm install --frozen-lockfile --ignore-scripts` in a clean temp dir → exit 0.
- `npx prisma generate` → `Generated Prisma Client (7.8.0)`.

**Audit:** 21 vulnerabilities (12 moderate, 9 high) → **18 (9 moderate, 9 high)**.
The three prisma-chain advisories (`prisma`, `@prisma/dev`, `@hono/node-server`) are gone.
Remaining 18 are unrelated chains (eslint-8/next/resend transitive — out of scope).

## Fix 5 — Sentry config rename: SKIPPED

`sentry.client.config.ts` / `instrumentation-client.ts` do **not** exist on `main` —
the Sentry setup lives only on the harden branch. Per plan, this is deferred to the
PR #37 stack.

## Drive-by (environment-necessitated) — `.eslintrc.json` `"root": true`

`npm run lint` failed from the git worktree because ESLint walked up past the repo root and
found the parent checkout's `.eslintrc.json`, loading a second copy of `@next/next`
("Plugin @next/next was conflicted…"). Adding `"root": true` to the repo's `.eslintrc.json`
stops upward config traversal. This is a no-op in a standalone checkout (there is nothing
above to inherit) and makes `lint` deterministic from any nested/worktree checkout.

---

## Gate output

| Gate | Result |
| --- | --- |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 — "No ESLint warnings or errors" |
| `npm test` | exit 0 — 54 files, **397/397 passed** |
| `npm run build` | exit 0 — all routes built (Next 14.2.35) |
| `npm run check:db` | runs + connects; pre-existing duplicate-index WARN (see Fix 3) |

## Production Lighthouse — conversion-critical page

```text
TEST TARGET: http://localhost:3006/book/sal-salon (npm run build + next start, read-only page load)
DATABASE SCHEMA: dev
LIVE PRODUCTION URL? no
```

Server: `PORT=3006 npx next start` (3005 left alone — founder's dev server).
Page sanity: HTTP 200, `<title>Book with SAL Salon & Spa</title>`, warm TTFB ~0.9s.
Lighthouse 13.4.0, `--preset=desktop --only-categories=performance`, headless Chrome.

| Metric | Value |
| --- | --- |
| Performance score | **93** |
| First Contentful Paint | 0.3 s |
| Largest Contentful Paint | 0.6 s |
| Total Blocking Time | 0 ms |
| Cumulative Layout Shift | 0 |
| Speed Index | 2.7 s |

Server killed after the run.
