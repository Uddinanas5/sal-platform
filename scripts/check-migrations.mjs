import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { execFileSync } from "node:child_process"

const root = process.cwd()
const migrationsDir = resolve(root, "prisma/migrations")
const includeBaseline = process.argv.includes("--include-baseline")
const scanAll = process.argv.includes("--all")
const strict = !process.argv.includes("--warn-only")

const rules = [
  {
    id: "drop-table",
    severity: "high",
    pattern: /\bDROP\s+TABLE\b/i,
    message: "Drops a table. Prefer a staged migration and explicit data-retention plan.",
  },
  {
    id: "drop-column",
    severity: "high",
    pattern: /\bDROP\s+COLUMN\b/i,
    message: "Drops a column. Deploy read-path removal first, then drop in a later release.",
  },
  {
    id: "rename-column",
    severity: "medium",
    pattern: /\bRENAME\s+COLUMN\b/i,
    message: "Renames a column. Prefer add/backfill/dual-read/drop to avoid app version skew.",
  },
  {
    id: "create-index-blocking",
    severity: "medium",
    pattern: /\bCREATE\s+(UNIQUE\s+)?INDEX\b(?!\s+CONCURRENTLY)/i,
    message: "Creates an index without CONCURRENTLY. On populated tables this can block writes.",
  },
  {
    id: "set-not-null",
    severity: "medium",
    pattern: /\bSET\s+NOT\s+NULL\b/i,
    message: "Sets NOT NULL. Backfill and validate data before enforcing.",
  },
  {
    id: "function-default",
    severity: "low",
    pattern: /\bSET\s+DEFAULT\s+\w+\(/i,
    message: "Adds a function default. Confirm it is safe for existing rows and write volume.",
  },
]

function isBaselineMigration(name) {
  return name === "0_init" || name.toLowerCase().includes("init")
}

function lineNumberFor(text, index) {
  return text.slice(0, index).split(/\r?\n/).length
}

if (!existsSync(migrationsDir)) {
  console.log("No prisma/migrations directory found.")
  process.exit(0)
}

function changedMigrationFiles() {
  try {
    const output = execFileSync("git", ["diff", "--name-only", "--", "prisma/migrations"], {
      cwd: root,
      encoding: "utf8",
    })
    return new Set(output.split(/\r?\n/).filter((file) => file.endsWith("migration.sql")))
  } catch {
    return new Set()
  }
}

const changedFiles = changedMigrationFiles()
const findings = []
for (const migrationName of readdirSync(migrationsDir).sort()) {
  if (!includeBaseline && isBaselineMigration(migrationName)) continue

  const migrationPath = join(migrationsDir, migrationName, "migration.sql")
  if (!existsSync(migrationPath)) continue
  const relativePath = `prisma/migrations/${migrationName}/migration.sql`
  if (!scanAll && !changedFiles.has(relativePath)) continue

  const sql = readFileSync(migrationPath, "utf8")
  const safetyAssured = sql.includes("sal:safety-assured")

  for (const rule of rules) {
    const match = rule.pattern.exec(sql)
    if (!match) continue
    findings.push({
      ...rule,
      file: migrationPath,
      line: lineNumberFor(sql, match.index),
      safetyAssured,
    })
  }
}

if (findings.length === 0) {
  console.log(
    scanAll
      ? "Migration safety check passed."
      : "Migration safety check passed for changed migrations."
  )
  process.exit(0)
}

console.error("Migration safety review found risky SQL:\n")
for (const finding of findings) {
  const status = finding.safetyAssured ? "ACKNOWLEDGED" : "REVIEW"
  console.error(
    `- ${status} ${finding.severity.toUpperCase()} ${finding.id} at ${finding.file}:${finding.line}`
  )
  console.error(`  ${finding.message}`)
}

console.error("\nTo intentionally acknowledge a migration, add this comment to its SQL:")
console.error("-- sal:safety-assured <short reason>")

if (strict && findings.some((finding) => !finding.safetyAssured)) {
  process.exit(1)
}
