import { describe, it, expect, vi } from "vitest"
import { inspectTenantScope, TenantGuardError } from "@/lib/prisma-tenant"
import { runWithTenant, withBypass } from "@/lib/tenant-context"

// Phase 1B — the fail-closed tenancy guard. Proves the inspection logic that
// the Prisma extension runs: a DIRECT-businessId query missing its scope is
// flagged (log) / blocked (throw); a cross-tenant MISMATCH always throws;
// GLOBAL + RELATION_SCOPED + bypass pass.

const BIZ = "biz-1"

describe("inspectTenantScope", () => {
  it("off mode does nothing", () => {
    expect(() =>
      inspectTenantScope("Client", "findMany", { where: {} }, { mode: "off" }),
    ).not.toThrow()
  })

  it("throw mode: a DIRECT model query with NO businessId throws (fails closed)", () => {
    expect(() =>
      inspectTenantScope("Client", "findMany", { where: { name: "x" } }, { mode: "throw" }),
    ).toThrow(TenantGuardError)
  })

  it("throw mode: a bare findUnique by id on a DIRECT model throws (the footgun)", () => {
    expect(() =>
      inspectTenantScope("Appointment", "findUnique", { where: { id: "a1" } }, { mode: "throw" }),
    ).toThrow(TenantGuardError)
  })

  it("throw mode: a DIRECT model query WITH businessId passes", () => {
    expect(() =>
      inspectTenantScope("Client", "findMany", { where: { businessId: BIZ } }, { mode: "throw" }),
    ).not.toThrow()
  })

  it("finds businessId inside a top-level AND", () => {
    expect(() =>
      inspectTenantScope("Client", "update", { where: { AND: [{ id: "c1" }, { businessId: BIZ }] } }, { mode: "throw" }),
    ).not.toThrow()
  })

  it("log mode: a missing clause is logged, NOT thrown", () => {
    const log = { warn: vi.fn(), error: vi.fn() }
    expect(() =>
      inspectTenantScope("Client", "findMany", { where: {} }, { mode: "log", log }),
    ).not.toThrow()
    expect(log.warn).toHaveBeenCalledOnce()
  })

  it("a businessId MISMATCH always throws (active cross-tenant attempt), even in log mode", () => {
    runWithTenant(BIZ, () => {
      expect(() =>
        inspectTenantScope("Client", "update", { where: { id: "c1", businessId: "OTHER" } }, { mode: "log" }),
      ).toThrow(TenantGuardError)
    })
  })

  it("GLOBAL models (User) pass with no businessId", () => {
    expect(() =>
      inspectTenantScope("User", "findUnique", { where: { id: "u1" } }, { mode: "throw" }),
    ).not.toThrow()
  })

  it("RELATION_SCOPED models (Staff) are not hard-checked (logged only)", () => {
    const log = { warn: vi.fn(), error: vi.fn() }
    expect(() =>
      inspectTenantScope("Staff", "findFirst", { where: { id: "s1" } }, { mode: "throw", log }),
    ).not.toThrow()
    expect(log.warn).toHaveBeenCalled()
  })

  it("a bypass scope (webhook/cron) is never enforced", () => {
    withBypass(() => {
      expect(() =>
        inspectTenantScope("Client", "deleteMany", { where: {} }, { mode: "throw" }),
      ).not.toThrow()
    })
  })

  it("non-guarded operations (create) are ignored", () => {
    expect(() =>
      inspectTenantScope("Client", "create", { where: {} }, { mode: "throw" }),
    ).not.toThrow()
  })
})
