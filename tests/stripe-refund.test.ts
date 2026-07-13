import { describe, it, expect, beforeEach, vi } from "vitest"

// L-018 / payments-audit #11 — createRefund on Connect DESTINATION charges must
// pass reverse_transfer:true, otherwise a refund pays the customer from the
// platform balance while the connected salon keeps the transferred funds (the
// platform eats the refund). This mocks the Stripe SDK (not @/lib/stripe, so the
// REAL createRefund runs) and asserts the flag is sent.

const { refundsCreate } = vi.hoisted(() => {
  process.env.STRIPE_SECRET_KEY = "sk_test_dummy"
  return { refundsCreate: vi.fn() }
})

vi.mock("stripe", () => ({
  default: class {
    refunds = { create: refundsCreate }
  },
}))

import { createRefund } from "@/lib/stripe"

beforeEach(() => {
  vi.clearAllMocks()
  refundsCreate.mockResolvedValue({ id: "re_123", status: "succeeded" })
})

describe("createRefund — Connect destination-charge refunds (audit #11)", () => {
  it("passes reverse_transfer:true so the connected-account transfer is clawed back", async () => {
    const res = await createRefund({ paymentIntentId: "pi_1", amount: 500, reason: "requested_by_customer" })

    expect(res.success).toBe(true)
    expect(res.refundId).toBe("re_123")
    expect(refundsCreate).toHaveBeenCalledTimes(1)
    const arg = refundsCreate.mock.calls[0]![0]
    expect(arg.reverse_transfer).toBe(true)
    expect(arg.payment_intent).toBe("pi_1")
    expect(arg.amount).toBe(500)
  })

  it("surfaces a Stripe failure as { success:false } instead of throwing", async () => {
    refundsCreate.mockRejectedValueOnce(new Error("charge already refunded"))
    const res = await createRefund({ paymentIntentId: "pi_2" })
    expect(res.success).toBe(false)
  })
})
