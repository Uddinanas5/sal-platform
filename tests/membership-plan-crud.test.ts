import { describe, it, expect, beforeEach, vi } from "vitest"

// Backs the "make Memberships real" workstream: the plan CRUD server actions
// that the Create/Edit dialog and the plan-card Activate/Deactivate buttons call.
//
// These tests prove, over a mock Prisma + mock auth-utils (no DB):
//   - createMembershipPlan stamps the SESSION businessId on the new row (never
//     trusting input), maps the dialog fields (billingCycle, discountPercent,
//     benefits), and returns a serialized plan (no Decimal leaking out).
//   - updateMembershipPlan / toggleMembershipPlan / deleteMembershipPlan all
//     scope their writes to { id, businessId } via updateMany/deleteMany, so a
//     foreign plan id touches NOTHING and surfaces as "Plan not found".
//   - deleteMembershipPlan refuses to orphan members (refuses while count > 0).
//   - every mutation requires the "admin" role (requireMinRole).

const {
  prismaMock,
  requireMinRoleMock,
  revalidatePathMock,
  assertServicesOwnedMock,
} = vi.hoisted(() => {
  const prismaMock = {
    membershipPlan: {
      create: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
      findFirst: vi.fn(),
    },
    membership: {
      count: vi.fn(),
    },
  }
  return {
    prismaMock,
    requireMinRoleMock: vi.fn(),
    revalidatePathMock: vi.fn(),
    assertServicesOwnedMock: vi.fn(),
  }
})

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/lib/auth-utils", () => ({
  requireMinRole: requireMinRoleMock,
  getBusinessContext: vi.fn(),
}))
vi.mock("@/lib/ownership", () => ({ assertServicesOwned: assertServicesOwnedMock }))
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }))

import {
  createMembershipPlan,
  updateMembershipPlan,
  toggleMembershipPlan,
  deleteMembershipPlan,
} from "@/lib/actions/memberships"

// Valid v4 UUIDs (version "4" + variant "8/9/a/b").
const BIZ = "11111111-1111-4111-8111-111111111111"
const USER = "22222222-2222-4222-8222-222222222222"
const PLAN = "33333333-3333-4333-8333-333333333333"
const SVC = "44444444-4444-4444-8444-444444444444"

beforeEach(() => {
  vi.clearAllMocks()
  requireMinRoleMock.mockResolvedValue({ userId: USER, businessId: BIZ, role: "admin" })
  assertServicesOwnedMock.mockResolvedValue(undefined)
})

describe("createMembershipPlan — tenant isolation & field mapping", () => {
  it("creates a plan stamped with the SESSION businessId and mapped dialog fields", async () => {
    prismaMock.membershipPlan.create.mockResolvedValue({
      id: PLAN,
      name: "Gold",
      description: "Premium",
      price: 149,
      billingCycle: "monthly",
      sessionsIncluded: null,
      discountPercent: 20,
      serviceIds: [],
      benefits: ["20% off", "Priority booking"],
      isActive: true,
    })

    const result = await createMembershipPlan({
      name: "Gold",
      description: "Premium",
      price: 149,
      billingCycle: "monthly",
      discountPercent: 20,
      benefits: ["20% off", "Priority booking"],
    })

    expect(result.success).toBe(true)
    if (result.success) {
      // No Decimal leaks out — price/discount are plain numbers.
      expect(result.data.price).toBe(149)
      expect(result.data.discountPercent).toBe(20)
      expect(result.data.benefits).toEqual(["20% off", "Priority booking"])
    }

    // Requires admin, and the create carries the SESSION businessId.
    expect(requireMinRoleMock).toHaveBeenCalledWith("admin")
    const createData = prismaMock.membershipPlan.create.mock.calls[0][0].data
    expect(createData.businessId).toBe(BIZ)
    expect(createData.billingCycle).toBe("monthly")
    expect(createData.discountPercent).toBe(20)
    expect(createData.benefits).toEqual(["20% off", "Priority booking"])
    expect(revalidatePathMock).toHaveBeenCalledWith("/memberships")
  })

  it("validates linked serviceIds belong to the business before writing", async () => {
    assertServicesOwnedMock.mockRejectedValue(new Error("Not found"))

    const result = await createMembershipPlan({
      name: "Cross-tenant",
      price: 10,
      billingCycle: "monthly",
      serviceIds: [SVC],
    })

    expect(result.success).toBe(false)
    expect(assertServicesOwnedMock).toHaveBeenCalledWith([SVC], BIZ)
    expect(prismaMock.membershipPlan.create).not.toHaveBeenCalled()
  })

  it("rejects invalid input (blank name) before any write", async () => {
    const result = await createMembershipPlan({
      name: "",
      price: 10,
      billingCycle: "monthly",
    })

    expect(result.success).toBe(false)
    expect(requireMinRoleMock).not.toHaveBeenCalled()
    expect(prismaMock.membershipPlan.create).not.toHaveBeenCalled()
  })
})

describe("updateMembershipPlan — tenant isolation", () => {
  it("scopes the update to { id, businessId } and returns the serialized plan", async () => {
    prismaMock.membershipPlan.updateMany.mockResolvedValue({ count: 1 })
    prismaMock.membershipPlan.findFirst.mockResolvedValue({
      id: PLAN,
      name: "Gold+",
      description: null,
      price: 159,
      billingCycle: "monthly",
      sessionsIncluded: null,
      discountPercent: null,
      serviceIds: [],
      benefits: [],
      isActive: true,
    })

    const result = await updateMembershipPlan(PLAN, { name: "Gold+", price: 159 })

    expect(result.success).toBe(true)
    expect(requireMinRoleMock).toHaveBeenCalledWith("admin")
    const where = prismaMock.membershipPlan.updateMany.mock.calls[0][0].where
    expect(where).toMatchObject({ id: PLAN, businessId: BIZ })
  })

  it("returns 'Plan not found' (and never reads back) when a foreign id matches no row", async () => {
    // updateMany on a foreign plan id touches 0 rows.
    prismaMock.membershipPlan.updateMany.mockResolvedValue({ count: 0 })

    const result = await updateMembershipPlan(PLAN, { name: "hijack" })

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/not found/i)
    // The scoped where still carried the caller's businessId.
    const where = prismaMock.membershipPlan.updateMany.mock.calls[0][0].where
    expect(where.businessId).toBe(BIZ)
    // No read-back of another tenant's plan.
    expect(prismaMock.membershipPlan.findFirst).not.toHaveBeenCalled()
  })
})

describe("toggleMembershipPlan — tenant isolation", () => {
  it("flips isActive scoped to the business and echoes the new state", async () => {
    prismaMock.membershipPlan.updateMany.mockResolvedValue({ count: 1 })

    const result = await toggleMembershipPlan(PLAN, false)

    expect(result.success).toBe(true)
    if (result.success) expect(result.data.isActive).toBe(false)
    const args = prismaMock.membershipPlan.updateMany.mock.calls[0][0]
    expect(args.where).toMatchObject({ id: PLAN, businessId: BIZ })
    expect(args.data).toEqual({ isActive: false })
  })

  it("rejects a foreign plan id (count 0 → not found)", async () => {
    prismaMock.membershipPlan.updateMany.mockResolvedValue({ count: 0 })

    const result = await toggleMembershipPlan(PLAN, true)

    expect(result.success).toBe(false)
    expect(prismaMock.membershipPlan.updateMany.mock.calls[0][0].where.businessId).toBe(BIZ)
  })
})

describe("deleteMembershipPlan — tenant isolation & member safety", () => {
  it("refuses to delete a plan that still has members (deactivate instead)", async () => {
    prismaMock.membership.count.mockResolvedValue(3)

    const result = await deleteMembershipPlan(PLAN)

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/deactivate/i)
    // The member count is scoped through the plan's business.
    const where = prismaMock.membership.count.mock.calls[0][0].where
    expect(where).toMatchObject({ planId: PLAN, plan: { businessId: BIZ } })
    expect(prismaMock.membershipPlan.deleteMany).not.toHaveBeenCalled()
  })

  it("deletes an empty plan scoped to { id, businessId }", async () => {
    prismaMock.membership.count.mockResolvedValue(0)
    prismaMock.membershipPlan.deleteMany.mockResolvedValue({ count: 1 })

    const result = await deleteMembershipPlan(PLAN)

    expect(result.success).toBe(true)
    const where = prismaMock.membershipPlan.deleteMany.mock.calls[0][0].where
    expect(where).toMatchObject({ id: PLAN, businessId: BIZ })
  })

  it("returns 'Plan not found' for a foreign id (deleteMany count 0)", async () => {
    prismaMock.membership.count.mockResolvedValue(0)
    prismaMock.membershipPlan.deleteMany.mockResolvedValue({ count: 0 })

    const result = await deleteMembershipPlan(PLAN)

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/not found/i)
  })
})
