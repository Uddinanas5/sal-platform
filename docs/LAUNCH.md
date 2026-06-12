# SAL Launch Operations

Operational runbooks that must be true **before** flipping the switch. Companion
docs: [INCIDENT_RUNBOOK.md](./INCIDENT_RUNBOOK.md) (what to do when prod is on
fire), [PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md) (scorecard),
[RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md) (per-release smoke test).

## Backup & Restore Verification (Phase 5D)

> **A backup you've never restored is not a backup.** This section covers what
> backups exist, how the restore proof works, and how to rehearse it — including
> against production after launch.

### 1. What protects the production `public` schema

Production data lives in the Supabase project's `public` schema (only the
deployed Vercel app connects to it). Two independent layers:

1. **Supabase managed backups** — Supabase takes automatic backups of the whole
   database; depending on plan this is daily snapshots and/or Point-in-Time
   Recovery (PITR).

   **FOUNDER-VERIFY in the Supabase dashboard (do not assume):**
   - [ ] **Database → Backups**: backups are listed and recent (within 24h).
   - [ ] Which plan tier is active, and whether **PITR** is enabled (PITR is a
         paid add-on; daily snapshots alone mean up to ~24h of data loss).
   - [ ] The **retention window** (how many days back you can restore).
   - [ ] How a restore is performed on the current plan (full-project restore vs
         restore-to-new-project) — read the dialog *before* the day you need it.

   These four facts are plan-dependent and can change; nothing in this repo can
   verify them. Check them once before launch and after any plan change.

2. **Manual snapshot schemas inside the same database** — copies made before
   risky operations:
   - `cleanup_backup_20260605` — full snapshot of `public` taken before the
     June 5 production cleanup (manifest: `~/sal-cleanup-dryrun.md`).
   - `prelaunch_backup_20260606` — snapshot taken June 6.
   - `rehearsal_jun6` — a June 6 restore-rehearsal copy (owned by `sal_agent`).

   These are convenient for surgical row recovery but are **not** disaster
   recovery: they live in the same database as production. If the database is
   lost, they are lost with it. Supabase's own backups are the real safety net.

### 2. The restore proof: `npm run check:restore`

`scripts/verify-restore.mjs` proves a schema snapshot actually restores:

```bash
set -a; source .env; set +a       # DATABASE_URL must be in the environment
npm run check:restore             # rehearses the dev schema (default)
npm run check:restore -- --checksum-all   # checksum every table, not just key ones
```

What it does, end to end:

1. **Snapshot + restore** — copies every base table of the source schema into a
   throwaway scratch namespace `restore_verify_<epoch>` (structure via
   `LIKE … INCLUDING ALL`, data via `INSERT … SELECT`, in FK-safe parents-first
   order derived from the catalog). If a version-compatible `pg_dump` is on
   PATH it also takes a real dump artifact and verifies its table of contents.
2. **Verify** — per-table row counts must match, and the eight money/tenant
   tables (`businesses`, `users`, `appointments`, `payments`, `commissions`,
   `clients`, `services`, `staff`) must match an md5 checksum computed over
   every column of every row (`--checksum-all` extends this to all tables).
3. **Health** — the essential `check:db` / orphan-sweep assertions run against
   the restored copy: every table has a primary key, unique-index parity with
   the source, no invalid indexes, and zero orphan rows across **all** foreign
   key relationships of the schema (catalog-driven).
4. **Cleanup** — the scratch namespace is always dropped, success or failure.

It prints the `TEST TARGET / DATABASE SCHEMA / LIVE PRODUCTION URL?` banner and
**hard-exits if the URL or `--source` targets `schema=public`** unless
`--allow-production` is passed (see §3).

Proven on 2026-06-11 against the `dev` schema, twice, all green (51 tables,
98 FK relationships, 51/51 checksums): see
[evidence/loop-3-verify-restore.md](./evidence/loop-3-verify-restore.md).

### 3. Rehearsing against production (AFTER launch only)

The local/agent `.env` connects as the locked-down **`sal_agent`** role, which
has **no privileges on `public` tables and cannot create schemas**. That is
correct and must stay that way: it makes it *impossible* for an agent or a
local mistake to touch production data — the same wall that keeps automated
testing safe also means the prod rehearsal needs a privileged credential.

To rehearse a production restore (quarterly, or before risky migrations):

1. Pick a **quiet window** (the checksum compares source vs copy; concurrent
   writes during the run will show up as a mismatch).
2. From a trusted machine, run with a **privileged connection string** (e.g.
   the `postgres` role from Supabase → Database → Connection string — enter it
   directly into the shell, never commit it or paste it into a chat):

   ```bash
   DATABASE_URL="<privileged-direct-connection-url>" \
     node scripts/verify-restore.mjs --source public --allow-production
   ```

3. The script creates a true scratch schema `restore_verify_<epoch>` (the
   privileged role can `CREATE SCHEMA`), restores all of `public` into it,
   verifies counts/checksums/health, and drops it — production tables are only
   ever **read**. Every write statement the script can emit is guarded to the
   scratch namespace (enforced by `tests/verify-restore-script.test.ts`).
4. Expect `✅ RESTORE PROOF PASSED`. Any ❌ is a real finding — treat it as an
   incident rehearsal finding, not noise.
5. This proves the *data* restores inside the database. Once per launch-phase,
   also rehearse the **Supabase-level** restore path (restore a backup into a
   *new* throwaway Supabase project) so the dashboard flow in §1 has been
   clicked through at least once. **FOUNDER-VERIFY: not yet done.**

### 4. Code rollback ≠ database rollback

The standard rollback (INCIDENT_RUNBOOK §1) is **code-only**:

- **Code**: Vercel → Deployments → previous known-good → *Promote to
  Production*. Instant, no rebuild. Git tags mark releases.
- **Database**: promoting an old deploy does **not** undo migrations or data
  written by the bad deploy. If a deploy ran a destructive migration or wrote
  bad rows, you also need §1's backups (PITR / snapshot restore) — and the
  blast-radius is bounded by how recent the backup is (FOUNDER-VERIFY the
  retention/PITR facts above).

Practical rule: **migrations forward-only, code freely rollback-able.** Keep
migrations additive (see `npm run check:migrations`), so promoting an older
deploy never requires a schema downgrade.

### 5. Known limits of the in-database proof (honest list)

- `LIKE … INCLUDING ALL` carries columns, defaults, PK/unique/check constraints
  and indexes — **not** FK constraints, triggers, RLS policies, grants, views
  or sequences. Referential integrity is proven by data-level orphan checks
  instead; a real cross-database restore would use `pg_dump`/`pg_restore`,
  which does carry them.
- The bundled Homebrew `pg_dump` 16 cannot dump the PostgreSQL 17 server, so
  the optional dump-artifact check currently reports `skipped` locally.
  Upgrading (`brew install libpq` / `postgresql@17`) enables it.
- The proof runs inside the same database. It does not prove the
  Supabase-dashboard restore path — that is the FOUNDER-VERIFY item in §3.5.
