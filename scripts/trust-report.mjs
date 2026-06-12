#!/usr/bin/env node
/**
 * THE TRUST BOARD — a founder-readable health report. Run `npm run trust`.
 *
 * Answers "is the software actually OK?" by LOOKING, not by trusting an AI.
 * Writes docs/TRUST.md (green/red) and prints a one-line verdict.
 */
import { execFileSync } from "node:child_process"
import { existsSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { runInvariantBoard } from "./check-invariants.mjs"

const root = process.cwd()

// 1. Business-invariant board (runs the suite once).
let board
try {
  board = runInvariantBoard({ quiet: true })
} catch (e) {
  console.error(String(e.message || e))
  process.exit(2)
}

// 2. Fake-success watchlist count.
let fakeCount = 0
try {
  const out = execFileSync("node", ["scripts/check-fake-success.mjs"], { cwd: root, encoding: "utf8" })
  const m = out.match(/(\d+)\s+toast\.success/)
  fakeCount = m ? Number(m[1]) : 0
} catch { fakeCount = -1 }

// 3. Sacred zones present + observability wired.
const sacred = [
  ["Booking/availability engine", "src/lib/availability.ts"],
  ["Checkout single-writer", "src/lib/checkout/record-checkout.ts"],
  ["Tenancy primitives", "src/lib/api/ownership.ts"],
  ["Auth", "src/lib/auth.ts"],
  ["Stripe webhook", "src/app/api/stripe/webhook/route.ts"],
]
const sentryWired = existsSync(join(root, "sentry.server.config.ts"))
const rateLimitWired = existsSync(join(root, "src/lib/rate-limit.ts"))

const greens = board.rows.filter((r) => r.state === "GREEN").length
const overall = board.allGreen ? "🟢 HEALTHY" : "🔴 ATTENTION NEEDED"
const stamp = new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC"

const md = `# SAL Trust Board

**Overall: ${overall}** · generated ${stamp} · run \`npm run trust\` to refresh.

> How to read this: 🟢 = proven safe by an automatic test. 🔴 = needs attention.
> You do not need to read code — read this board.

## The numbers
- **Tests:** ${board.passedTests}/${board.totalTests} passing
- **Business rules proven (invariants):** ${greens}/${board.rows.length} green
- **Possible "fake button" candidates to review:** ${fakeCount < 0 ? "scan error" : fakeCount} (a watchlist, not necessarily bugs)
- **Error monitoring (Sentry):** ${sentryWired ? "🟢 wired" : "🔴 not wired"}
- **Abuse protection (rate limiting):** ${rateLimitWired ? "🟢 wired" : "🔴 not wired"}

## Business rules — each one a promise to your customers
| | Rule | What proves it |
| :--: | --- | --- |
${board.rows.map((r) => `| ${r.state === "GREEN" ? "🟢" : "🔴"} | ${r.label} | ${r.detail} |`).join("\n")}

## Sacred zones (a mistake here ends the business — change only with proof)
| | Zone | File |
| :--: | --- | --- |
${sacred.map(([label, file]) => `| ${existsSync(join(root, file)) ? "🟢" : "🔴"} | ${label} | \`${file}\` |`).join("\n")}

## What this board does NOT prove (needs a human / real infra)
- Real email deliverability (Resend DNS), real Stripe live charges + disputes, a live 2-tenant browser probe, real production load, and a proven backup-restore. See \`docs/PRODUCTION_READINESS.md\`.
`

writeFileSync(join(root, "docs/TRUST.md"), md)
console.log(`Trust board written to docs/TRUST.md`)
console.log(`${overall} — ${board.passedTests}/${board.totalTests} tests, ${greens}/${board.rows.length} rules green, ${fakeCount} fake-button candidate(s).`)
if (!board.allGreen) process.exit(1)
