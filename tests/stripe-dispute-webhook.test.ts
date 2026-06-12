import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"

// Proves the charge.dispute.* webhook handling (Phase 2B) over a mock Prisma +
// mock Stripe (no DB, no network), mirroring tests/stripe-webhook-idempotency.
// What must hold:
//
//   1. created → Dispute row recorded (verbatim Stripe id, businessId resolved
//      via the Payment's processorId) + the Payment flips to `disputed` + the
//      founder alert email fires.
//   2. updated (fresh) → the per-row lastEventAt watermark write applies
//      (updateMany hit) without a create.
//   3. closed/won → the Payment is restored to `completed` ONLY-IF-disputed.
//   4. closed/lost → the Payment stays/becomes `disputed` (never `refunded`,
//      never restored).
//   5. OUT-OF-ORDER: a stale `created` delivered AFTER `closed` is swallowed
//      (create → P2002) and regresses NOTHING — no payment write, no alert.
//   6. duplicate delivery short-circuits at the StripeEvent ledger with zero
//      side effects.
//   7. ORPHAN: a dispute with an unknown payment_intent is still recorded
//      (businessId null) with a loud error — money at risk is never dropped.
//   8. ALERT_EMAIL unset → email is skipped with a log, never an error.

const { prismaMock, constructEventMock, headersGetMock, sendEmailMock } = vi.hoisted(() => {
  // The route reads STRIPE_WEBHOOK_SECRET at module-load time. vi.hoisted runs
  // before the route import is evaluated, so set it here.
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test"
  const prismaMock = {
    stripeEvent: { create: vi.fn(), findUnique: vi.fn() },
    business: { updateMany: vi.fn(), findMany: vi.fn() },
    payment: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn(), findMany: vi.fn() },
    appointment: { update: vi.fn() },
    dispute: { create: vi.fn(), updateMany: vi.fn(), findMany: vi.fn() },
    $transaction: vi.fn(),
  }
  return {
    prismaMock,
    constructEventMock: vi.fn(),
    headersGetMock: vi.fn(),
    sendEmailMock: vi.fn(),
  }
})

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/lib/stripe", () => ({
  stripe: { webhooks: { constructEvent: constructEventMock } },
}))
vi.mock("@/lib/email", () => ({ sendEmail: sendEmailMock }))
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({ get: headersGetMock })),
}))

import { POST } from "@/app/api/stripe/webhook/route"

function makeRequest(body: string) {
  return { text: vi.fn(async () => body) } as unknown as Parameters<typeof POST>[0]
}

// event.created in UNIX seconds; the dispute object rides in data.object.
function disputeEvent({
  id = "evt_dispute_1",
  type = "charge.dispute.created",
  created = 1_765_400_000,
  dispute = {} as Record<string, unknown>,
} = {}) {
  return {
    id,
    type,
    created,
    data: {
      object: {
        id: "du_test_1",
        payment_intent: "pi_test_1",
        charge: "ch_test_1",
        amount: 5000,
        currency: "usd",
        reason: "fraudulent",
        status: "needs_response",
        evidence_details: { due_by: 1_766_000_000 },
        ...dispute,
      },
    },
  }
}

const ORIGINAL_ALERT_EMAIL = process.env.ALERT_EMAIL

beforeEach(() => {
  vi.clearAllMocks()
  process.env.ALERT_EMAIL = "founder@meetsal.ai"
  headersGetMock.mockReturnValue("sig_test")
  constructEventMock.mockReturnValue(disputeEvent())
  prismaMock.stripeEvent.findUnique.mockResolvedValue(null)
  prismaMock.stripeEvent.create.mockResolvedValue({ id: "evt_dispute_1" })
  prismaMock.payment.findFirst.mockResolvedValue({ id: "pay_1", businessId: "biz_1" })
  prismaMock.payment.updateMany.mockResolvedValue({ count: 1 })
  prismaMock.dispute.updateMany.mockResolvedValue({ count: 0 })
  prismaMock.dispute.create.mockResolvedValue({ id: "du_test_1" })
  sendEmailMock.mockResolvedValue({ success: true })
})

afterEach(() => {
  if (ORIGINAL_ALERT_EMAIL === undefined) delete process.env.ALERT_EMAIL
  else process.env.ALERT_EMAIL = ORIGINAL_ALERT_EMAIL
})

describe("stripe webhook — charge.dispute.* (record, flip payment, alert)", () => {
  it("created: records the dispute (verbatim id, resolved business) and flips the payment to disputed", async () => {
    const res = await POST(makeRequest("{}"))
    expect(res.status).toBe(200)

    // Payment resolved by processorId = the event's payment_intent.
    expect(prismaMock.payment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { processorId: "pi_test_1" } })
    )

    // Freshness-guarded write first (updateMany where lastEventAt < created)...
    const updateArg = prismaMock.dispute.updateMany.mock.calls[0][0]
    expect(updateArg.where).toEqual({
      id: "du_test_1",
      lastEventAt: { lt: new Date(1_765_400_000 * 1000) },
    })
    // ...then, since no row existed (count 0), the create path with FULL state.
    const createArg = prismaMock.dispute.create.mock.calls[0][0]
    expect(createArg.data.id).toBe("du_test_1") // verbatim — never prefix-validated
    expect(createArg.data.businessId).toBe("biz_1")
    expect(createArg.data.paymentId).toBe("pay_1")
    expect(createArg.data.status).toBe("needs_response")
    expect(createArg.data.amountCents).toBe(5000)
    expect(createArg.data.evidenceDueBy).toEqual(new Date(1_766_000_000 * 1000))
    expect(createArg.data.lastEventAt).toEqual(new Date(1_765_400_000 * 1000))

    // Open status → payment flips to disputed (only from completed/pending).
    expect(prismaMock.payment.updateMany).toHaveBeenCalledWith({
      where: { id: "pay_1", status: { in: ["completed", "pending"] } },
      data: { status: "disputed" },
    })

    // Founder alert fired, and the event was recorded AFTER the handler.
    expect(sendEmailMock).toHaveBeenCalledTimes(1)
    expect(sendEmailMock.mock.calls[0][0].to).toBe("founder@meetsal.ai")
    expect(prismaMock.stripeEvent.create).toHaveBeenCalledTimes(1)
  })

  it("updated (fresh): applies via the watermark updateMany without a create", async () => {
    constructEventMock.mockReturnValue(
      disputeEvent({
        id: "evt_dispute_2",
        type: "charge.dispute.updated",
        created: 1_765_400_100,
        dispute: { status: "under_review" },
      })
    )
    prismaMock.dispute.updateMany.mockResolvedValue({ count: 1 })

    const res = await POST(makeRequest("{}"))
    expect(res.status).toBe(200)
    expect(prismaMock.dispute.create).not.toHaveBeenCalled()
    // Still an open status → payment stays flipped to disputed.
    expect(prismaMock.payment.updateMany).toHaveBeenCalledWith({
      where: { id: "pay_1", status: { in: ["completed", "pending"] } },
      data: { status: "disputed" },
    })
  })

  it("closed/won: restores the payment to completed ONLY-IF-disputed", async () => {
    constructEventMock.mockReturnValue(
      disputeEvent({
        id: "evt_dispute_3",
        type: "charge.dispute.closed",
        created: 1_765_400_200,
        dispute: { status: "won" },
      })
    )
    prismaMock.dispute.updateMany.mockResolvedValue({ count: 1 })

    const res = await POST(makeRequest("{}"))
    expect(res.status).toBe(200)
    expect(prismaMock.payment.updateMany).toHaveBeenCalledWith({
      where: { id: "pay_1", status: "disputed" }, // only-if-disputed guard
      data: { status: "completed" },
    })
  })

  it("closed/lost: the payment stays disputed — never restored, never refunded", async () => {
    constructEventMock.mockReturnValue(
      disputeEvent({
        id: "evt_dispute_4",
        type: "charge.dispute.closed",
        created: 1_765_400_300,
        dispute: { status: "lost" },
      })
    )
    prismaMock.dispute.updateMany.mockResolvedValue({ count: 1 })

    const res = await POST(makeRequest("{}"))
    expect(res.status).toBe(200)

    // The ONLY payment write sets `disputed` (idempotent if already disputed).
    expect(prismaMock.payment.updateMany).toHaveBeenCalledTimes(1)
    expect(prismaMock.payment.updateMany).toHaveBeenCalledWith({
      where: { id: "pay_1", status: { in: ["completed", "pending"] } },
      data: { status: "disputed" },
    })
  })

  it("OUT-OF-ORDER: a stale `created` after `closed` is swallowed (P2002) and regresses nothing", async () => {
    // The closed/won event (created=400) was already applied: the row exists
    // with lastEventAt >= this stale `created` event (created=100). So the
    // watermark updateMany matches 0 rows AND the create hits the unique key.
    class FakeP2002 extends Error {
      code = "P2002"
      constructor() {
        super("Unique constraint failed")
      }
    }
    constructEventMock.mockReturnValue(
      disputeEvent({
        id: "evt_dispute_5",
        type: "charge.dispute.created",
        created: 1_765_400_100, // older than the already-applied closed event
        dispute: { status: "needs_response" },
      })
    )
    prismaMock.dispute.updateMany.mockResolvedValue({ count: 0 })
    prismaMock.dispute.create.mockRejectedValue(new FakeP2002())

    const res = await POST(makeRequest("{}"))

    // Benign no-op: 200, NO payment regression, NO duplicate alert — but the
    // event IS recorded in the ledger (it was processed, as a no-op).
    expect(res.status).toBe(200)
    expect(prismaMock.payment.updateMany).not.toHaveBeenCalled()
    expect(sendEmailMock).not.toHaveBeenCalled()
    expect(prismaMock.stripeEvent.create).toHaveBeenCalledTimes(1)
  })

  it("duplicate delivery short-circuits at the StripeEvent ledger with zero side effects", async () => {
    prismaMock.stripeEvent.findUnique.mockResolvedValueOnce({
      id: "evt_dispute_1",
      type: "charge.dispute.created",
    })

    const res = await POST(makeRequest("{}"))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.duplicate).toBe(true)

    expect(prismaMock.dispute.updateMany).not.toHaveBeenCalled()
    expect(prismaMock.dispute.create).not.toHaveBeenCalled()
    expect(prismaMock.payment.updateMany).not.toHaveBeenCalled()
    expect(sendEmailMock).not.toHaveBeenCalled()
  })

  it("ORPHAN: unknown payment_intent is still recorded (businessId null) with a loud error", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    prismaMock.payment.findFirst.mockResolvedValue(null)

    const res = await POST(makeRequest("{}"))
    expect(res.status).toBe(200)

    const createArg = prismaMock.dispute.create.mock.calls[0][0]
    expect(createArg.data.businessId).toBeNull()
    expect(createArg.data.paymentId).toBeNull()
    expect(createArg.data.status).toBe("needs_response")

    // No payment to flip, but the alert still fires (money at risk) and the
    // orphan is loud in the logs for manual review.
    expect(prismaMock.payment.updateMany).not.toHaveBeenCalled()
    expect(sendEmailMock).toHaveBeenCalledTimes(1)
    expect(
      errorSpy.mock.calls.some((c) => String(c[0]).includes("UNKNOWN payment"))
    ).toBe(true)
    errorSpy.mockRestore()
  })

  it("ALERT_EMAIL unset: the alert is skipped with a log — never an error, never a 500", async () => {
    delete process.env.ALERT_EMAIL
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

    const res = await POST(makeRequest("{}"))
    expect(res.status).toBe(200)
    expect(sendEmailMock).not.toHaveBeenCalled()
    expect(
      warnSpy.mock.calls.some((c) => String(c[0]).includes("ALERT_EMAIL not set"))
    ).toBe(true)
    warnSpy.mockRestore()
  })

  it("funds_withdrawn / funds_reinstated are logged no-ops (no dispute/payment writes)", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    constructEventMock.mockReturnValue(
      disputeEvent({ id: "evt_dispute_6", type: "charge.dispute.funds_withdrawn" })
    )

    const res = await POST(makeRequest("{}"))
    expect(res.status).toBe(200)
    expect(prismaMock.dispute.updateMany).not.toHaveBeenCalled()
    expect(prismaMock.dispute.create).not.toHaveBeenCalled()
    expect(prismaMock.payment.updateMany).not.toHaveBeenCalled()
    expect(
      warnSpy.mock.calls.some((c) => String(c[0]).includes("logged no-op"))
    ).toBe(true)
    warnSpy.mockRestore()
  })
})
