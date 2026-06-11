#!/usr/bin/env node
// Backup-restore proof (Phase 5D) — "a backup you've never restored is not a backup."
//
// Proves that a snapshot of a schema can actually be RESTORED and that the
// restored copy is byte-equivalent and healthy — not just that a backup exists.
//
//   npm run check:restore                          # rehearse against the dev schema
//   node scripts/verify-restore.mjs --source dev
//   node scripts/verify-restore.mjs --checksum-all # checksum every table, not just key ones
//   node scripts/verify-restore.mjs --source public --allow-production
//                                                  # post-launch prod rehearsal — privileged role only,
//                                                  # see docs/LAUNCH.md "Backup & Restore Verification"
//
// What it does (inside ONE database, no dump files required):
//   1. SNAPSHOT + RESTORE — copies every base table of the source schema into a
//      throwaway scratch namespace `restore_verify_<epoch>` using
//      `CREATE TABLE … (LIKE source INCLUDING ALL)` + `INSERT … SELECT`,
//      inserting in foreign-key-safe (parents-first) order derived from
//      pg_constraint. If a version-compatible pg_dump is on PATH it ALSO takes
//      a real `pg_dump --schema=<source> -Fc` artifact and verifies its table
//      of contents lists every table (the artifact an operator would use for a
//      cross-database restore). pg_dump cannot restore a schema under a new
//      name inside the same database, which is why the restore step itself is
//      pure SQL.
//   2. VERIFY — per table: row-count match. For the key money/tenant tables
//      (businesses, users, appointments, payments, commissions, clients,
//      services, staff) — or EVERY table with --checksum-all — an md5 checksum
//      over every column of every row must match between source and scratch.
//   3. HEALTH — the essential assertions from db-health-check.mjs and
//      orphan-sweep.mjs, run against the SCRATCH copy: every table has a
//      primary key, unique-index parity with source, no invalid indexes, and
//      catalog-driven orphan checks across ALL foreign-key relationships of
//      the source schema (a superset of the hand-written orphan sweep).
//   4. CLEANUP — the scratch namespace is dropped in a `finally`, success or
//      failure. There is intentionally no --keep flag.
//
// Scratch placement: the script first tries `CREATE SCHEMA restore_verify_<ts>`
// (what a privileged operator gets). The locked-down `sal_agent` role cannot
// create schemas (no CREATE privilege on the database — by design), so it
// falls back to prefixed tables `restore_verify_<ts>__<table>` inside the
// source schema it owns. The active mode is printed loudly.
//
// Fidelity notes (documented, not hidden): `LIKE … INCLUDING ALL` copies
// columns, defaults, PK/unique/check constraints and indexes, but NOT foreign
// keys, triggers, RLS policies or grants. Referential integrity is therefore
// proven by the catalog-driven orphan checks instead of FK DDL, and triggers
// not firing during the copy is exactly what a data restore wants. A real
// cross-database prod restore would use pg_dump/pg_restore (which does carry
// FKs/triggers/policies) — see docs/LAUNCH.md.
//
// SAFETY CONTRACT: the source schema's tables are only ever read. Every write
// statement is produced by builders that throw on any target outside the
// scratch namespace — enforced by tests/verify-restore-script.test.ts.
// Refuses to run when the URL or --source targets schema=public unless
// --allow-production is passed explicitly.
//
// Exit codes: 0 = restore proof passed, 1 = mismatch/guard refusal,
// 2 = unexpected database/connection error.

import { spawnSync } from "node:child_process"
import { unlinkSync, existsSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import pg from "pg"

const { Client } = pg

export const SCRATCH_PREFIX = "restore_verify_"

// Money/tenant-critical tables that always get the full checksum comparison.
export const KEY_TABLES = [
  "businesses",
  "users",
  "appointments",
  "payments",
  "commissions",
  "clients",
  "services",
  "staff",
]

const MAX_IDENTIFIER_LENGTH = 63

// --- Pure helpers (exported for tests) -----------------------------------------

export function quoteIdent(name) {
  if (typeof name !== "string" || name.length === 0) {
    throw new Error("Refusing to quote an empty identifier.")
  }
  if (name.includes("\0")) {
    throw new Error("Refusing to quote an identifier containing NUL.")
  }
  return `"${name.replaceAll('"', '""')}"`
}

export function isScratchName(name) {
  return typeof name === "string" && name.startsWith(SCRATCH_PREFIX)
}

// A write target is only legal when it lives inside the scratch namespace:
// either a table in a `restore_verify_<ts>` schema, or a table itself named
// `restore_verify_<ts>__<table>` (prefix mode).
export function assertScratchTarget(schemaName, tableName) {
  if (isScratchName(schemaName) || isScratchName(tableName)) return
  throw new Error(
    `SAFETY: refusing to write outside the scratch namespace: ${schemaName}.${tableName}`
  )
}

export function buildCreateLike(scratch, source) {
  assertScratchTarget(scratch.schema, scratch.table)
  return (
    `CREATE TABLE ${quoteIdent(scratch.schema)}.${quoteIdent(scratch.table)} ` +
    `(LIKE ${quoteIdent(source.schema)}.${quoteIdent(source.table)} INCLUDING ALL)`
  )
}

export function buildCopyInsert(scratch, source) {
  assertScratchTarget(scratch.schema, scratch.table)
  return (
    `INSERT INTO ${quoteIdent(scratch.schema)}.${quoteIdent(scratch.table)} ` +
    `SELECT * FROM ${quoteIdent(source.schema)}.${quoteIdent(source.table)}`
  )
}

export function buildDropScratchSchema(schemaName) {
  if (!new RegExp(`^${SCRATCH_PREFIX}\\d+$`).test(schemaName)) {
    throw new Error(`SAFETY: refusing to drop non-scratch schema: ${schemaName}`)
  }
  return `DROP SCHEMA IF EXISTS ${quoteIdent(schemaName)} CASCADE`
}

export function buildDropScratchTable(schemaName, tableName) {
  if (!new RegExp(`^${SCRATCH_PREFIX}\\d+__`).test(tableName)) {
    throw new Error(`SAFETY: refusing to drop non-scratch table: ${schemaName}.${tableName}`)
  }
  return `DROP TABLE IF EXISTS ${quoteIdent(schemaName)}.${quoteIdent(tableName)} CASCADE`
}

// Kahn-style topological sort: parents (referenced tables) first, so the copy
// order would satisfy FK constraints even in a restore that carried them.
// Self-references are ignored; cycles fall back to alphabetical order at the
// end (harmless here because the scratch copy carries no FK constraints).
export function topoSortTables(tables, edges) {
  const known = new Set(tables)
  const pendingParents = new Map(tables.map((t) => [t, new Set()]))
  for (const edge of edges) {
    if (!known.has(edge.child) || !known.has(edge.parent)) continue
    if (edge.child === edge.parent) continue
    pendingParents.get(edge.child).add(edge.parent)
  }

  const order = []
  const placed = new Set()
  let progressed = true
  while (placed.size < tables.length && progressed) {
    progressed = false
    for (const table of [...tables].sort()) {
      if (placed.has(table)) continue
      const blocked = [...pendingParents.get(table)].some((parent) => !placed.has(parent))
      if (!blocked) {
        order.push(table)
        placed.add(table)
        progressed = true
      }
    }
  }

  const cyclic = [...tables].filter((t) => !placed.has(t)).sort()
  return { order: [...order, ...cyclic], cyclic }
}

// Escape LIKE wildcards so the literal prefix (with `_`) matches itself only.
export function escapeLikePrefix(prefix) {
  return prefix.replace(/[\\%_]/g, (m) => `\\${m}`)
}

// --- Argument / environment handling --------------------------------------------

function parseArgs(argv) {
  const args = { source: null, checksumAll: false, allowProduction: false }
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === "--source") args.source = argv[++i]
    else if (arg.startsWith("--source=")) args.source = arg.slice("--source=".length)
    else if (arg === "--checksum-all") args.checksumAll = true
    else if (arg === "--allow-production") args.allowProduction = true
    else {
      console.error(`Unknown argument: ${arg}`)
      console.error("Usage: verify-restore.mjs [--source <schema>] [--checksum-all] [--allow-production]")
      process.exit(1)
    }
  }
  return args
}

// --- Database steps --------------------------------------------------------------

async function listTables(client, schema) {
  const { rows } = await client.query(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = $1 AND table_type = 'BASE TABLE'
     ORDER BY table_name`,
    [schema]
  )
  return rows.map((row) => row.table_name)
}

async function listForeignKeys(client, schema) {
  const { rows } = await client.query(
    `SELECT
       c.conname AS constraint_name,
       child.relname AS child_table,
       parent.relname AS parent_table,
       (SELECT array_agg(a.attname::text ORDER BY k.ord)
          FROM unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
          JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum)::text[] AS child_cols,
       (SELECT array_agg(a.attname::text ORDER BY k.ord)
          FROM unnest(c.confkey) WITH ORDINALITY AS k(attnum, ord)
          JOIN pg_attribute a ON a.attrelid = c.confrelid AND a.attnum = k.attnum)::text[] AS parent_cols
     FROM pg_constraint c
     JOIN pg_class child ON child.oid = c.conrelid
     JOIN pg_namespace cn ON cn.oid = child.relnamespace
     JOIN pg_class parent ON parent.oid = c.confrelid
     JOIN pg_namespace pn ON pn.oid = parent.relnamespace
     WHERE c.contype = 'f' AND cn.nspname = $1 AND pn.nspname = $1
     ORDER BY child.relname, c.conname`,
    [schema]
  )
  return rows.map((row) => ({
    constraint: row.constraint_name,
    child: row.child_table,
    parent: row.parent_table,
    childCols: row.child_cols,
    parentCols: row.parent_cols,
  }))
}

function refSql(ref) {
  return `${quoteIdent(ref.schema)}.${quoteIdent(ref.table)}`
}

async function createScratch(client, source, ts) {
  const schemaName = `${SCRATCH_PREFIX}${ts}`
  try {
    await client.query(`CREATE SCHEMA ${quoteIdent(schemaName)}`)
    return {
      mode: "schema",
      schema: schemaName,
      ref: (table) => ({ schema: schemaName, table }),
      describe: `dedicated scratch schema "${schemaName}"`,
    }
  } catch (error) {
    if (error?.code !== "42501") throw error
    // Permission denied: the locked-down role (sal_agent) cannot CREATE SCHEMA
    // — by design. Fall back to prefixed scratch tables inside the source
    // schema, which the role owns.
    const probe = await client.query(
      `SELECT has_schema_privilege(current_user, $1, 'CREATE') AS ok`,
      [source]
    )
    if (!probe.rows[0]?.ok) {
      throw new Error(
        `Current role can neither CREATE SCHEMA nor create tables in "${source}". ` +
          `Run with a role that owns the source schema, or (for prod) a privileged role — see docs/LAUNCH.md.`
      )
    }
    const tablePrefix = `${SCRATCH_PREFIX}${ts}__`
    return {
      mode: "prefix",
      host: source,
      tablePrefix,
      ref: (table) => ({ schema: source, table: `${tablePrefix}${table}` }),
      describe:
        `prefixed tables "${tablePrefix}<table>" inside schema "${source}" ` +
        `(role cannot CREATE SCHEMA — expected for the locked-down sal_agent role)`,
    }
  }
}

async function dropScratch(client, scratch) {
  if (scratch.mode === "schema") {
    await client.query(buildDropScratchSchema(scratch.schema))
    return `dropped schema "${scratch.schema}"`
  }
  const { rows } = await client.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = $1 AND tablename LIKE $2`,
    [scratch.host, `${escapeLikePrefix(scratch.tablePrefix)}%`]
  )
  for (const row of rows) {
    await client.query(buildDropScratchTable(scratch.host, row.tablename))
  }
  return `dropped ${rows.length} scratch table(s) "${scratch.tablePrefix}*" from "${scratch.host}"`
}

// Cleanup must survive a broken primary connection: retry once on a fresh one.
async function cleanupScratch(scratch, primaryClient, connectionString) {
  try {
    return { pass: true, detail: await dropScratch(primaryClient, scratch) }
  } catch {
    try {
      const retryClient = new Client({ connectionString })
      await retryClient.connect()
      const detail = await dropScratch(retryClient, scratch)
      await retryClient.end()
      return { pass: true, detail: `${detail} (via fresh connection)` }
    } catch (retryError) {
      const manual =
        scratch.mode === "schema"
          ? buildDropScratchSchema(scratch.schema)
          : `DROP TABLE IF EXISTS ${quoteIdent(scratch.host)}."${scratch.tablePrefix}<table>" CASCADE — for each leftover table`
      console.error(`\n❌ SCRATCH CLEANUP FAILED: ${retryError.message}`)
      console.error(`   Manual cleanup: ${manual}`)
      return { pass: false, detail: `cleanup failed — manual: ${manual}` }
    }
  }
}

const CHECKSUM_SQL = (ref) =>
  `SELECT count(*)::bigint AS n,
          md5(coalesce(string_agg(md5(t::text), '' ORDER BY md5(t::text)), 'empty')) AS digest
   FROM ${refSql(ref)} AS t`

// Optional: when a version-compatible pg_dump is on PATH, also prove a real
// dump artifact can be taken and that its table of contents is complete.
async function pgDumpArtifactCheck(client, source, tables, ts) {
  let version
  try {
    const probe = spawnSync("pg_dump", ["--version"], { encoding: "utf8" })
    if (probe.error || probe.status !== 0) throw new Error("not available")
    version = Number(/\(PostgreSQL\)\s+(\d+)/.exec(probe.stdout)?.[1])
  } catch {
    return {
      status: "skipped",
      detail: "pg_dump not found on PATH — pure-SQL snapshot used (supported fallback)",
    }
  }
  const serverMajor = Math.floor(
    Number((await client.query(`SELECT current_setting('server_version_num') AS v`)).rows[0].v) /
      10000
  )
  if (!Number.isFinite(version) || version < serverMajor) {
    return {
      status: "skipped",
      detail: `pg_dump ${version} cannot dump a PostgreSQL ${serverMajor} server — pure-SQL snapshot used (supported fallback)`,
    }
  }

  // Never put credentials in argv: pass connection pieces via libpq env vars.
  // Prefer DIRECT_URL — Supabase's pooled port can reject pg_dump.
  const url = new URL(process.env.DIRECT_URL || process.env.DATABASE_URL)
  const env = {
    ...process.env,
    PGHOST: url.hostname,
    PGPORT: url.port || "5432",
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: url.pathname.replace(/^\//, "") || "postgres",
    PGSSLMODE: url.searchParams.get("sslmode") || "require",
  }
  const file = join(tmpdir(), `sal-restore-proof-${ts}.dump`)
  try {
    const dump = spawnSync(
      "pg_dump",
      ["--schema", source, "--format=custom", "--no-owner", "--no-privileges", "--file", file],
      { env, encoding: "utf8" }
    )
    if (dump.status !== 0) {
      return { status: "skipped", detail: `pg_dump failed (${dump.stderr?.trim().split("\n")[0] ?? "unknown"}) — pure-SQL snapshot used` }
    }
    const list = spawnSync("pg_restore", ["--list", file], { env, encoding: "utf8" })
    if (list.status !== 0) {
      return { status: "failed", detail: "pg_restore --list could not read the dump artifact" }
    }
    const dumped = new Set(
      [...list.stdout.matchAll(/TABLE DATA \S+ (\S+) /g)].map((m) => m[1])
    )
    const missing = tables.filter((t) => !dumped.has(t))
    if (missing.length > 0) {
      return { status: "failed", detail: `dump artifact is missing table data for: ${missing.join(", ")}` }
    }
    return { status: "passed", detail: `pg_dump artifact contains TABLE DATA for all ${tables.length} tables` }
  } finally {
    if (existsSync(file)) unlinkSync(file)
  }
}

// --- Main -------------------------------------------------------------------------

async function main() {
  const startedAt = Date.now()
  const args = parseArgs(process.argv)
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    console.error("DATABASE_URL is required (export it, e.g. `set -a; source .env; set +a`).")
    process.exit(1)
  }

  let urlSchema = null
  try {
    urlSchema = new URL(connectionString).searchParams.get("schema")
  } catch {
    console.error("DATABASE_URL is not a parseable URL.")
    process.exit(1)
  }

  const source = args.source ?? process.env.DATABASE_SCHEMA ?? urlSchema ?? "dev"

  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(source)) {
    console.error(`Refusing to use invalid source schema name: ${source}`)
    process.exit(1)
  }
  if (isScratchName(source)) {
    console.error(`Refusing to rehearse from a scratch schema: ${source}`)
    process.exit(1)
  }

  const targetsProduction = source === "public" || /schema=public\b/.test(connectionString)

  console.log("TEST TARGET: backup-restore rehearsal (schema snapshot → scratch copy → verify → drop)")
  console.log(`DATABASE SCHEMA: ${source} (source) → ${SCRATCH_PREFIX}<epoch> (scratch)`)
  console.log(`LIVE PRODUCTION URL? ${targetsProduction ? "yes" : "no"}`)

  if (targetsProduction && !args.allowProduction) {
    console.error("\nRefusing to run against the public (production) schema without --allow-production.")
    console.error("Post-launch prod rehearsal needs a privileged role and a quiet window — see docs/LAUNCH.md.")
    process.exit(1)
  }

  const client = new Client({ connectionString })
  const summary = []
  let scratch = null
  let exitCode = 0

  try {
    await client.connect()
    const who = await client.query(
      `SELECT current_user AS usr, current_database() AS db, current_setting('server_version') AS ver`
    )
    console.log(
      `Connected as ${who.rows[0].usr} to database "${who.rows[0].db}" (PostgreSQL ${who.rows[0].ver})\n`
    )

    const tables = await listTables(client, source)
    if (tables.length === 0) {
      console.error(`No base tables found in schema "${source}" — nothing to rehearse.`)
      process.exit(1)
    }

    const foreignKeys = await listForeignKeys(client, source)
    const { order, cyclic } = topoSortTables(tables, foreignKeys)
    console.log(`Source: ${tables.length} tables, ${foreignKeys.length} foreign keys.`)
    if (cyclic.length > 0) {
      console.log(`Note: FK cycle detected among: ${cyclic.join(", ")} (appended alphabetically — scratch carries no FKs).`)
    }

    // Step 0 — optional real pg_dump artifact proof.
    const ts = Math.floor(Date.now() / 1000)
    const artifact = await pgDumpArtifactCheck(client, source, tables, ts)
    const artifactMark = { passed: "✅", failed: "❌", skipped: "⏭️ " }[artifact.status]
    console.log(`\n${artifactMark} pg_dump artifact: ${artifact.detail}`)
    summary.push({
      name: "pg_dump artifact",
      status: artifact.status === "failed" ? "FAILED" : artifact.status,
      detail: artifact.detail,
    })
    if (artifact.status === "failed") exitCode = 1

    // Step 1 — scratch namespace.
    scratch = await createScratch(client, source, ts)
    console.log(`\nScratch mode: ${scratch.describe}`)
    for (const table of tables) {
      const scratchName = scratch.ref(table).table
      if (scratchName.length > MAX_IDENTIFIER_LENGTH) {
        throw new Error(`Scratch name exceeds ${MAX_IDENTIFIER_LENGTH} chars: ${scratchName}`)
      }
    }

    // Step 2 — restore: structure + data, parents-first.
    console.log(`\nRestoring ${order.length} tables (FK-safe order)…`)
    const rowsCopied = new Map()
    for (const table of order) {
      const sourceRef = { schema: source, table }
      const scratchRef = scratch.ref(table)
      await client.query(buildCreateLike(scratchRef, sourceRef))
      const inserted = await client.query(buildCopyInsert(scratchRef, sourceRef))
      rowsCopied.set(table, inserted.rowCount ?? 0)
    }
    const totalRows = [...rowsCopied.values()].reduce((a, b) => a + b, 0)
    console.log(`Restored ${order.length}/${order.length} tables, ${totalRows} rows total.`)
    summary.push({
      name: "snapshot+restore",
      status: "passed",
      detail: `${order.length}/${tables.length} tables, ${totalRows} rows`,
    })

    // Step 3 — verify: row counts for every table, checksums for key tables.
    console.log(`\nVerifying row counts + checksums…`)
    let countMatches = 0
    let checksumMatches = 0
    let checksumTotal = 0
    const verifyFailures = []
    for (const table of tables) {
      const withChecksum = args.checksumAll || KEY_TABLES.includes(table)
      const sourceRef = { schema: source, table }
      const scratchRef = scratch.ref(table)

      if (withChecksum) {
        checksumTotal += 1
        const src = (await client.query(CHECKSUM_SQL(sourceRef))).rows[0]
        const scr = (await client.query(CHECKSUM_SQL(scratchRef))).rows[0]
        const countOk = Number(src.n) === Number(scr.n) && Number(scr.n) === rowsCopied.get(table)
        const digestOk = src.digest === scr.digest
        if (countOk) countMatches += 1
        if (digestOk && countOk) checksumMatches += 1
        if (countOk && digestOk) {
          console.log(`✅ ${table} — ${scr.n} rows, checksum match (${scr.digest.slice(0, 12)}…)`)
        } else {
          const why = !countOk
            ? `rows source=${src.n} scratch=${scr.n} copied=${rowsCopied.get(table)}`
            : `checksum source=${src.digest} scratch=${scr.digest}`
          console.log(`❌ ${table} — ${why}${!countOk ? " (did the source change mid-run?)" : ""}`)
          verifyFailures.push(`${table}: ${why}`)
        }
      } else {
        const src = (await client.query(`SELECT count(*)::bigint AS n FROM ${refSql(sourceRef)}`)).rows[0]
        const scr = (await client.query(`SELECT count(*)::bigint AS n FROM ${refSql(scratchRef)}`)).rows[0]
        const countOk = Number(src.n) === Number(scr.n) && Number(scr.n) === rowsCopied.get(table)
        if (countOk) {
          countMatches += 1
          console.log(`✅ ${table} — ${scr.n} rows`)
        } else {
          console.log(
            `❌ ${table} — rows source=${src.n} scratch=${scr.n} copied=${rowsCopied.get(table)} (did the source change mid-run?)`
          )
          verifyFailures.push(`${table}: count mismatch`)
        }
      }
    }
    summary.push({
      name: "row counts",
      status: countMatches === tables.length ? "passed" : "FAILED",
      detail: `${countMatches}/${tables.length} match`,
    })
    summary.push({
      name: "checksums",
      status: checksumMatches === checksumTotal ? "passed" : "FAILED",
      detail: `${checksumMatches}/${checksumTotal} ${args.checksumAll ? "tables" : "key tables"} match`,
    })
    if (verifyFailures.length > 0) exitCode = 1

    // Step 4 — health assertions against the scratch copy.
    console.log(`\nRunning health assertions against the scratch copy…`)

    let pkPresent = 0
    for (const table of tables) {
      const scratchRef = scratch.ref(table)
      const { rows } = await client.query(
        `SELECT count(*)::int AS n FROM pg_index i
         JOIN pg_class c ON c.oid = i.indrelid
         JOIN pg_namespace ns ON ns.oid = c.relnamespace
         WHERE ns.nspname = $1 AND c.relname = $2 AND i.indisprimary`,
        [scratchRef.schema, scratchRef.table]
      )
      if (rows[0].n > 0) pkPresent += 1
      else console.log(`❌ primary key missing in scratch copy of ${table}`)
    }
    summary.push({
      name: "primary keys",
      status: pkPresent === tables.length ? "passed" : "FAILED",
      detail: `${pkPresent}/${tables.length} scratch tables have a PK`,
    })
    if (pkPresent !== tables.length) exitCode = 1

    const UNIQUE_COUNT_SQL = `
      SELECT count(*)::int AS n FROM pg_index i
      JOIN pg_class c ON c.oid = i.indrelid
      JOIN pg_namespace ns ON ns.oid = c.relnamespace
      WHERE ns.nspname = $1 AND c.relname = $2 AND i.indisunique`
    let uniqueParity = 0
    for (const table of tables) {
      const scratchRef = scratch.ref(table)
      const src = (await client.query(UNIQUE_COUNT_SQL, [source, table])).rows[0]
      const scr = (await client.query(UNIQUE_COUNT_SQL, [scratchRef.schema, scratchRef.table])).rows[0]
      if (src.n === scr.n) uniqueParity += 1
      else console.log(`❌ unique-index parity broken for ${table}: source=${src.n} scratch=${scr.n}`)
    }
    summary.push({
      name: "unique indexes",
      status: uniqueParity === tables.length ? "passed" : "FAILED",
      detail: `${uniqueParity}/${tables.length} tables at parity with source`,
    })
    if (uniqueParity !== tables.length) exitCode = 1

    let invalidIndexes = 0
    for (const table of tables) {
      const scratchRef = scratch.ref(table)
      const { rows } = await client.query(
        `SELECT count(*)::int AS n FROM pg_index i
         JOIN pg_class c ON c.oid = i.indrelid
         JOIN pg_namespace ns ON ns.oid = c.relnamespace
         WHERE ns.nspname = $1 AND c.relname = $2 AND (NOT i.indisvalid OR NOT i.indisready)`,
        [scratchRef.schema, scratchRef.table]
      )
      invalidIndexes += rows[0].n
    }
    summary.push({
      name: "invalid indexes",
      status: invalidIndexes === 0 ? "passed" : "FAILED",
      detail: invalidIndexes === 0 ? "none in scratch copy" : `${invalidIndexes} invalid index(es)`,
    })
    if (invalidIndexes > 0) exitCode = 1

    // Catalog-driven referential integrity: for every FK of the source schema,
    // assert the restored data has zero orphans (MATCH SIMPLE semantics — rows
    // with any NULL FK column are exempt, like PostgreSQL itself).
    let fkClean = 0
    const fkFailures = []
    for (const fk of foreignKeys) {
      const child = scratch.ref(fk.child)
      const parent = scratch.ref(fk.parent)
      const notNull = fk.childCols.map((c) => `c.${quoteIdent(c)} IS NOT NULL`).join(" AND ")
      const joinOn = fk.childCols
        .map((c, i) => `p.${quoteIdent(fk.parentCols[i])} = c.${quoteIdent(c)}`)
        .join(" AND ")
      const { rows } = await client.query(
        `SELECT count(*)::bigint AS n FROM ${refSql(child)} c
         WHERE ${notNull} AND NOT EXISTS (SELECT 1 FROM ${refSql(parent)} p WHERE ${joinOn})`
      )
      if (Number(rows[0].n) === 0) fkClean += 1
      else {
        console.log(`❌ orphans after restore: ${fk.child}→${fk.parent} (${fk.constraint}): ${rows[0].n} row(s)`)
        fkFailures.push(fk.constraint)
      }
    }
    summary.push({
      name: "referential integrity",
      status: fkClean === foreignKeys.length ? "passed" : "FAILED",
      detail: `${fkClean}/${foreignKeys.length} FK relationships orphan-free in scratch`,
    })
    if (fkFailures.length > 0) exitCode = 1
    console.log(
      `Health: PKs ${pkPresent}/${tables.length}, unique parity ${uniqueParity}/${tables.length}, ` +
        `invalid indexes ${invalidIndexes}, FK orphan checks ${fkClean}/${foreignKeys.length} clean.`
    )
  } catch (error) {
    console.error(`\nUnexpected error: ${error instanceof Error ? error.message : error}`)
    exitCode = 2
  } finally {
    if (scratch) {
      const cleanup = await cleanupScratch(scratch, client, connectionString)
      summary.push({
        name: "scratch cleanup",
        status: cleanup.pass ? "passed" : "FAILED",
        detail: cleanup.detail,
      })
      if (!cleanup.pass && exitCode === 0) exitCode = 1
    }
    try {
      await client.end()
    } catch {}
  }

  const mark = { passed: "✅", FAILED: "❌", skipped: "⏭️ " }
  console.log("\n──────────── Restore verification summary ────────────")
  for (const row of summary) {
    console.log(`${mark[row.status] ?? "  "} ${row.name.padEnd(22)} ${row.detail}`)
  }
  console.log("───────────────────────────────────────────────────────")
  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1)
  if (exitCode === 0) {
    console.log(`\n✅ RESTORE PROOF PASSED — schema "${source}" snapshot restores cleanly (${seconds}s).`)
  } else {
    console.error(`\n❌ RESTORE PROOF FAILED — see mismatches above (${seconds}s).`)
  }
  process.exit(exitCode)
}

// Auto-run only when invoked directly (`node scripts/verify-restore.mjs`).
// When imported by tests, nothing connects or exits.
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
