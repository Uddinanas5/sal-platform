import { describe, it, expect } from "vitest"
import { readFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"

// Phase 3A (CRITICAL) + 4E proof — CI-safe (no DB).
//
// The runtime proof (delete an appointment -> its commission SURVIVES) lives in
// the pg-integration job (tests/pg/ondelete-integrity), which needs a real
// Postgres. This schema/migration-level assertion is the fails-without /
// passes-with guard that the fix is encoded: before the change the schema said
// `onDelete: Cascade` (this test fails); after, it says SetNull (this passes).

const root = resolve(__dirname, "..")
const schema = readFileSync(resolve(root, "prisma/schema.prisma"), "utf8")

function commissionModel(): string {
  const start = schema.indexOf("model Commission {")
  expect(start).toBeGreaterThan(-1)
  const end = schema.indexOf("\n}", start)
  return schema.slice(start, end)
}

describe("Commission payroll integrity (schema + migration)", () => {
  it("Commission.appointment uses onDelete: SetNull, never Cascade (payroll must survive appointment deletion)", () => {
    const model = commissionModel()
    const appointmentRel = model
      .split("\n")
      .find((l) => l.trimStart().startsWith("appointment ") && l.includes("@relation"))
    expect(appointmentRel, "Commission.appointment relation line").toBeTruthy()
    expect(appointmentRel).toContain("onDelete: SetNull")
    expect(appointmentRel).not.toContain("onDelete: Cascade")
  })

  it("Commission has the [staffId, createdAt] composite index serving payroll reads", () => {
    const model = commissionModel()
    expect(model).toMatch(/@@index\(\[staffId,\s*createdAt\]\)/)
  })

  it("the migration switches the FK to SET NULL and adds the index", () => {
    const dir = "prisma/migrations/20260610120000_commission_payroll_integrity"
    const sqlPath = resolve(root, dir, "migration.sql")
    const rollbackPath = resolve(root, dir, "rollback.sql")
    expect(existsSync(sqlPath), "migration.sql exists").toBe(true)
    expect(existsSync(rollbackPath), "rollback.sql exists").toBe(true)
    const sql = readFileSync(sqlPath, "utf8")
    // Forward: re-adds the FK as SET NULL, creates the index, schema-scoped guard.
    expect(sql).toMatch(/commissions_appointment_id_fkey/)
    expect(sql).toMatch(/ON DELETE SET NULL/)
    expect(sql).toMatch(/connamespace = current_schema\(\)/)
    expect(sql).toMatch(/commissions_staff_id_created_at_idx/)
    // Rollback exists and restores CASCADE.
    expect(readFileSync(rollbackPath, "utf8")).toMatch(/ON DELETE CASCADE/)
  })
})
