import { describe, it, expect } from "vitest"
import { classifyRawSql, scanRepo } from "../scripts/check-raw-sql-tenancy.mjs"

// Gate A.5 — raw SQL ($queryRaw/$executeRaw/...Unsafe) must never bypass tenant
// scoping. This guard is a launch-critical multi-tenant control: most real
// cross-tenant leaks come from a hand-written query that forgot a businessId
// predicate. These tests lock in the classifier AND assert the live codebase is
// clean, so a future unsafe raw query trips CI instead of leaking in production.

describe("raw SQL tenancy guard (Gate A.5)", () => {
  it("the CURRENT codebase is clean — every raw SQL is tenant-scoped or an allowlisted global", () => {
    expect(scanRepo()).toEqual([])
  })

  it("allows advisory locks (tenant-keyed by a businessId hash, no row data)", () => {
    expect(classifyRawSql("SELECT pg_advisory_xact_lock(k1, k2)", "executeRaw").allowed).toBe(true)
  })

  it("allows the SELECT 1 liveness probe (no tenant data)", () => {
    expect(classifyRawSql("await prisma.$queryRaw`SELECT 1`", "queryRaw").allowed).toBe(true)
  })

  it("allows a tenant-scoped parameterized query that references businessId", () => {
    expect(classifyRawSql("`SELECT * FROM appointments WHERE \"businessId\" = ${id}`", "queryRaw").allowed).toBe(true)
  })

  it("FAILS an unscoped raw query with no tenant predicate", () => {
    const v = classifyRawSql("`SELECT * FROM appointments`", "queryRaw")
    expect(v.allowed).toBe(false)
    expect(v.reason).toMatch(/no tenant predicate/)
  })

  it("FAILS an *Unsafe interpolated query EVEN IF it mentions businessId (can't be safely parameterized)", () => {
    expect(classifyRawSql("$queryRawUnsafe(`... WHERE businessId = ${x}`)", "queryRawUnsafe").allowed).toBe(false)
  })

  it("respects an explicit human-reviewed raw-sql-allow annotation", () => {
    expect(
      classifyRawSql("$queryRawUnsafe(sql) // raw-sql-allow: cross-tenant admin metric, reviewed", "queryRawUnsafe").allowed,
    ).toBe(true)
  })
})
