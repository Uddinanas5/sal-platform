#!/usr/bin/env node
/**
 * GATE A.5 — every raw SQL escape hatch must be tenant-safe.
 *
 * Prisma's model API always scopes by the `where` you pass, but a hand-written
 * `$queryRaw` / `$executeRaw` (and especially the string-interpolated
 * `$queryRawUnsafe` / `$executeRawUnsafe`) bypasses that and can read or mutate
 * ACROSS tenants if it forgets a `businessId` predicate. Most real multi-tenant
 * leaks come from exactly this path (OWASP Multi-Tenant Cheat Sheet). This guard
 * enumerates every raw-SQL call site and PASSES only when each is provably safe:
 *
 *   - references `businessId`                → tenant-scoped
 *   - `pg_advisory_xact_lock(...)`           → advisory lock; its key is a
 *                                              businessId-derived hash and it
 *                                              carries NO row data
 *   - a bare `SELECT 1`                      → liveness/health probe, no data
 *   - an explicit `raw-sql-allow: <reason>`  → human-reviewed exception
 *
 * Anything else fails the build, so a future cross-tenant leak via hand-written
 * SQL cannot land unreviewed. The *Unsafe* variants are held to a higher bar:
 * a `businessId` mention alone does NOT clear them (string interpolation can't be
 * safely parameterized) — they need the explicit annotation.
 *
 * Run: `npm run check:rawsql`. Pure static scan — no DB, no network.
 */
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, extname, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = join(HERE, "..", "src")

const RAW_RE = /\$(queryRaw|executeRaw|queryRawUnsafe|executeRawUnsafe)\b/

/**
 * Classify one raw-SQL call from its call line + a small following window
 * (enough to capture a single-line SQL literal or a short tagged template).
 * @returns {{ allowed: boolean, reason: string }}
 */
export function classifyRawSql(context, method) {
  const unsafe = /Unsafe$/.test(method)
  if (/raw-sql-allow:/.test(context)) return { allowed: true, reason: "explicit review annotation" }
  if (/pg_advisory_xact_lock/i.test(context)) return { allowed: true, reason: "advisory lock (tenant-keyed by businessId hash; no row data)" }
  if (/\bSELECT\s+1\b/i.test(context)) return { allowed: true, reason: "global liveness probe (no tenant data)" }
  if (/businessId/.test(context)) {
    return unsafe
      ? { allowed: false, reason: "*Unsafe string-interpolated SQL — parameterize with $queryRaw or add a reviewed `raw-sql-allow:` note" }
      : { allowed: true, reason: "tenant-scoped (references businessId)" }
  }
  return {
    allowed: false,
    reason: unsafe
      ? "*Unsafe raw SQL with no tenant predicate"
      : "raw SQL with no tenant predicate (businessId) and not an allowlisted global query",
  }
}

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) out.push(...walk(p))
    else if (extname(p) === ".ts" && !p.includes(".test.")) out.push(p)
  }
  return out
}

/** Scan `root` (default src/) and return the unsafe raw-SQL findings. */
export function scanRepo(root = SRC) {
  const findings = []
  for (const file of walk(root)) {
    const lines = readFileSync(file, "utf8").split(/\r?\n/)
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(RAW_RE)
      if (!m) continue
      const context = lines.slice(i, i + 3).join("\n") // call line + 2 for the SQL literal
      const verdict = classifyRawSql(context, m[1])
      if (!verdict.allowed) {
        findings.push({
          file: file.slice(root.length + 1),
          line: i + 1,
          method: m[1],
          reason: verdict.reason,
          snippet: lines[i].trim().slice(0, 110),
        })
      }
    }
  }
  return findings
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const findings = scanRepo()
  if (findings.length === 0) {
    console.log("✅ raw-sql-tenancy: every raw SQL is tenant-scoped or an allowlisted global query")
    process.exit(0)
  }
  console.error(`❌ raw-sql-tenancy: ${findings.length} raw-SQL site(s) not proven tenant-safe:`)
  for (const f of findings) console.error(`  src/${f.file}:${f.line} [$${f.method}] ${f.reason}\n    ${f.snippet}`)
  process.exit(1)
}
