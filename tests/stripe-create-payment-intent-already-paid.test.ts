import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

// L-017 — the online Stripe Connect charge path (POST /api/stripe/create-payment-intent)
// had NO already-paid guard, unlike the three in-person checkout paths
// (actions/checkout, v1/checkout, mcp/checkout). Its hourly idempotency key only
// dedupes retries WITHIN the same hour, so a second call in a later hour would mint
// a fresh PaymentIntent and charge the client's card a SECOND time.
//
// This locks the guard against a mock auth + prisma + stripe (no DB, no network):
//   - a COMPLETED payment for the appointment => 400 and, crucially, NO new
//     PaymentIntent and NO new payment row (no second charge)
//   - the guard query is scoped to this appointment+business, completed only
//   - with no prior completed payment the charge still proceeds (no over-blocking)

const { authMock, prismaMock, createPaymentIntentMock, getOrCreateCustomerMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  prismaMock: {
    business: { findFirst: vi.fn() },
    appointment: { findFirst: vi.fn() },
    payment: { findFirst: vi.fn(), create: vi.fn() },
  },
  createPaymentIntentMock: vi.fn(),
  getOrCreateCustomerMock: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({ auth: authMock }))
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/lib/stripe", () => ({
  createPaymentIntent: createPaymentIntentMock,
  getOrCreateCustomer: getOrCreateCustomerMock,
}))

import { POST } from "@/app/api/stripe/create-payment-intent/route"

const BIZ = "11111111-1111-4111-8111-111111111111"
const APPT = "22222222-2222-4222-8222-222222222222"

function req() {
  return new NextRequest("http://localhost/api/stripe/create-payment-intent", {
    method: "POST",
    body: JSON.stringify({ appointmentId: APPT }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  authMock.mockResolvedValue({ user: { id: "u1", businessId: BIZ } })
  prismaMock.business.findFirst.mockResolvedValue({ stripeAccountId: "acct_1", stripeAccountStatus: "active" })
  prismaMock.appointment.findFirst.mockResolvedValue({ id: APPT, clientId: "c1", totalAmount: 45 })
  createPaymentIntentMock.mockResolvedValue({ success: true, clientSecret: "cs_1", paymentIntentId: "pi_1" })
  prismaMock.payment.create.mockResolvedValue({})
})

describe("create-payment-intent — already-paid guard (L-017)", () => {
  it("rejects with 400 and charges NOTHING when a completed payment already exists", async () => {
    prismaMock.payment.findFirst.mockResolvedValue({ id: "pay_done" })

    const res = await POST(req())
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/already been paid/i)

    // The whole point of the guard: no second PaymentIntent, no second payment row.
    expect(createPaymentIntentMock).not.toHaveBeenCalled()
    expect(prismaMock.payment.create).not.toHaveBeenCalled()
  })

  it("scopes the guard to this appointment+business, completed payments only", async () => {
    prismaMock.payment.findFirst.mockResolvedValue({ id: "pay_done" })
    await POST(req())
    expect(prismaMock.payment.findFirst).toHaveBeenCalledTimes(1)
    const where = prismaMock.payment.findFirst.mock.calls[0][0].where
    expect(where).toEqual({ appointmentId: APPT, businessId: BIZ, type: "payment", status: "completed" })
  })

  it("still charges when there is NO prior completed payment (guard does not over-block)", async () => {
    prismaMock.payment.findFirst.mockResolvedValue(null)

    const res = await POST(req())
    expect(res.status).toBe(200)
    expect(createPaymentIntentMock).toHaveBeenCalledTimes(1)
    expect(prismaMock.payment.create).toHaveBeenCalledTimes(1)
  })
})
