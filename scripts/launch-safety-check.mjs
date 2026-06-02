#!/usr/bin/env node
// Launch safety check — the single "is it safe to ship?" gate.
//
// Runs the full pre-deploy suite in order and prints a clear pass/fail summary.
// Run this before promoting a build to production:  npm run check:launch
//
// Steps (in order): production env validation, lint, type-check, tests, build.
// Any failure stops the run non-zero so it can gate a deploy.
//
// Flags:
//   --skip-env    Skip the production env check (useful in CI, where prod
//                 secrets are intentionally absent — CI still runs lint/types/
//                 tests/build with throwaway env). See .github/workflows/ci.yml.

import { spawnSync } from "node:child_process"

const skipEnv = process.argv.includes("--skip-env")

/** @type {{ name: string, cmd: string, args: string[], optional?: boolean }[]} */
const steps = [
  { name: "Production env", cmd: "npm", args: ["run", "check:env"], optional: skipEnv },
  { name: "Lint", cmd: "npm", args: ["run", "lint"] },
  { name: "Type-check", cmd: "npm", args: ["run", "typecheck"] },
  { name: "Tests", cmd: "npm", args: ["run", "test"] },
  { name: "Build", cmd: "npm", args: ["run", "build"] },
]

const results = []
let failed = false

for (const step of steps) {
  if (step.optional) {
    results.push({ name: step.name, status: "skipped" })
    continue
  }
  if (failed) {
    // Don't keep going once something has failed — the first failure is the signal.
    results.push({ name: step.name, status: "not run" })
    continue
  }

  console.log(`\n▶ ${step.name}…`)
  const run = spawnSync(step.cmd, step.args, { stdio: "inherit", shell: process.platform === "win32" })
  if (run.status !== 0) {
    results.push({ name: step.name, status: "FAILED" })
    failed = true
  } else {
    results.push({ name: step.name, status: "passed" })
  }
}

const mark = { passed: "✅", FAILED: "❌", skipped: "⏭️ ", "not run": "⬜" }
console.log("\n──────────── Launch safety summary ────────────")
for (const r of results) {
  console.log(`${mark[r.status] ?? "  "} ${r.name.padEnd(16)} ${r.status}`)
}
console.log("───────────────────────────────────────────────")

if (failed) {
  console.error("\n❌ NOT safe to ship — fix the failing step above and re-run.")
  process.exit(1)
}
console.log(
  skipEnv
    ? "\n✅ Code checks passed (env check skipped). Run without --skip-env before a production deploy."
    : "\n✅ Safe to ship."
)
