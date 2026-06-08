import { describe, it, expect, beforeEach, vi } from "vitest"

// REGRESSION — cross-tenant foreign-key injection. assertOwnedRefs is the shared
// guard now applied across the v1 REST routes, server actions, and MCP tools
// (memberships, waitlist, forms, services, staff, products) so a caller in
// business A can never bind business B's client/service/staff/etc. into their
// own data by passing a leaked id. Each ref maps to a tenant-scoped count:
// every model scopes by businessId directly EXCEPT staff, which joins through
// primaryLocation.businessId. These tests lock in that contract with a mock
// Prisma (no DB), matching the house style in group-a-tenant-authz.test.ts.

const { prismaMock } = vi.hoisted(() => {
  const model = () => ({ count: vi.fn() })
  return {
    prismaMock: {
      client: model(),
      service: model(),
      staff: model(),
      appointment: model(),
      productCategory: model(),
      serviceCategory: model(),
      membershipPlan: model(),
    },
  }
})

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))

import { assertOwnedRefs } from "@/lib/api/ownership"

const CTX = { businessId: "biz-A" }

beforeEach(() => {
  vi.clearAllMocks()
  // Default: every existence check passes (owned).
  for (const m of Object.values(prismaMock)) m.count.mockResolvedValue(1)
})

describe("assertOwnedRefs", () => {
  it("returns null when all supplied refs belong to the tenant", async () => {
    const result = await assertOwnedRefs(CTX, {
      client: "c1",
      service: "s1",
      staff: "st1",
    })
    expect(result).toBeNull()
    expect(prismaMock.client.count).toHaveBeenCalledWith({
      where: { id: "c1", businessId: "biz-A" },
    })
  })

  it("ignores undefined / null ids entirely (no query, no rejection)", async () => {
    const result = await assertOwnedRefs(CTX, {
      client: "c1",
      service: undefined,
      staff: null,
      appointment: undefined,
    })
    expect(result).toBeNull()
    expect(prismaMock.client.count).toHaveBeenCalledTimes(1)
    expect(prismaMock.service.count).not.toHaveBeenCalled()
    expect(prismaMock.staff.count).not.toHaveBeenCalled()
  })

  it("returns the label of a cross-tenant client (count === 0)", async () => {
    prismaMock.client.count.mockResolvedValue(0)
    const result = await assertOwnedRefs(CTX, { client: "c-from-biz-B" })
    expect(result).toBe("Client")
  })

  it("scopes staff through primaryLocation.businessId, not a direct businessId", async () => {
    prismaMock.staff.count.mockResolvedValue(0)
    const result = await assertOwnedRefs(CTX, { staff: "st-from-biz-B" })
    expect(result).toBe("Staff")
    expect(prismaMock.staff.count).toHaveBeenCalledWith({
      where: { id: "st-from-biz-B", primaryLocation: { businessId: "biz-A" } },
    })
  })

  it("rejects on the first unowned ref and reports its label", async () => {
    // client is owned, service is NOT — service should be the reported failure.
    prismaMock.service.count.mockResolvedValue(0)
    const result = await assertOwnedRefs(CTX, { client: "c1", service: "s-from-biz-B" })
    expect(result).toBe("Service")
  })

  it("validates serviceCategory and productCategory against the tenant", async () => {
    prismaMock.serviceCategory.count.mockResolvedValue(0)
    expect(await assertOwnedRefs(CTX, { serviceCategory: "cat-B" })).toBe("Service category")

    prismaMock.serviceCategory.count.mockResolvedValue(1)
    prismaMock.productCategory.count.mockResolvedValue(0)
    expect(await assertOwnedRefs(CTX, { productCategory: "pcat-B" })).toBe("Product category")
  })
})
