import { describe, it, expect, beforeEach, vi } from "vitest"

// Proves the SAL subscription webhook cases over a mock Prisma + mock Stripe
// (no DB, no network). Mirrors the harness in stripe-webhook-idempotency.test.ts:
//   - checkout.session.completed (subscription mode) → store sub+customer, active/pro
//   - customer.subscription.updated → status mapping (active/trialing→active,
//     past_due/unpaid→past_due, canceled→cancelled)
//   - customer.subscription.deleted → cancelled + clear stripeSubscriptionId
//   - invoice.payment_failed → past_due (keyed by customer id)
//   - unknown customer (invoice without customer) → no-op

const { prismaMock, constructEventMock, headersGetMock } = vi.hoisted(() => {
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test"
  const prismaMock = {
    stripeEvent: { create: vi.fn() },
    business: { updateMany: vi.fn(), update: vi.fn() },
    payment: { findFirst: vi.fn(), update: vi.fn() },
    appointment: { update: vi.fn() },
    $transaction: vi.fn(),
  }
  return {
    prismaMock,
    constructEventMock: vi.fn(),
    headersGetMock: vi.fn(),
  }
})

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/lib/stripe", () => ({
  stripe: { webhooks: { constructEvent: constructEventMock } },
}))
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({ get: headersGetMock })),
}))

import { POST } from "@/app/api/stripe/webhook/route"

function makeRequest(body: string) {
  return { text: vi.fn(async () => body) } as unknown as Parameters<typeof POST>[0]
}

const BIZ = "11111111-1111-4111-8111-111111111111"

beforeEach(() => {
  vi.clearAllMocks()
  headersGetMock.mockReturnValue("sig_test")
  // First-time event: the idempotency insert succeeds.
  prismaMock.stripeEvent.create.mockResolvedValue({ id: "evt" })
  prismaMock.business.updateMany.mockResolvedValue({ count: 1 })
})

describe("checkout.session.completed (subscription mode)", () => {
  it("stores subscription + customer and marks the business active/pro", async () => {
    constructEventMock.mockReturnValue({
      id: "evt_checkout",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_1",
          mode: "subscription",
          subscription: "sub_123",
          customer: "cus_123",
          metadata: { businessId: BIZ },
          client_reference_id: BIZ,
        },
      },
    })

    const res = await POST(makeRequest("{}"))
    expect(res.status).toBe(200)

    expect(prismaMock.business.updateMany).toHaveBeenCalledTimes(1)
    const arg = prismaMock.business.updateMany.mock.calls[0][0]
    expect(arg.where).toEqual({ id: BIZ })
    expect(arg.data.subscriptionStatus).toBe("active")
    expect(arg.data.subscriptionTier).toBe("pro")
    expect(arg.data.stripeSubscriptionId).toBe("sub_123")
    expect(arg.data.stripeCustomerId).toBe("cus_123")
  })

  it("ignores a non-subscription checkout session (no business mutation)", async () => {
    constructEventMock.mockReturnValue({
      id: "evt_payment_checkout",
      type: "checkout.session.completed",
      data: { object: { id: "cs_2", mode: "payment", metadata: { businessId: BIZ } } },
    })

    const res = await POST(makeRequest("{}"))
    expect(res.status).toBe(200)
    expect(prismaMock.business.updateMany).not.toHaveBeenCalled()
  })

  it("no-ops when businessId cannot be resolved", async () => {
    constructEventMock.mockReturnValue({
      id: "evt_no_biz",
      type: "checkout.session.completed",
      data: { object: { id: "cs_3", mode: "subscription", subscription: "sub_x", customer: "cus_x" } },
    })

    const res = await POST(makeRequest("{}"))
    expect(res.status).toBe(200)
    expect(prismaMock.business.updateMany).not.toHaveBeenCalled()
  })
})

describe("customer.subscription.updated — status mapping", () => {
  const cases: Array<[string, string]> = [
    ["active", "active"],
    ["trialing", "active"],
    ["past_due", "past_due"],
    ["unpaid", "past_due"],
    ["incomplete", "past_due"],
    ["canceled", "cancelled"],
  ]

  for (const [stripeStatus, mapped] of cases) {
    it(`maps Stripe "${stripeStatus}" → "${mapped}" (keyed by subscription id)`, async () => {
      constructEventMock.mockReturnValue({
        id: `evt_upd_${stripeStatus}`,
        type: "customer.subscription.updated",
        data: { object: { id: "sub_123", status: stripeStatus, customer: "cus_123", metadata: {} } },
      })

      const res = await POST(makeRequest("{}"))
      expect(res.status).toBe(200)

      expect(prismaMock.business.updateMany).toHaveBeenCalledTimes(1)
      const arg = prismaMock.business.updateMany.mock.calls[0][0]
      expect(arg.where).toEqual({ stripeSubscriptionId: "sub_123" })
      expect(arg.data.subscriptionStatus).toBe(mapped)
    })
  }
})

describe("customer.subscription.deleted", () => {
  it("sets cancelled and clears stripeSubscriptionId", async () => {
    constructEventMock.mockReturnValue({
      id: "evt_del",
      type: "customer.subscription.deleted",
      data: { object: { id: "sub_123", status: "canceled", customer: "cus_123", metadata: {} } },
    })

    const res = await POST(makeRequest("{}"))
    expect(res.status).toBe(200)

    const arg = prismaMock.business.updateMany.mock.calls[0][0]
    expect(arg.where).toEqual({ stripeSubscriptionId: "sub_123" })
    expect(arg.data.subscriptionStatus).toBe("cancelled")
    expect(arg.data.stripeSubscriptionId).toBeNull()
  })
})

describe("invoice.payment_failed", () => {
  it("marks the business past_due (keyed by customer id)", async () => {
    constructEventMock.mockReturnValue({
      id: "evt_inv_fail",
      type: "invoice.payment_failed",
      data: { object: { id: "in_1", customer: "cus_123" } },
    })

    const res = await POST(makeRequest("{}"))
    expect(res.status).toBe(200)

    const arg = prismaMock.business.updateMany.mock.calls[0][0]
    expect(arg.where).toEqual({ stripeCustomerId: "cus_123" })
    expect(arg.data.subscriptionStatus).toBe("past_due")
  })

  it("no-ops on an invoice with no customer (unknown — never guesses)", async () => {
    constructEventMock.mockReturnValue({
      id: "evt_inv_no_cus",
      type: "invoice.payment_failed",
      data: { object: { id: "in_2", customer: null } },
    })

    const res = await POST(makeRequest("{}"))
    expect(res.status).toBe(200)
    expect(prismaMock.business.updateMany).not.toHaveBeenCalled()
  })
})
