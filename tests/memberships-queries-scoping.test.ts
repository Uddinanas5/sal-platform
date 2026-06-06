import { describe, it, expect, beforeEach, vi } from "vitest"

// Backs the "Memberships page reads REAL rows" workstream: the gift-card list
// and the plan list are now DB-backed (no mock arrays). These tests prove, over
// a mock Prisma (no DB), that both list queries:
//   - filter by the businessId passed in (tenant scoping), and
//   - serialize Decimal columns to plain numbers + derive an honest status,
// so a foreign business can never see another tenant's cards or plans.

const { prismaMock } = vi.hoisted(() => {
  const prismaMock = {
    giftCard: { findMany: vi.fn() },
    membershipPlan: { findMany: vi.fn() },
  }
  return { prismaMock }
})

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))

import { getGiftCards, getMembershipPlans } from "@/lib/queries/memberships"

const BIZ = "11111111-1111-4111-8111-111111111111"

beforeEach(() => {
  vi.clearAllMocks()
})

describe("getGiftCards — tenant scoping & serialization", () => {
  it("scopes the findMany by businessId", async () => {
    prismaMock.giftCard.findMany.mockResolvedValue([])

    await getGiftCards(BIZ)

    expect(prismaMock.giftCard.findMany).toHaveBeenCalledTimes(1)
    const args = prismaMock.giftCard.findMany.mock.calls[0][0]
    expect(args.where).toEqual({ businessId: BIZ })
  })

  it("maps real rows to code/balance/status/expiry with Decimals as numbers", async () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365)
    prismaMock.giftCard.findMany.mockResolvedValue([
      {
        id: "gc1",
        code: "SAL-GIFT-A1B2",
        initialValue: { toString: () => "100" }, // Prisma Decimal-like
        currentBalance: { toString: () => "45.5" },
        recipientName: "Lisa",
        recipientEmail: null,
        expiresAt: future,
        isActive: true,
        createdAt: new Date("2026-01-01"),
        purchaser: { firstName: "Emma", lastName: "Thompson" },
      },
    ])

    const cards = await getGiftCards(BIZ)

    expect(cards).toHaveLength(1)
    expect(cards[0].code).toBe("SAL-GIFT-A1B2")
    expect(cards[0].initialBalance).toBe(100)
    expect(cards[0].currentBalance).toBe(45.5)
    expect(cards[0].purchasedBy).toBe("Emma Thompson")
    expect(cards[0].status).toBe("active")
  })

  it("derives 'expired' when past expiry and 'redeemed' when drawn down", async () => {
    const past = new Date(Date.now() - 1000 * 60 * 60 * 24)
    prismaMock.giftCard.findMany.mockResolvedValue([
      {
        id: "gc_expired",
        code: "EXP",
        initialValue: { toString: () => "50" },
        currentBalance: { toString: () => "50" }, // still has balance but expired
        recipientName: null,
        recipientEmail: null,
        expiresAt: past,
        isActive: true,
        createdAt: new Date("2025-01-01"),
        purchaser: null,
      },
      {
        id: "gc_redeemed",
        code: "RED",
        initialValue: { toString: () => "50" },
        currentBalance: { toString: () => "0" },
        recipientName: null,
        recipientEmail: null,
        expiresAt: null,
        isActive: true,
        createdAt: new Date("2025-01-01"),
        purchaser: null,
      },
    ])

    const cards = await getGiftCards(BIZ)

    expect(cards.find((c) => c.code === "EXP")?.status).toBe("expired")
    expect(cards.find((c) => c.code === "RED")?.status).toBe("redeemed")
  })
})

describe("getMembershipPlans — tenant scoping & member counts", () => {
  it("scopes by businessId (active + inactive) and returns active member counts", async () => {
    prismaMock.membershipPlan.findMany.mockResolvedValue([
      {
        id: "p1",
        name: "Gold",
        description: "Premium",
        price: { toString: () => "149" },
        billingCycle: "monthly",
        sessionsIncluded: null,
        discountPercent: { toString: () => "20" },
        serviceIds: [],
        benefits: ["20% off"],
        isActive: false,
        _count: { memberships: 7 },
      },
    ])

    const plans = await getMembershipPlans(BIZ)

    const args = prismaMock.membershipPlan.findMany.mock.calls[0][0]
    // Scoped to the business, and NOT restricted to isActive (management view).
    expect(args.where).toEqual({ businessId: BIZ })
    expect(plans[0].price).toBe(149)
    expect(plans[0].discountPercent).toBe(20)
    expect(plans[0].activeMembers).toBe(7)
    expect(plans[0].isActive).toBe(false)
  })
})
