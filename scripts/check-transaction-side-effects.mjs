import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { execFileSync } from "node:child_process"

const root = process.cwd()
const strict = !process.argv.includes("--warn-only")

const sideEffectPatterns = [
  { label: "email", pattern: /\bsendEmail\s*\(/ },
  { label: "stripe", pattern: /\bstripe\.[a-zA-Z]/ },
  { label: "network fetch", pattern: /\bfetch\s*\(/ },
  { label: "resend", pattern: /\bresend\.emails\.send\s*\(/ },
]

function listFiles() {
  try {
    return execFileSync("rg", ["--files", "src"], { cwd: root, encoding: "utf8" })
      .split(/\r?\n/)
      .filter(Boolean)
      .filter((file) => /\.(ts|tsx)$/.test(file))
  } catch {
    return []
  }
}

function lineNumberFor(text, index) {
  return text.slice(0, index).split(/\r?\n/).length
}

function transactionBlocks(source) {
  const blocks = []
  const pattern = /\$transaction\s*\(/g
  let match

  while ((match = pattern.exec(source))) {
    let index = match.index
    let depth = 0
    let started = false

    for (; index < source.length; index++) {
      const char = source[index]
      if (char === "(") {
        depth += 1
        started = true
      } else if (char === ")") {
        depth -= 1
        if (started && depth === 0) {
          blocks.push({ start: match.index, end: index + 1, text: source.slice(match.index, index + 1) })
          break
        }
      }
    }
  }

  return blocks
}

const findings = []
for (const file of listFiles()) {
  const path = resolve(root, file)
  if (!existsSync(path)) continue

  const source = readFileSync(path, "utf8")
  if (!source.includes("$transaction")) continue

  for (const block of transactionBlocks(source)) {
    for (const sideEffect of sideEffectPatterns) {
      if (!sideEffect.pattern.test(block.text)) continue
      findings.push({
        file,
        line: lineNumberFor(source, block.start),
        label: sideEffect.label,
      })
    }
  }
}

if (findings.length === 0) {
  console.log("Transaction side-effect check passed.")
  process.exit(0)
}

console.error("Potential side effects inside database transactions:\n")
for (const finding of findings) {
  console.error(`- ${finding.file}:${finding.line} may call ${finding.label} inside prisma.$transaction`)
}

console.error("\nMove external calls after commit, or document the exception near the transaction.")
if (strict) process.exit(1)
