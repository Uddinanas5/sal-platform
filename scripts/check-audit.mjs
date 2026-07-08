#!/usr/bin/env node
/**
 * GATE G.3 — no UNTRIAGED high/critical vulnerability in production dependencies.
 *
 * Runs `npm audit --omit=dev --json` and fails the build if any high/critical
 * advisory affects a package that is NOT in audit-allowlist.json. Every allowlist
 * entry is a documented accepted-risk with a remediation plan + review date, so a
 * NEW high/critical (a package not on the list) blocks the build, while the
 * already-triaged knowns don't. Standard `audit-ci`-style ignore-file pattern.
 *
 * Everything high/critical is PRINTED (accepted + unaccepted) so nothing is hidden.
 *
 * Run: `npm run check:audit`. Exit 0 = clean or all-triaged; exit 1 = a new
 * high/critical needs attention; exit 2 = the audit couldn't run.
 */
import { spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, "..")
const BLOCKING = new Set(["high", "critical"])

/**
 * Pure core: given a parsed `npm audit --json` object and the allowlist entries,
 * return the high/critical vulnerabilities whose package is NOT allowlisted.
 * @returns {{ package: string, severity: string }[]}
 */
export function collectUnaccepted(auditJson, allowlist) {
  const accepted = new Set((allowlist || []).map((a) => a.package))
  const out = []
  for (const [name, v] of Object.entries(auditJson?.vulnerabilities || {})) {
    if (!BLOCKING.has(v.severity)) continue
    if (accepted.has(name)) continue
    out.push({ package: name, severity: v.severity })
  }
  return out
}

/** All high/critical package names (for transparent reporting). */
export function collectBlocking(auditJson) {
  return Object.entries(auditJson?.vulnerabilities || {})
    .filter(([, v]) => BLOCKING.has(v.severity))
    .map(([name, v]) => ({ package: name, severity: v.severity }))
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const allowlist = JSON.parse(readFileSync(join(ROOT, "audit-allowlist.json"), "utf8")).advisories || []

  const res = spawnSync("npm", ["audit", "--omit=dev", "--json"], { cwd: ROOT, encoding: "utf8", maxBuffer: 20 * 1024 * 1024 })
  // npm audit exits non-zero WHEN vulns exist; stdout still holds the JSON.
  let audit
  try {
    audit = JSON.parse(res.stdout || "{}")
  } catch {
    console.error("check:audit: could not parse `npm audit --json` output")
    process.exit(2)
  }

  const acceptedNames = new Set(allowlist.map((a) => a.package))
  const blocking = collectBlocking(audit)
  const unaccepted = collectUnaccepted(audit, allowlist)

  const counts = audit.metadata?.vulnerabilities || {}
  console.log(`check:audit — prod deps: ${counts.critical || 0} critical, ${counts.high || 0} high, ${counts.moderate || 0} moderate, ${counts.low || 0} low`)

  if (blocking.length) {
    console.log("high/critical packages:")
    for (const b of blocking) {
      const accepted = acceptedNames.has(b.package)
      console.log(`  ${accepted ? "🟡 accepted" : "🔴 UNTRIAGED"}  ${b.package} [${b.severity}]`)
    }
  }

  // Warn on any allowlist entry whose review date has passed (re-triage due).
  const now = new Date()
  for (const a of allowlist) {
    if (a.reviewBy && new Date(a.reviewBy) < now) {
      console.warn(`  ⚠ allowlist review overdue for ${a.package} (reviewBy ${a.reviewBy}) — re-triage`)
    }
  }

  if (unaccepted.length) {
    console.error(`\n❌ ${unaccepted.length} UNTRIAGED high/critical advisory(ies) — fix, or add a documented entry to audit-allowlist.json:`)
    for (const u of unaccepted) console.error(`   ${u.package} [${u.severity}]`)
    process.exit(1)
  }

  console.log(`\n✅ no untriaged high/critical prod-dependency vulnerabilities (${allowlist.length} triaged & accepted).`)
  process.exit(0)
}
