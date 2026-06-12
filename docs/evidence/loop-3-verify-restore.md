# Loop 3 — Backup-restore proof (Phase 5D launch blocker)

**Date:** 2026-06-11
**Branch:** `loop/verify-restore` (off `harden/production-readiness`)
**Claim being proven:** "a backup you've never restored is not a backup" — a SAL schema
snapshot can be restored and the restored copy is byte-equivalent and healthy.

## What was added

- `scripts/verify-restore.mjs` + `npm run check:restore` — snapshot → restore into a
  throwaway `restore_verify_<epoch>` scratch namespace → per-table row counts +
  full-row md5 checksums → health assertions (PKs, unique-index parity, invalid
  indexes, catalog-driven orphan checks over ALL 98 FKs) → scratch always dropped
  in a `finally`.
- `tests/verify-restore-script.test.ts` — safety contract: every write statement the
  script can emit is guarded to the scratch namespace; DROP builders reject any
  non-scratch name; FK topo-sort handles self-refs and cycles. 12 tests.
- `docs/LAUNCH.md` — "Backup & Restore Verification" runbook (Supabase backups
  FOUNDER-VERIFY checklist, snapshot schemas, post-launch prod rehearsal recipe,
  code-rollback ≠ DB-rollback, honest limits).

## Environment facts observed live (not assumed)

- Connected as `sal_agent` to Supabase PostgreSQL **17.6**.
- `sal_agent` **cannot** `CREATE SCHEMA` (no CREATE on database) and **cannot read
  `public` tables** (`permission denied for table users`) — the prod lockdown is real.
  The script therefore fell back (by design, loudly) to prefixed scratch tables
  inside `dev`, which `sal_agent` owns.
- Homebrew `pg_dump` is 16.13 → cannot dump a PG 17 server → the optional dump-artifact
  check reports `skipped` and the pure-SQL snapshot path (the documented fallback) is used.
- Production guard proven: `node scripts/verify-restore.mjs --source public` printed
  `LIVE PRODUCTION URL? yes` and hard-exited (code 1) without connecting.

## Run 1 — `npm run check:restore -- --checksum-all` (exit 0)

```text

> sal-platform@0.1.0 check:restore
> node scripts/verify-restore.mjs --checksum-all

TEST TARGET: backup-restore rehearsal (schema snapshot → scratch copy → verify → drop)
DATABASE SCHEMA: dev (source) → restore_verify_<epoch> (scratch)
LIVE PRODUCTION URL? no
Connected as sal_agent to database "postgres" (PostgreSQL 17.6)

Source: 51 tables, 98 foreign keys.

⏭️  pg_dump artifact: pg_dump 16 cannot dump a PostgreSQL 17 server — pure-SQL snapshot used (supported fallback)

Scratch mode: prefixed tables "restore_verify_1781221186__<table>" inside schema "dev" (role cannot CREATE SCHEMA — expected for the locked-down sal_agent role)

Restoring 51 tables (FK-safe order)…
Restored 51/51 tables, 543 rows total.

Verifying row counts + checksums…
✅ _prisma_migrations — 7 rows, checksum match (884d1a9b1153…)
✅ api_keys — 1 rows, checksum match (9c00615f5b4b…)
✅ appointment_products — 0 rows, checksum match (a2e4822a9833…)
✅ appointment_services — 104 rows, checksum match (589aaf80bd6f…)
✅ appointments — 104 rows, checksum match (5e6365ad8bba…)
✅ audit_logs — 0 rows, checksum match (a2e4822a9833…)
✅ automated_messages — 0 rows, checksum match (a2e4822a9833…)
✅ business_hours — 7 rows, checksum match (40b9346ba60f…)
✅ businesses — 1 rows, checksum match (3beffe508087…)
✅ campaigns — 0 rows, checksum match (a2e4822a9833…)
✅ clients — 124 rows, checksum match (eca1d6f9d293…)
✅ commissions — 0 rows, checksum match (a2e4822a9833…)
✅ deals — 0 rows, checksum match (a2e4822a9833…)
✅ discounts — 0 rows, checksum match (a2e4822a9833…)
✅ form_submissions — 0 rows, checksum match (a2e4822a9833…)
✅ form_templates — 0 rows, checksum match (a2e4822a9833…)
✅ gift_cards — 6 rows, checksum match (b2201ce736f1…)
✅ group_participants — 0 rows, checksum match (a2e4822a9833…)
✅ inventory_transactions — 0 rows, checksum match (a2e4822a9833…)
✅ invoices — 0 rows, checksum match (a2e4822a9833…)
✅ locations — 1 rows, checksum match (62ecc0a4cf41…)
✅ loyalty_transactions — 0 rows, checksum match (a2e4822a9833…)
✅ membership_plans — 0 rows, checksum match (a2e4822a9833…)
✅ memberships — 0 rows, checksum match (a2e4822a9833…)
✅ notification_templates — 0 rows, checksum match (a2e4822a9833…)
✅ notifications — 0 rows, checksum match (a2e4822a9833…)
✅ oauth_access_tokens — 0 rows, checksum match (a2e4822a9833…)
✅ oauth_authorization_codes — 0 rows, checksum match (a2e4822a9833…)
✅ oauth_clients — 0 rows, checksum match (a2e4822a9833…)
✅ payments — 16 rows, checksum match (44db5bea2122…)
✅ payroll_periods — 0 rows, checksum match (a2e4822a9833…)
✅ product_categories — 5 rows, checksum match (5389f2222da2…)
✅ product_inventory — 20 rows, checksum match (c54412efbc45…)
✅ products — 20 rows, checksum match (68d3b4ee3a33…)
✅ resources — 0 rows, checksum match (a2e4822a9833…)
✅ reviews — 16 rows, checksum match (02665267870c…)
✅ service_bundles — 0 rows, checksum match (a2e4822a9833…)
✅ service_categories — 6 rows, checksum match (3506d2292c5f…)
✅ service_variations — 0 rows, checksum match (a2e4822a9833…)
✅ services — 18 rows, checksum match (66ac2f42a241…)
✅ staff — 7 rows, checksum match (f0b9959fe133…)
✅ staff_breaks — 0 rows, checksum match (a2e4822a9833…)
✅ staff_invitations — 0 rows, checksum match (a2e4822a9833…)
✅ staff_locations — 0 rows, checksum match (a2e4822a9833…)
✅ staff_schedules — 37 rows, checksum match (782b401bbf1d…)
✅ staff_services — 35 rows, checksum match (044ce640e02d…)
✅ staff_time_off — 0 rows, checksum match (a2e4822a9833…)
✅ stripe_events — 0 rows, checksum match (a2e4822a9833…)
✅ users — 8 rows, checksum match (75e943ff8de1…)
✅ visit_notes — 0 rows, checksum match (a2e4822a9833…)
✅ waitlist_entries — 0 rows, checksum match (a2e4822a9833…)

Running health assertions against the scratch copy…
Health: PKs 51/51, unique parity 51/51, invalid indexes 0, FK orphan checks 98/98 clean.

──────────── Restore verification summary ────────────
⏭️  pg_dump artifact       pg_dump 16 cannot dump a PostgreSQL 17 server — pure-SQL snapshot used (supported fallback)
✅ snapshot+restore       51/51 tables, 543 rows
✅ row counts             51/51 match
✅ checksums              51/51 tables match
✅ primary keys           51/51 scratch tables have a PK
✅ unique indexes         51/51 tables at parity with source
✅ invalid indexes        none in scratch copy
✅ referential integrity  98/98 FK relationships orphan-free in scratch
✅ scratch cleanup        dropped 51 scratch table(s) "restore_verify_1781221186__*" from "dev"
───────────────────────────────────────────────────────

✅ RESTORE PROOF PASSED — schema "dev" snapshot restores cleanly (166.6s).
```

## Run 2 — same command, repeated (exit 0)

```text

> sal-platform@0.1.0 check:restore
> node scripts/verify-restore.mjs --checksum-all

TEST TARGET: backup-restore rehearsal (schema snapshot → scratch copy → verify → drop)
DATABASE SCHEMA: dev (source) → restore_verify_<epoch> (scratch)
LIVE PRODUCTION URL? no
Connected as sal_agent to database "postgres" (PostgreSQL 17.6)

Source: 51 tables, 98 foreign keys.

⏭️  pg_dump artifact: pg_dump 16 cannot dump a PostgreSQL 17 server — pure-SQL snapshot used (supported fallback)

Scratch mode: prefixed tables "restore_verify_1781221359__<table>" inside schema "dev" (role cannot CREATE SCHEMA — expected for the locked-down sal_agent role)

Restoring 51 tables (FK-safe order)…
Restored 51/51 tables, 543 rows total.

Verifying row counts + checksums…
✅ _prisma_migrations — 7 rows, checksum match (884d1a9b1153…)
✅ api_keys — 1 rows, checksum match (9c00615f5b4b…)
✅ appointment_products — 0 rows, checksum match (a2e4822a9833…)
✅ appointment_services — 104 rows, checksum match (589aaf80bd6f…)
✅ appointments — 104 rows, checksum match (5e6365ad8bba…)
✅ audit_logs — 0 rows, checksum match (a2e4822a9833…)
✅ automated_messages — 0 rows, checksum match (a2e4822a9833…)
✅ business_hours — 7 rows, checksum match (40b9346ba60f…)
✅ businesses — 1 rows, checksum match (3beffe508087…)
✅ campaigns — 0 rows, checksum match (a2e4822a9833…)
✅ clients — 124 rows, checksum match (eca1d6f9d293…)
✅ commissions — 0 rows, checksum match (a2e4822a9833…)
✅ deals — 0 rows, checksum match (a2e4822a9833…)
✅ discounts — 0 rows, checksum match (a2e4822a9833…)
✅ form_submissions — 0 rows, checksum match (a2e4822a9833…)
✅ form_templates — 0 rows, checksum match (a2e4822a9833…)
✅ gift_cards — 6 rows, checksum match (b2201ce736f1…)
✅ group_participants — 0 rows, checksum match (a2e4822a9833…)
✅ inventory_transactions — 0 rows, checksum match (a2e4822a9833…)
✅ invoices — 0 rows, checksum match (a2e4822a9833…)
✅ locations — 1 rows, checksum match (62ecc0a4cf41…)
✅ loyalty_transactions — 0 rows, checksum match (a2e4822a9833…)
✅ membership_plans — 0 rows, checksum match (a2e4822a9833…)
✅ memberships — 0 rows, checksum match (a2e4822a9833…)
✅ notification_templates — 0 rows, checksum match (a2e4822a9833…)
✅ notifications — 0 rows, checksum match (a2e4822a9833…)
✅ oauth_access_tokens — 0 rows, checksum match (a2e4822a9833…)
✅ oauth_authorization_codes — 0 rows, checksum match (a2e4822a9833…)
✅ oauth_clients — 0 rows, checksum match (a2e4822a9833…)
✅ payments — 16 rows, checksum match (44db5bea2122…)
✅ payroll_periods — 0 rows, checksum match (a2e4822a9833…)
✅ product_categories — 5 rows, checksum match (5389f2222da2…)
✅ product_inventory — 20 rows, checksum match (c54412efbc45…)
✅ products — 20 rows, checksum match (68d3b4ee3a33…)
✅ resources — 0 rows, checksum match (a2e4822a9833…)
✅ reviews — 16 rows, checksum match (02665267870c…)
✅ service_bundles — 0 rows, checksum match (a2e4822a9833…)
✅ service_categories — 6 rows, checksum match (3506d2292c5f…)
✅ service_variations — 0 rows, checksum match (a2e4822a9833…)
✅ services — 18 rows, checksum match (66ac2f42a241…)
✅ staff — 7 rows, checksum match (f0b9959fe133…)
✅ staff_breaks — 0 rows, checksum match (a2e4822a9833…)
✅ staff_invitations — 0 rows, checksum match (a2e4822a9833…)
✅ staff_locations — 0 rows, checksum match (a2e4822a9833…)
✅ staff_schedules — 37 rows, checksum match (782b401bbf1d…)
✅ staff_services — 35 rows, checksum match (044ce640e02d…)
✅ staff_time_off — 0 rows, checksum match (a2e4822a9833…)
✅ stripe_events — 0 rows, checksum match (a2e4822a9833…)
✅ users — 8 rows, checksum match (75e943ff8de1…)
✅ visit_notes — 0 rows, checksum match (a2e4822a9833…)
✅ waitlist_entries — 0 rows, checksum match (a2e4822a9833…)

Running health assertions against the scratch copy…
Health: PKs 51/51, unique parity 51/51, invalid indexes 0, FK orphan checks 98/98 clean.

──────────── Restore verification summary ────────────
⏭️  pg_dump artifact       pg_dump 16 cannot dump a PostgreSQL 17 server — pure-SQL snapshot used (supported fallback)
✅ snapshot+restore       51/51 tables, 543 rows
✅ row counts             51/51 match
✅ checksums              51/51 tables match
✅ primary keys           51/51 scratch tables have a PK
✅ unique indexes         51/51 tables at parity with source
✅ invalid indexes        none in scratch copy
✅ referential integrity  98/98 FK relationships orphan-free in scratch
✅ scratch cleanup        dropped 51 scratch table(s) "restore_verify_1781221359__*" from "dev"
───────────────────────────────────────────────────────

✅ RESTORE PROOF PASSED — schema "dev" snapshot restores cleanly (167.7s).
```

## Post-run leftover sweep (clean)

```text
leftover scratch tables: (none)
leftover scratch schemas: (none)
dev base tables after both runs: 51 (expected 51)
```

## Bonus proof of the `finally` cleanup

An earlier development run failed mid-health-assertions (a `pg` driver array-parsing
bug, since fixed by casting `array_agg(...)::text[]`), and the summary still showed
`✅ scratch cleanup — dropped 51 scratch table(s)` — the try/finally drop works on the
failure path, not just the happy path.

## What I could NOT verify (founder-gated)

1. **Production restore rehearsal** — `sal_agent` has no `public` access (correct,
   by design). Running `--source public --allow-production` requires a privileged
   connection string that only exists in Vercel/Supabase. Recipe: docs/LAUNCH.md §3.
2. **Supabase managed-backup facts** — plan tier, PITR on/off, retention window,
   restore flow. Dashboard-only; marked FOUNDER-VERIFY in docs/LAUNCH.md §1.
3. **Supabase-level restore into a throwaway project** — the dashboard restore path
   has never been clicked through; marked FOUNDER-VERIFY in docs/LAUNCH.md §3.5.
