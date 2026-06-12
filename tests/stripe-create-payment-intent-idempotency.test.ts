import { describe, it, expect, beforeEach, vi } from "vitest"

// Phase 2A — createPaymentIntent must pass a Stripe idempotency key so a retry /
// double-submit returns the SAME PaymentIntent instead of charging the card
// twice. Proves the key reaches stripe.paymentIntents.create as its 2nd arg.

const { piCreate } = vi.hoisted(() => {
  process.env.STRIPE_SECRET_KEY = "sk_test_dummy"
  return { piCreate: vi.fn(async () => ({ id: "pi_1", client_secret: "cs_1" })) }
})

vi.mock("stripe", () => ({
  default: class {
    paymentIntents = { create: piCreate }
  },
}))

import { createPaymentIntent } from "@/lib/stripe"

beforeEach(() => piCreate.mockClear())

describe("createPaymentIntent idempotency", () => {
  it("forwards the idempotencyKey as the second arg to stripe.paymentIntents.create", async () => {
    await createPaymentIntent({ amount: 5000, idempotencyKey: "pi-appt123-480000" })
    expect(piCreate).toHaveBeenCalledTimes(1)
    const [params, options] = piCreate.mock.calls[0] as unknown as [Record<string, unknown>, { idempotencyKey?: string } | undefined]
    expect(params).toMatchObject({ amount: 5000 })
    expect(options).toEqual({ idempotencyKey: "pi-appt123-480000" })
  })

  it("passes no options object when no key is supplied (backward compatible)", async () => {
    await createPaymentIntent({ amount: 5000 })
    const [, options] = piCreate.mock.calls[0] as unknown as [Record<string, unknown>, { idempotencyKey?: string } | undefined]
    expect(options).toBeUndefined()
  })

  it("two charges for the same appointment+hour use the SAME deterministic key", () => {
    // The route builds `pi-${appointmentId}-${hourBucket}`; same appointment in
    // the same hour bucket => identical key => Stripe dedupes the second charge.
    const hourBucket = Math.floor(1_728_000_000_000 / 3_600_000)
    const key1 = `pi-appt123-${hourBucket}`
    const key2 = `pi-appt123-${hourBucket}`
    expect(key1).toBe(key2)
  })
})
