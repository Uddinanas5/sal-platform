#!/usr/bin/env node
/**
 * FAKE-SUCCESS SCANNER (heuristic).
 *
 * The #1 AI-slop failure in SAL is a control that toasts "success" but does
 * nothing — it passes a demo and fails a real customer. This flags every
 * `toast.success(...)` whose handler does NOT `await` anything (i.e. likely no
 * real server action ran).
 *
 * It is a HEURISTIC, so legitimate UI-only successes (copy-to-clipboard, theme
 * toggles) may show up. Acknowledge a real one by putting `sal:real-success`
 * in a comment on/near the toast line. Advisory by default (exit 0); pass
 * `--strict` to fail the build on any unacknowledged flag.
 *
 * Run: `npm run check:fake-success`  ·  CI: `node scripts/check-fake-success.mjs --strict`
 */
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

const root = process.cwd()
const strict = process.argv.includes("--strict")
const SCAN_DIRS = ["src/components", "src/app"]
const LOOKBACK = 22 // lines above the toast to search for an `await`

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    const s = statSync(p)
    if (s.isDirectory()) walk(p, out)
    else if (/\.(tsx?|jsx?)$/.test(entry)) out.push(p)
  }
  return out
}

// Toast messages that describe a purely CLIENT-SIDE action which genuinely
// completes in the browser (no server change implied) — these are real, not
// fake, so we don't flag them. Fakes hide behind verbs that imply a SAVED server
// change (saved/sent/updated/created/added/activated), which we keep flagging.
const BENIGN = /copied|clipboard|exported|download|added to cart|opening email|quick sale added|to csv|added to your cart|printer|completed successfully/i

const flags = []
for (const base of SCAN_DIRS) {
  const abs = join(root, base)
  let files
  try { files = walk(abs) } catch { continue }
  for (const file of files) {
    const lines = readFileSync(file, "utf8").split("\n")
    for (let i = 0; i < lines.length; i++) {
      if (!/toast\.success\s*\(/.test(lines[i])) continue
      if (BENIGN.test(lines[i])) continue
      const windowLines = lines.slice(Math.max(0, i - LOOKBACK), i + 1)
      const win = windowLines.join("\n")
      const hasAwait = /\bawait\s/.test(win)
      const acknowledged = /sal:real-success/.test(win)
      if (!hasAwait && !acknowledged) {
        flags.push({ file: relative(root, file), line: i + 1, text: lines[i].trim().slice(0, 90) })
      }
    }
  }
}

if (flags.length === 0) {
  console.log("✅ Fake-success scan: no suspicious toast.success() found (every success has an awaited action or is acknowledged).")
  process.exit(0)
}

console.log(`⚠️  Fake-success scan: ${flags.length} toast.success() with NO awaited action in the handler.`)
console.log("   These may be FAKE (button lies) OR legitimate UI-only successes.")
console.log("   Make it real (call an awaited server action) OR add `// sal:real-success <reason>` near the toast.\n")
for (const f of flags) {
  console.log(`  ${f.file}:${f.line}  ${f.text}`)
}

if (strict) {
  console.error(`\n❌ --strict: ${flags.length} unacknowledged fake-success candidate(s). Resolve or acknowledge each.`)
  process.exit(1)
}
console.log("\n(advisory — not failing the build. Run with --strict to enforce.)")
process.exit(0)
