#!/usr/bin/env node
/**
 * THE LAUNCH-READINESS GATE — the loop's external oracle.
 *
 *   node loop/gate.mjs            # run all no-DB checks, update the board, print verdict
 *   node loop/gate.mjs --smoke    # fast pulse (typecheck + lint) — used in SENSE each iteration
 *   node loop/gate.mjs --with-db  # also run DB-backed checks (golden path, soak, e2e, restore)
 *                                 #   REQUIRES a dev/agents-schema DATABASE_URL. NEVER prod.
 *
 * Design rules (see LOOP.md §2/§4):
 *  - Check STATES are flipped ONLY from observed command exit codes — never asserted.
 *  - This runner flips `state`; it must NEVER edit check definitions/severities. The
 *    board is owner-protected (CODEOWNERS). Gaming the board = editing this contract.
 *  - Verdict = PUBLIC-GA iff every P0 check is `pass`. One failing P0 ⇒ BETA-ONLY.
 *    A P0 that is still `pending`/`blocked` ⇒ verdict stays PENDING (not launch-ready,
 *    but not a regression either).
 *  - Exit code: 0 if no check FAILED; 1 if any check failed (a real regression).
 */
import { spawnSync } from "node:child_process"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, "..")
const BOARD = join(HERE, "feature_board.json")
const REPORT = join(HERE, "GATE-REPORT.md")

const args = process.argv.slice(2)
const SMOKE = args.includes("--smoke")
const WITH_DB = args.includes("--with-db")
// --only A.1,J.1  → run exactly these checks (bypasses the needsDb skip; if you
// name a check you intend to run it). Verdict still recomputes from all persisted states.
const ONLY = (() => { const i = args.indexOf("--only"); return i >= 0 && args[i + 1] ? args[i + 1].split(",").map((s) => s.trim()) : null })()
const TIMEOUT = 240_000

/** Run a shell command; return true on exit 0. */
function exec(cmd, cmdArgs) {
  const r = spawnSync(cmd, cmdArgs, { cwd: ROOT, encoding: "utf8", timeout: TIMEOUT, stdio: ["ignore", "pipe", "pipe"] })
  if (r.error) return { pass: false, note: String(r.error.message || r.error) }
  return { pass: r.status === 0, note: r.status === 0 ? "exit 0" : `exit ${r.status}` }
}
const file = (p) => ({ pass: existsSync(join(ROOT, p)), note: existsSync(join(ROOT, p)) ? `present: ${p}` : `missing: ${p}` })

/**
 * B.1 — no real Stripe secret committed to source control.
 *  (1) .env must be gitignored AND not tracked.
 *  (2) no live key (sk_/rk_live_) and no real-length test secret / whsec in tracked files.
 * Short placeholders like "sk_test_123" in fixtures are intentionally NOT flagged.
 */
function secretScan() {
  const ignored = spawnSync("git", ["check-ignore", ".env"], { cwd: ROOT, encoding: "utf8" }).status === 0
  const tracked = spawnSync("git", ["ls-files", "--error-unmatch", ".env"], { cwd: ROOT, encoding: "utf8" }).status === 0
  if (!ignored || tracked) return { pass: false, note: ".env is committed or not gitignored" }
  const g = spawnSync("git", ["grep", "-I", "-l", "-E", "(sk|rk)_live_[A-Za-z0-9]{20,}|sk_test_[A-Za-z0-9]{60,}|whsec_[A-Za-z0-9]{40,}"], { cwd: ROOT, encoding: "utf8" })
  if (g.status === 0 && g.stdout.trim()) return { pass: false, note: `secret-like string committed in ${g.stdout.trim().split("\n").length} file(s)` }
  return { pass: true, note: ".env gitignored+untracked; no live/real secret in tracked files" }
}

/**
 * checkId -> how to observe it. `needsDb` gates DB-backed checks behind --with-db.
 * Checks not listed here stay `pending` (they need an oracle we haven't built yet).
 */
const RUNNERS = {
  "B.1": { needsDb: false, run: () => secretScan() },
  "A.1": { needsDb: false, run: () => exec("npx", ["vitest", "run", "tests/cross-tenant"]) },
  "A.2": { needsDb: false, run: () => exec("npx", ["vitest", "run", "tests/cross-tenant/appointments-id.idor.test.ts"]) },
  "A.3": { needsDb: false, run: () => exec("npx", ["vitest", "run", "tests/query-businessid-guard.test.ts"]) },
  "B.2": { needsDb: false, run: () => exec("npx", ["vitest", "run", "tests/checkout-commission.test.ts"]) },
  "B.3": { needsDb: false, run: () => exec("npx", ["vitest", "run", "tests/billing-reconcile-replay.test.ts"]) },
  "B.4": { needsDb: false, run: () => exec("npx", ["vitest", "run", "tests/checkout-price-tampering.test.ts"]) },
  "C.1": { needsDb: false, run: () => file("sentry.server.config.ts") },
  "E.2": { needsDb: false, run: () => exec("npm", ["run", "check:migrations"]) },
  "F.2": { needsDb: false, run: () => file("src/lib/rate-limit.ts") },
  "H.3": { needsDb: false, run: () => exec("npx", ["vitest", "run", "tests/account-deletion.test.ts"]) },
  "J.2": { needsDb: false, run: () => exec("npm", ["run", "check:invariants"]) },
  "J.3": { needsDb: false, run: () => exec("npm", ["run", "check:fake-success"]) },
  // DB-backed (only under --with-db, against dev/agents schema — never prod):
  "F.1": { needsDb: true, run: () => exec("npx", ["tsx", "scripts/soak-test.mts"]) },
  "H.2": { needsDb: true, run: () => exec("npm", ["run", "check:restore"]) },
  "J.1": { needsDb: true, run: () => exec("npm", ["run", "test:golden"]) },
  "J.4": { needsDb: true, run: () => exec("npx", ["playwright", "test", "public-booking"]) },
  "J.5": { needsDb: true, run: () => exec("npx", ["playwright", "test", "owner-"]) },
}

function nowIso() {
  // Date.now is available at runtime here (this is a normal node script, not a workflow).
  return new Date().toISOString()
}

function main() {
  const board = JSON.parse(readFileSync(BOARD, "utf8"))

  // --smoke: fast health pulse only, does not touch the board verdict.
  if (SMOKE) {
    const tc = exec("npm", ["run", "typecheck"])
    const lint = exec("npm", ["run", "lint"])
    const ok = tc.pass && lint.pass
    console.log(`SMOKE: typecheck ${tc.pass ? "✅" : "❌"} · lint ${lint.pass ? "✅" : "❌"}`)
    process.exit(ok ? 0 : 1)
  }

  const at = nowIso()
  const ran = []
  let anyFailed = false

  for (const gate of board.gates) {
    for (const check of gate.checks) {
      const runner = RUNNERS[check.id]
      if (!runner) continue // no oracle yet → stays pending
      if (ONLY && !ONLY.includes(check.id)) continue // subset mode → skip unnamed checks
      if (runner.needsDb && !WITH_DB && !(ONLY && ONLY.includes(check.id))) continue // DB check skipped unless named
      if (check.state === "blocked") continue
      const res = runner.run()
      check.state = res.pass ? "pass" : "fail"
      check.evidence = `${res.note} @ ${at}`
      if (!res.pass) anyFailed = true
      ran.push({ gate: gate.id, id: check.id, severity: gate.severity, state: check.state, note: res.note })
      console.log(`${res.pass ? "✅" : "❌"} ${check.id.padEnd(5)} [${gate.severity}] ${gate.name} — ${res.note}`)
    }
  }

  // Verdict: PUBLIC-GA iff every P0 check is pass. Any P0 fail ⇒ BETA-ONLY.
  // Any P0 still pending/blocked ⇒ PENDING (not yet provable either way).
  const p0 = board.gates.filter((g) => g.severity === "P0").flatMap((g) => g.checks)
  const p0Fail = p0.some((c) => c.state === "fail")
  const p0Unproven = p0.some((c) => c.state === "pending" || c.state === "blocked")
  board.verdict = p0Fail ? "BETA-ONLY" : p0Unproven ? "PENDING" : "PUBLIC-GA"
  board.updatedAt = at
  writeFileSync(BOARD, JSON.stringify(board, null, 2) + "\n")

  // Report
  const count = (state) => board.gates.flatMap((g) => g.checks).filter((c) => c.state === state).length
  const md = `# Gate Report — ${board.verdict}

_generated ${at} · run \`node loop/gate.mjs${WITH_DB ? " --with-db" : ""}\`_

**Verdict: ${board.verdict}** — PUBLIC-GA requires every P0 check green.

- pass: ${count("pass")} · fail: ${count("fail")} · pending: ${count("pending")} · blocked: ${count("blocked")}
- checks run this pass: ${ran.length}${WITH_DB ? "" : " (no-DB set — add `--with-db` for golden path / soak / e2e / restore)"}

## P0 status (a single red here = not launchable)
${p0.map((c) => `- ${c.state === "pass" ? "🟢" : c.state === "fail" ? "🔴" : "⚪️"} ${c.id} — ${c.desc}`).join("\n")}

## This run
${ran.length ? ran.map((r) => `- ${r.state === "pass" ? "✅" : "❌"} ${r.id} [${r.severity}] ${r.note}`).join("\n") : "- (nothing runnable in this mode)"}
`
  writeFileSync(REPORT, md)
  console.log(`\nVERDICT: ${board.verdict}  ·  report → loop/GATE-REPORT.md`)
  process.exit(anyFailed ? 1 : 0)
}

main()
