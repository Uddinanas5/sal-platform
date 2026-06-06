import { describe, it, expect, beforeEach, vi } from "vitest"

// Proves the Stripe webhook idempotency gate over a mock Prisma + mock Stripe
// (no DB, no network):
//   - the event id is recorded (prisma.stripeEvent.create) IMMEDIATELY after
//     signature verification, before any side effect runs
//   - a duplicate delivery (the create throws a P2002 unique violation) short-
//     circuits with HTTP 200 and "[duplicate event]" and runs NO side effects
//     (no Payment / Business mutation)
//   - a first-time event proceeds to the handler switch as normal
//
// The webhook reads the raw body via request.text(), the signature via
// next/headers, and verifies it via stripe.webhooks.constructEvent. We mock all
// three so we can hand the route a controlled event object.

const { prismaMock, constructEventMock, headersGetMock } = vi.hoisted(() => {
  // The route reads STRIPE_WEBHOOK_SECRET at module-load time. vi.hoisted runs
  // before the route import is evaluated, so set it here (a plain top-level
  // assignment would run too late — ESM hoists the import above it).
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test"
  const prismaMock = {
    stripeEvent: { create: vi.fn() },
    business: { updateMany: vi.fn() },
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

// A P2002 unique-violation, shaped like a Prisma known-request error (the route
// duck-types `err.code === "P2002"`).
class FakeP2002 extends Error {
  code = "P2002"
  constructor() {
    super("Unique constraint failed")
  }
}

function makeRequest(body: string) {
  return { text: vi.fn(async () => body) } as unknown as Parameters<typeof POST>[0]
}

const ACCOUNT_EVENT = {
  id: "evt_test_1",
  type: "account.updated",
  data: { object: { id: "acct_1", charges_enabled: true, payouts_enabled: true } },
}

beforeEach(() => {
  vi.clearAllMocks()
  headersGetMock.mockReturnValue("sig_test")
  constructEventMock.mockReturnValue(ACCOUNT_EVENT)
  prismaMock.$transaction.mockImplementation(async (fn: unknown) => {
    if (typeof fn === "function") return (fn as (tx: unknown) => unknown)(prismaMock)
    return undefined
  })
})

describe("stripe webhook — idempotency gate", () => {
  it("records the event id before any side effect runs", async () => {
    prismaMock.stripeEvent.create.mockResolvedValueOnce({ id: ACCOUNT_EVENT.id })

    const res = await POST(makeRequest("{}"))
    expect(res.status).toBe(200)

    // The idempotency row is written with the Stripe event id + type.
    expect(prismaMock.stripeEvent.create).toHaveBeenCalledTimes(1)
    const arg = prismaMock.stripeEvent.create.mock.calls[0][0]
    expect(arg.data.id).toBe("evt_test_1")
    expect(arg.data.type).toBe("account.updated")

    // First-time event proceeds to the handler (account.updated branch).
    expect(prismaMock.business.updateMany).toHaveBeenCalledTimes(1)
  })

  it("short-circuits a duplicate event with 200 and runs NO side effects", async () => {
    // The unique-violation means we have already processed this event.
    prismaMock.stripeEvent.create.mockRejectedValueOnce(new FakeP2002())

    const res = await POST(makeRequest("{}"))

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.duplicate).toBe(true)
    expect(json.message).toBe("[duplicate event]")

    // CRITICAL: the handler switch never ran — no business/payment mutations.
    expect(prismaMock.business.updateMany).not.toHaveBeenCalled()
    expect(prismaMock.payment.update).not.toHaveBeenCalled()
    expect(prismaMock.appointment.update).not.toHaveBeenCalled()
  })

  it("rejects with 400 (and never records an event) on a bad signature", async () => {
    constructEventMock.mockImplementationOnce(() => {
      throw new Error("bad signature")
    })

    const res = await POST(makeRequest("{}"))

    expect(res.status).toBe(400)
    // No idempotency row is written when the signature is invalid.
    expect(prismaMock.stripeEvent.create).not.toHaveBeenCalled()
  })

  it("does not short-circuit when the record write fails for a non-P2002 reason", async () => {
    // A transient DB error must NOT be treated as a duplicate — it should bubble
    // to the catch-all 500 so Stripe retries (without processing side effects).
    prismaMock.stripeEvent.create.mockRejectedValueOnce(new Error("connection reset"))

    const res = await POST(makeRequest("{}"))

    expect(res.status).toBe(500)
    expect(prismaMock.business.updateMany).not.toHaveBeenCalled()
  })
})
