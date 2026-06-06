import { describe, it, expect, beforeEach, vi } from "vitest"

// Proves the Stripe webhook idempotency gate over a mock Prisma + mock Stripe
// (no DB, no network). The gate is RECORD-AFTER-SUCCESS (at-least-once):
//   - an early read-only check (prisma.stripeEvent.findUnique) short-circuits a
//     GENUINE duplicate (an event we already fully processed) with HTTP 200 and
//     "[duplicate event]", running NO side effects
//   - a first-time event proceeds to the handler switch, and the idempotency row
//     is written (prisma.stripeEvent.create) ONLY AFTER the handler succeeds
//   - if the handler throws, the row is NEVER written → a Stripe retry re-runs
//     the side effect instead of being wrongly short-circuited as a duplicate
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
    stripeEvent: { create: vi.fn(), findUnique: vi.fn() },
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
  prismaMock.stripeEvent.findUnique.mockResolvedValue(null)
  prismaMock.stripeEvent.create.mockResolvedValue({ id: ACCOUNT_EVENT.id })
  prismaMock.business.updateMany.mockResolvedValue({ count: 1 })
  prismaMock.$transaction.mockImplementation(async (fn: unknown) => {
    if (typeof fn === "function") return (fn as (tx: unknown) => unknown)(prismaMock)
    return undefined
  })
})

describe("stripe webhook — idempotency gate (record after success)", () => {
  it("runs the handler, THEN records the event id", async () => {
    const res = await POST(makeRequest("{}"))
    expect(res.status).toBe(200)

    // First-time event proceeds to the handler (account.updated branch)...
    expect(prismaMock.business.updateMany).toHaveBeenCalledTimes(1)
    // ...and the idempotency row is written with the Stripe event id + type AFTER.
    expect(prismaMock.stripeEvent.create).toHaveBeenCalledTimes(1)
    const arg = prismaMock.stripeEvent.create.mock.calls[0][0]
    expect(arg.data.id).toBe("evt_test_1")
    expect(arg.data.type).toBe("account.updated")

    const order =
      prismaMock.business.updateMany.mock.invocationCallOrder[0] <
      prismaMock.stripeEvent.create.mock.invocationCallOrder[0]
    expect(order).toBe(true)
  })

  it("short-circuits a duplicate event (early findUnique hit) with 200 and NO side effects", async () => {
    prismaMock.stripeEvent.findUnique.mockResolvedValueOnce({
      id: ACCOUNT_EVENT.id,
      type: ACCOUNT_EVENT.type,
    })

    const res = await POST(makeRequest("{}"))

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.duplicate).toBe(true)
    expect(json.message).toBe("[duplicate event]")

    // CRITICAL: the handler switch never ran — no business/payment mutations,
    // and we do NOT re-write the idempotency row.
    expect(prismaMock.business.updateMany).not.toHaveBeenCalled()
    expect(prismaMock.payment.update).not.toHaveBeenCalled()
    expect(prismaMock.appointment.update).not.toHaveBeenCalled()
    expect(prismaMock.stripeEvent.create).not.toHaveBeenCalled()
  })

  it("rejects with 400 (and never touches the ledger) on a bad signature", async () => {
    constructEventMock.mockImplementationOnce(() => {
      throw new Error("bad signature")
    })

    const res = await POST(makeRequest("{}"))

    expect(res.status).toBe(400)
    expect(prismaMock.stripeEvent.findUnique).not.toHaveBeenCalled()
    expect(prismaMock.stripeEvent.create).not.toHaveBeenCalled()
  })

  it("does NOT record the event (and returns 500) when the handler throws — Stripe retries", async () => {
    // A transient handler failure must leave NO idempotency row, so the retry
    // re-runs the side effect rather than being short-circuited as a duplicate.
    prismaMock.business.updateMany.mockRejectedValueOnce(new Error("connection reset"))

    const res = await POST(makeRequest("{}"))

    expect(res.status).toBe(500)
    expect(prismaMock.stripeEvent.create).not.toHaveBeenCalled()
  })

  it("swallows a P2002 on the post-success record (concurrent delivery already wrote it)", async () => {
    class FakeP2002 extends Error {
      code = "P2002"
      constructor() {
        super("Unique constraint failed")
      }
    }
    prismaMock.stripeEvent.create.mockRejectedValueOnce(new FakeP2002())

    const res = await POST(makeRequest("{}"))

    // Handler ran successfully; the duplicate ledger write is benign → still 200.
    expect(res.status).toBe(200)
    expect(prismaMock.business.updateMany).toHaveBeenCalledTimes(1)
  })
})
