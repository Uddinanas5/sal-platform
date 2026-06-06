import { describe, it, expect, beforeEach, vi } from "vitest"

// Proves the SAL subscription-checkout route over mock auth + mock Prisma + mock
// Stripe (no DB, no network):
//   - non-owner (admin/staff) → 403, no Stripe call
//   - business with a NON-TERMINAL subscription on file (verified at Stripe) →
//     409, no Checkout Session
//   - a stale/cancelled subscription id → allowed to start fresh
//   - happy path (owner, never subscribed) → atomically claims a Customer
//     (stored), a Checkout Session with BOTH line items + metadata + a
//     session_id-carrying success_url, returns { url }
//   - lost the customer-creation race → re-reads the winner, deletes the orphan

const {
  getBusinessContextMock,
  prismaMock,
  customersCreateMock,
  customersDelMock,
  subscriptionsRetrieveMock,
  checkoutCreateMock,
  ensurePricesMock,
} = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_APP_URL = "https://app.test"
  return {
    getBusinessContextMock: vi.fn(),
    prismaMock: {
      business: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    },
    customersCreateMock: vi.fn(),
    customersDelMock: vi.fn(),
    subscriptionsRetrieveMock: vi.fn(),
    checkoutCreateMock: vi.fn(),
    ensurePricesMock: vi.fn(),
  }
})

vi.mock("@/lib/auth-utils", () => ({ getBusinessContext: getBusinessContextMock }))
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/lib/stripe", () => ({
  stripe: {
    customers: { create: customersCreateMock, del: customersDelMock },
    subscriptions: { retrieve: subscriptionsRetrieveMock },
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
  customersDelMock.mockResolvedValue({ id: "cus_new", deleted: true })
  // Win the atomic claim by default.
  prismaMock.business.updateMany.mockResolvedValue({ count: 1 })
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

describe("create-subscription-checkout — already subscribed (Stripe-verified guard)", () => {
  it("returns 409 when a NON-TERMINAL subscription is on file (verified active at Stripe)", async () => {
    prismaMock.business.findUnique.mockResolvedValue({
      id: BIZ,
      name: "Anas Barbershop",
      email: "shop@example.com",
      stripeCustomerId: "cus_existing",
      stripeSubscriptionId: "sub_existing",
      subscriptionStatus: "active",
      owner: { email: "owner@example.com" },
    })
    subscriptionsRetrieveMock.mockResolvedValue({ id: "sub_existing", status: "active" })

    const res = await POST()
    expect(res.status).toBe(409)
    expect(subscriptionsRetrieveMock).toHaveBeenCalledWith("sub_existing")
    expect(checkoutCreateMock).not.toHaveBeenCalled()
  })

  it("returns 409 even when local status LAGS (status not active) but Stripe says past_due", async () => {
    // The double-charge window: local status hasn't caught up, but a real
    // non-terminal subscription exists at Stripe → still blocked.
    prismaMock.business.findUnique.mockResolvedValue({
      id: BIZ,
      name: "Anas Barbershop",
      email: "shop@example.com",
      stripeCustomerId: "cus_existing",
      stripeSubscriptionId: "sub_existing",
      subscriptionStatus: "cancelled",
      owner: { email: "owner@example.com" },
    })
    subscriptionsRetrieveMock.mockResolvedValue({ id: "sub_existing", status: "past_due" })

    const res = await POST()
    expect(res.status).toBe(409)
    expect(checkoutCreateMock).not.toHaveBeenCalled()
  })

  it("ALLOWS a fresh checkout when the on-file subscription is genuinely canceled at Stripe", async () => {
    prismaMock.business.findUnique.mockResolvedValue({
      id: BIZ,
      name: "Anas Barbershop",
      email: "shop@example.com",
      stripeCustomerId: "cus_existing",
      stripeSubscriptionId: "sub_old",
      subscriptionStatus: "cancelled",
      owner: { email: "owner@example.com" },
    })
    subscriptionsRetrieveMock.mockResolvedValue({ id: "sub_old", status: "canceled" })

    const res = await POST()
    expect(res.status).toBe(200)
    expect(checkoutCreateMock).toHaveBeenCalledTimes(1)
  })

  it("ALLOWS a fresh checkout when the on-file subscription id is stale (not found at Stripe)", async () => {
    prismaMock.business.findUnique.mockResolvedValue({
      id: BIZ,
      name: "Anas Barbershop",
      email: "shop@example.com",
      stripeCustomerId: "cus_existing",
      stripeSubscriptionId: "sub_gone",
      subscriptionStatus: "cancelled",
      owner: { email: "owner@example.com" },
    })
    subscriptionsRetrieveMock.mockRejectedValue(new Error("No such subscription"))

    const res = await POST()
    expect(res.status).toBe(200)
    expect(checkoutCreateMock).toHaveBeenCalledTimes(1)
  })
})

describe("create-subscription-checkout — happy path", () => {
  it("atomically claims a Customer + creates a subscription Checkout Session with both line items and metadata", async () => {
    const res = await POST()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.url).toBe("https://checkout.stripe.test/cs_1")

    // A new Stripe Customer was created (with an idempotencyKey) and claimed
    // atomically via updateMany (where stripeCustomerId is null).
    expect(customersCreateMock).toHaveBeenCalledTimes(1)
    expect(customersCreateMock.mock.calls[0][1]).toEqual({
      idempotencyKey: `sal-customer-${BIZ}`,
    })
    expect(prismaMock.business.updateMany).toHaveBeenCalledWith({
      where: { id: BIZ, stripeCustomerId: null },
      data: { stripeCustomerId: "cus_new" },
    })
    // Won the race → no orphan deletion.
    expect(customersDelMock).not.toHaveBeenCalled()

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
    // success_url carries the session id for server-side reconciliation on return.
    expect(params.success_url).toContain("/settings?tab=billing&billing=success")
    expect(params.success_url).toContain("session_id={CHECKOUT_SESSION_ID}")
    expect(params.cancel_url).toContain("/settings?tab=billing&billing=cancelled")

    // The session create carries a deterministic idempotencyKey (defense in depth).
    const opts = checkoutCreateMock.mock.calls[0][1]
    expect(opts.idempotencyKey).toContain(`sub-checkout-${BIZ}`)
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

  it("on a lost customer-claim race, re-reads the winner and deletes the orphan", async () => {
    // Two concurrent first checkouts: this one creates cus_new but the atomic
    // claim matches 0 rows (the other writer already set the id). We must
    // re-read the winner (cus_winner) and discard our orphan cus_new.
    prismaMock.business.updateMany.mockResolvedValue({ count: 0 })
    prismaMock.business.findUnique
      .mockResolvedValueOnce({
        id: BIZ,
        name: "Anas Barbershop",
        email: "shop@example.com",
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        subscriptionStatus: "active",
        owner: { email: "owner@example.com" },
      })
      // Re-read after the lost claim returns the winner's id.
      .mockResolvedValueOnce({ stripeCustomerId: "cus_winner" })

    const res = await POST()
    expect(res.status).toBe(200)

    // The orphan we created was deleted; the session uses the winner's customer.
    expect(customersDelMock).toHaveBeenCalledWith("cus_new")
    const params = checkoutCreateMock.mock.calls[0][0]
    expect(params.customer).toBe("cus_winner")
  })
})
