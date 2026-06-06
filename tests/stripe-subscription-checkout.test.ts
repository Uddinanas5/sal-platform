import { describe, it, expect, beforeEach, vi } from "vitest"

// Proves the SAL subscription-checkout route over mock auth + mock Prisma + mock
// Stripe (no DB, no network):
//   - non-owner (admin/staff) → 403, no Stripe call
//   - business already ACTIVE with a subscription → 409, no Checkout Session
//   - happy path (owner, never subscribed) → creates a Customer (stored), a
//     Checkout Session with BOTH line items (monthly + setup) and
//     metadata.businessId + client_reference_id, returns { url }

const {
  getBusinessContextMock,
  prismaMock,
  customersCreateMock,
  checkoutCreateMock,
  ensurePricesMock,
} = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_APP_URL = "https://app.test"
  return {
    getBusinessContextMock: vi.fn(),
    prismaMock: {
      business: { findUnique: vi.fn(), update: vi.fn() },
    },
    customersCreateMock: vi.fn(),
    checkoutCreateMock: vi.fn(),
    ensurePricesMock: vi.fn(),
  }
})

vi.mock("@/lib/auth-utils", () => ({ getBusinessContext: getBusinessContextMock }))
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/lib/stripe", () => ({
  stripe: {
    customers: { create: customersCreateMock },
    checkout: { sessions: { create: checkoutCreateMock } },
  },
}))
vi.mock("@/lib/billing/plan", () => ({
  ensureBillingPrices: ensurePricesMock,
}))

import { POST } from "@/app/api/stripe/create-subscription-checkout/route"

const BIZ = "11111111-1111-4111-8111-111111111111"

beforeEach(() => {
  vi.clearAllMocks()
  getBusinessContextMock.mockResolvedValue({ userId: "u1", businessId: BIZ, role: "owner" })
  prismaMock.business.findUnique.mockResolvedValue({
    id: BIZ,
    name: "Anas Barbershop",
    email: "shop@example.com",
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    subscriptionStatus: "active",
    owner: { email: "owner@example.com" },
  })
  customersCreateMock.mockResolvedValue({ id: "cus_new" })
  ensurePricesMock.mockResolvedValue({
    setupPriceId: "price_setup",
    monthlyPriceId: "price_monthly",
  })
  checkoutCreateMock.mockResolvedValue({ url: "https://checkout.stripe.test/cs_1" })
})

describe("create-subscription-checkout — authorization", () => {
  it("rejects a non-owner (admin) with 403 and never calls Stripe", async () => {
    getBusinessContextMock.mockResolvedValue({ userId: "u1", businessId: BIZ, role: "admin" })

    const res = await POST()
    expect(res.status).toBe(403)
    expect(checkoutCreateMock).not.toHaveBeenCalled()
    expect(customersCreateMock).not.toHaveBeenCalled()
  })

  it("rejects an unauthenticated caller with 401", async () => {
    getBusinessContextMock.mockRejectedValue(new Error("Not authenticated"))

    const res = await POST()
    expect(res.status).toBe(401)
    expect(checkoutCreateMock).not.toHaveBeenCalled()
  })
})

describe("create-subscription-checkout — already subscribed", () => {
  it("returns 409 when the business already has an active subscription", async () => {
    prismaMock.business.findUnique.mockResolvedValue({
      id: BIZ,
      name: "Anas Barbershop",
      email: "shop@example.com",
      stripeCustomerId: "cus_existing",
      stripeSubscriptionId: "sub_existing",
      subscriptionStatus: "active",
      owner: { email: "owner@example.com" },
    })

    const res = await POST()
    expect(res.status).toBe(409)
    expect(checkoutCreateMock).not.toHaveBeenCalled()
  })
})

describe("create-subscription-checkout — happy path", () => {
  it("creates a Customer (stored) + a subscription Checkout Session with both line items and metadata", async () => {
    const res = await POST()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.url).toBe("https://checkout.stripe.test/cs_1")

    // A new Stripe Customer was created and persisted on the business.
    expect(customersCreateMock).toHaveBeenCalledTimes(1)
    expect(prismaMock.business.update).toHaveBeenCalledWith({
      where: { id: BIZ },
      data: { stripeCustomerId: "cus_new" },
    })

    // The Checkout Session params: subscription mode, BOTH prices, identity.
    expect(checkoutCreateMock).toHaveBeenCalledTimes(1)
    const params = checkoutCreateMock.mock.calls[0][0]
    expect(params.mode).toBe("subscription")
    expect(params.customer).toBe("cus_new")
    // No payment_method_types — Stripe picks dynamically (best practice).
    expect(params.payment_method_types).toBeUndefined()

    const prices = params.line_items.map((li: { price: string }) => li.price)
    expect(prices).toContain("price_monthly")
    expect(prices).toContain("price_setup")
    expect(params.line_items).toHaveLength(2)

    expect(params.metadata.businessId).toBe(BIZ)
    expect(params.client_reference_id).toBe(BIZ)
    expect(params.success_url).toContain("/settings?tab=billing&billing=success")
    expect(params.cancel_url).toContain("/settings?tab=billing&billing=cancelled")
  })

  it("reuses an existing Stripe Customer without creating a new one", async () => {
    prismaMock.business.findUnique.mockResolvedValue({
      id: BIZ,
      name: "Anas Barbershop",
      email: "shop@example.com",
      stripeCustomerId: "cus_reuse",
      stripeSubscriptionId: null,
      subscriptionStatus: "cancelled",
      owner: { email: "owner@example.com" },
    })

    const res = await POST()
    expect(res.status).toBe(200)
    expect(customersCreateMock).not.toHaveBeenCalled()
    const params = checkoutCreateMock.mock.calls[0][0]
    expect(params.customer).toBe("cus_reuse")
  })
})
