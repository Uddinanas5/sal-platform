#!/usr/bin/env node
/**
 * BUSINESS-INVARIANT BOARD ("fitness functions").
 *
 * Each invariant is a rule the business depends on, mapped to the test(s) that
 * PROVE it. This runs the suite once and reports a founder-readable green/red
 * board. A red (failing OR unproven) invariant fails the build — so an AI agent
 * cannot quietly break a sacred guarantee and still merge.
 *
 * Run: `npm run check:invariants`
 * Add an invariant: add an entry below + the test that proves it.
 */
import { execFileSync } from "node:child_process"
import { readFileSync, rmSync, mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

// id · plain-English label · why it matters · test-file substrings that prove it
const INVARIANTS = [
  { id: "no-cross-tenant-read", label: "One salon can't see another's data", why: "A cross-tenant leak ends the business", match: ["cross-tenant/", "group-a-tenant-authz", "group-security-access-control", "staff-cross-tenant", "v1-services-cross-tenant", "memberships-queries-scoping", "visit-notes-cross-tenant", "reports-staff-cross-tenant", "ownership-assert-refs"] },
  { id: "tenant-guard-fail-closed", label: "A forgotten tenant filter is caught, not leaked", why: "The fail-closed backstop for cross-tenant queries", match: ["tenant-guard"] },
  { id: "no-double-booking", label: "Two clients can't take the same slot", why: "Double-booking is the core booking failure", match: ["booking-safety-waitlist", "group-c-booking-limits", "group-oversell"] },
  { id: "money-server-authoritative", label: "Prices/tax come from the server, not the browser", why: "A client must never set their own price", match: ["checkout-price-tampering"] },
  { id: "checkout-records-commission", label: "Every sale records staff commission/payroll", why: "Silent $0 payroll is a real past bug", match: ["checkout-commission"] },
  { id: "payroll-survives-deletion", label: "Deleting an appointment never wipes payroll", why: "A cascade once destroyed commission rows", match: ["commission-payroll-integrity"] },
  { id: "no-double-charge", label: "A retry can't charge a card twice", why: "Double-charging a client is unacceptable", match: ["stripe-create-payment-intent-idempotency"] },
  { id: "webhook-idempotent", label: "Stripe can replay events without corrupting state", why: "Stripe retries and reorders by design", match: ["stripe-webhook-idempotency", "stripe-subscription-webhook"] },
  { id: "billing-gate-correct", label: "Unpaid salons are gated correctly (no false lockout)", why: "Wrong gating loses money or locks out payers", match: ["billing-gate"] },
  { id: "timezone-correct", label: "Times are right in the salon's timezone", why: "A UTC bug once shifted a salon by 4-5h", match: ["scheduling-timezone", "availability-timezone", "timezone-write-paths"] },
  { id: "auth-denies-unauthed", label: "No session = no data, no writes", why: "Auth boundary must hold on the server", match: ["session-expiry-denies"] },
  { id: "no-pii-to-sentry", label: "Error reports never leak client data/secrets", why: "Observability must not become a data leak", match: ["sentry-scrub"] },
  { id: "logs-never-leak", label: "Logs never leak secrets/PII", why: "Structured logs must redact tokens/emails/cards", match: ["structured-logging"] },
  { id: "email-never-breaks-request", label: "A slow email never breaks a booking/checkout", why: "Email is best-effort, must not throw", match: ["email-resilience"] },
  { id: "rate-limit-enforced", label: "Login/booking are rate-limited (abuse protection)", why: "Brute-force + spam protection", match: ["rate-limit"] },
]

// Run the suite once and score every invariant. Returns { rows, allGreen,
// totalTests, passedTests }. Reusable by the Trust report (no auto-run on import).
export function runInvariantBoard({ quiet = false } = {}) {
  const root = process.cwd()
  const dir = mkdtempSync(join(tmpdir(), "sal-inv-"))
  const outFile = join(dir, "vitest.json")
  if (!quiet) console.log("Running the test suite to score each invariant...\n")
  try {
    execFileSync("npx", ["vitest", "run", "--reporter=json", `--outputFile=${outFile}`], {
      cwd: root,
      stdio: ["ignore", "ignore", quiet ? "ignore" : "inherit"],
    })
  } catch {
    // vitest exits non-zero when any test fails — we still parse the report.
  }
  let report
  try {
    report = JSON.parse(readFileSync(outFile, "utf8"))
  } catch {
    rmSync(dir, { recursive: true, force: true })
    throw new Error("Could not read the vitest JSON report. Is vitest installed?")
  }
  rmSync(dir, { recursive: true, force: true })

  const files = (report.testResults || []).map((r) => ({
    name: String(r.name || "").replace(root + "/", ""),
    ok: r.status === "passed",
  }))

  const rows = []
  let allGreen = true
  for (const inv of INVARIANTS) {
    const matched = files.filter((f) => inv.match.some((m) => f.name.includes(m)))
    let state, detail
    if (matched.length === 0) {
      state = "RED"; detail = "NO PROOF (no test found)"; allGreen = false
    } else if (matched.every((f) => f.ok)) {
      state = "GREEN"; detail = `${matched.length} test file(s) pass`
    } else {
      state = "RED"; detail = `FAILING: ${matched.filter((f) => !f.ok).map((f) => f.name).join(", ")}`; allGreen = false
    }
    rows.push({ ...inv, state, detail, count: matched.length })
  }
  return {
    rows,
    allGreen,
    totalTests: report.numTotalTests ?? 0,
    passedTests: report.numPassedTests ?? 0,
  }
}

// Auto-run only when invoked directly (`node scripts/check-invariants.mjs`).
if (import.meta.url === `file://${process.argv[1]}`) {
  const { rows, allGreen } = runInvariantBoard()
  const pad = (s, n) => String(s).padEnd(n)
  console.log("BUSINESS-INVARIANT BOARD")
  console.log("=".repeat(78))
  for (const r of rows) {
    console.log(`${r.state === "GREEN" ? "✅" : "❌"} ${pad(r.label, 52)} ${r.detail}`)
  }
  console.log("=".repeat(78))
  console.log(`${rows.filter((r) => r.state === "GREEN").length}/${rows.length} invariants GREEN`)
  if (!allGreen) {
    console.error("\n❌ One or more business invariants are RED. This change must not merge until green.")
    process.exit(1)
  }
  console.log("\n✅ All business invariants GREEN.")
}
