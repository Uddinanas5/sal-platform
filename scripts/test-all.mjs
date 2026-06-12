#!/usr/bin/env node
// One-command test harness — the single founder/auditor "run everything" command.
//
// Runs the full verification suite and prints a per-area green/red summary so you
// can see, at a glance, exactly what is healthy and what needs attention:
//   npm run test:all
//
// Unlike check:launch (which stops at the first failure to gate a deploy), this
// runs EVERY step regardless of earlier failures (continue-on-fail) so the summary
// is always complete. It exits non-zero if any *blocking* step failed. The
// fake-success / honesty scan is advisory (non-blocking) — it surfaces concerns
// but does not, by itself, fail the run.
//
// Steps run in order; each is a labeled area with pass/fail captured.
//
// Flags:
//   --with-db   Also run the golden-path smoke (scripts/golden-path.mts), which
//               needs a reachable DATABASE_URL targeting the dev/agents schema.
//               Off by default so test:all stays runnable without a database.

import { spawnSync } from "node:child_process"

const withDb = process.argv.includes("--with-db")

/**
 * @type {{ area: string, name: string, cmd: string, args: string[], blocking: boolean }[]}
 */
const steps = [
  { area: "Types", name: "Type-check", cmd: "npm", args: ["run", "typecheck"], blocking: true },
  { area: "Lint", name: "Lint", cmd: "npm", args: ["run", "lint"], blocking: true },
  { area: "Tests", name: "Unit tests", cmd: "npm", args: ["run", "test"], blocking: true },
  { area: "Timezone", name: "Timezone tests", cmd: "npm", args: ["run", "test:tz"], blocking: true },
  { area: "Invariants", name: "Business invariants", cmd: "npm", args: ["run", "check:invariants"], blocking: true },
  // Changed-migrations-only (the meaningful gate, matching CI). `--all` is an
  // audit mode that flags already-deployed historical migrations and is not a gate.
  { area: "Migrations", name: "Migration safety (changed)", cmd: "npm", args: ["run", "check:migrations"], blocking: true },
  { area: "Honesty", name: "Fake-success scan", cmd: "npm", args: ["run", "check:fake-success"], blocking: false },
]

if (withDb) {
  // Opt-in DB domain: the one-command Money-Loop proof (book → pay → ledger →
  // calendar) against the dev/agents schema. Blocking when requested — if the
  // golden path is broken, nothing else matters.
  steps.push({ area: "GoldenPath", name: "Golden-path smoke (dev DB)", cmd: "npm", args: ["run", "test:golden"], blocking: true })
}

const results = []
let blockingFailed = false
let advisoryFailed = false

for (const step of steps) {
  console.log(`\n▶ ${step.area} — ${step.name}…`)
  const run = spawnSync(step.cmd, step.args, { stdio: "inherit", shell: process.platform === "win32" })
  const passed = run.status === 0
  results.push({ area: step.area, name: step.name, blocking: step.blocking, passed })
  if (!passed) {
    if (step.blocking) blockingFailed = true
    else advisoryFailed = true
  }
}

console.log("\n──────────────── Test-all summary ────────────────")
for (const r of results) {
  const mark = r.passed ? "✅" : "❌"
  const tag = r.blocking ? "" : " (advisory)"
  console.log(`${mark} ${r.area.padEnd(12)} ${r.name}${tag}`)
}
console.log("──────────────────────────────────────────────────")

if (advisoryFailed) {
  console.log("\n⚠️  Honesty scan flagged concerns (advisory — does not block).")
}

if (blockingFailed) {
  console.error("\n❌ One or more blocking checks failed — see the ❌ rows above.")
  process.exit(1)
}

console.log("\n✅ All blocking checks passed.")
