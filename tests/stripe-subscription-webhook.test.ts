import { describe, it, expect, beforeEach, vi } from "vitest"

// Proves the SAL subscription webhook cases over a mock Prisma + mock Stripe
// (no DB, no network). Mirrors the harness in stripe-webhook-idempotency.test.ts:
//   - checkout.session.completed (subscription mode) → store sub+customer, active/pro
//   - customer.subscription.created → persist sub id + status, keyed by durable id
//   - customer.subscription.updated → status mapping (active/trialing→active,
//     past_due/unpaid→past_due, canceled→cancelled, paused→paused)
//   - customer.subscription.deleted → cancelled, RETAINS stripeSubscriptionId
//   - invoice.payment_failed → past_due (only for a LIVE subscription)
//   - unknown customer (invoice without customer) → no-op
//   - OUT-OF-ORDER delivery (sub event before checkout.session.completed) →
//     the business is still resolved via metadata.businessId / customer id

const { prismaMock, constructEventMock, headersGetMock } = vi.hoisted(() => {
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test"
  const prismaMock = {
    stripeEvent: { create: vi.fn(), findUnique: vi.fn() },
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

// A fixed event.created (UNIX seconds) for fixtures that flow through the
// freshness guard. The default world watermark is null, so any event with this
// created passes. Stale-event tests override the world watermark to be NEWER
// than this so the guard rejects the write.
const NOW_SECS = 1_700_000_000
const NOW_DATE = new Date(NOW_SECS * 1000)

// A where-clause-aware updateMany mock so the 0-match path is actually
// observable. Resolves a row only when the where targets one of the rows we
// "have"; otherwise count: 0. The default world has a single business keyed by
// id BIZ AND customer cus_123 AND subscription sub_123 (i.e. already fully
// linked). Individual tests narrow `world` to model out-of-order states.
//
// `subscriptionStatus` / `lastBillingEventAt` let the freshness guard + the
// recovery handler's status-scoped writes be exercised: where clauses can now
// carry `subscriptionStatus` (recovery only flips a past_due row) and an `OR`
// freshness predicate (null OR lastBillingEventAt < event.created).
type World = {
  id?: string
  stripeCustomerId?: string
  stripeSubscriptionId?: string
  subscriptionStatus?: string
  lastBillingEventAt?: Date | null
}
let world: World

// Evaluate the freshness OR added to every absolute-state billing write:
//   OR: [{ lastBillingEventAt: null }, { lastBillingEventAt: { lt: <date> } }]
// The world matches when its watermark is null OR strictly older than the cutoff.
function freshnessMatches(or: unknown): boolean {
  if (!Array.isArray(or)) return false
  return or.some((clause) => {
    const c = clause as { lastBillingEventAt?: unknown }
    if (c.lastBillingEventAt === null) return world.lastBillingEventAt == null
    const cmp = c.lastBillingEventAt as { lt?: Date } | undefined
    if (cmp?.lt instanceof Date) {
      if (world.lastBillingEventAt == null) return true
      return world.lastBillingEventAt.getTime() < cmp.lt.getTime()
    }
    return false
  })
}

function whereMatches(where: Record<string, unknown>): boolean {
  // Freshness guard: if present, the world's watermark must satisfy it.
  if ("OR" in where && !freshnessMatches(where.OR)) return false
  // Status-scoped writes (recovery flip / watermark bump): the world's current
  // status must equal the requested one.
  if ("subscriptionStatus" in where && where.subscriptionStatus !== world.subscriptionStatus) {
    return false
  }
  if ("id" in where) return where.id === world.id
  if ("stripeSubscriptionId" in where) return where.stripeSubscriptionId === world.stripeSubscriptionId
  if ("stripeCustomerId" in where) {
    if (where.stripeCustomerId !== world.stripeCustomerId) return false
    // invoice.payment_failed adds NOT: { stripeSubscriptionId: null } — only
    // matches when the business currently has a live subscription on file.
    if ("NOT" in where) return Boolean(world.stripeSubscriptionId)
    return true
  }
  return false
}

beforeEach(() => {
  vi.clearAllMocks()
  headersGetMock.mockReturnValue("sig_test")
  // First-time event: the early idempotency read finds nothing; the post-success
  // record write succeeds.
  prismaMock.stripeEvent.findUnique.mockResolvedValue(null)
  prismaMock.stripeEvent.create.mockResolvedValue({ id: "evt" })
  // Default: fully-linked, active, no watermark yet (so freshness always passes).
  world = {
    id: BIZ,
    stripeCustomerId: "cus_123",
    stripeSubscriptionId: "sub_123",
    subscriptionStatus: "active",
    lastBillingEventAt: null,
  }
  prismaMock.business.updateMany.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => ({
    count: whereMatches(where) ? 1 : 0,
  }))
})

describe("checkout.session.completed (subscription mode)", () => {
  it("stores subscription + customer and marks the business active/pro", async () => {
    constructEventMock.mockReturnValue({
      id: "evt_checkout",
      type: "checkout.session.completed",
      created: NOW_SECS,
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
    // Activation now carries the freshness guard (so a stale completed event
    // can't resurrect a later cancellation) + a watermark bump.
    expect(arg.where.id).toBe(BIZ)
    expect(arg.where.OR).toEqual([
      { lastBillingEventAt: null },
      { lastBillingEventAt: { lt: NOW_DATE } },
    ])
    expect(arg.data.subscriptionStatus).toBe("active")
    expect(arg.data.subscriptionTier).toBe("pro")
    expect(arg.data.stripeSubscriptionId).toBe("sub_123")
    expect(arg.data.stripeCustomerId).toBe("cus_123")
    expect(arg.data.lastBillingEventAt).toEqual(NOW_DATE)
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

describe("customer.subscription.created", () => {
  it("persists sub id + status keyed by metadata.businessId (before checkout completes)", async () => {
    // Out-of-order: the row has NO subscription id yet (checkout hasn't landed).
    world = { id: BIZ, stripeCustomerId: "cus_123" }

    constructEventMock.mockReturnValue({
      id: "evt_created",
      type: "customer.subscription.created",
      created: NOW_SECS,
      data: { object: { id: "sub_123", status: "active", customer: "cus_123", metadata: { businessId: BIZ } } },
    })

    const res = await POST(makeRequest("{}"))
    expect(res.status).toBe(200)

    const arg = prismaMock.business.updateMany.mock.calls[0][0]
    // Resolved by the durable metadata.businessId, NOT the not-yet-stored sub id,
    // now with the freshness guard + watermark bump folded in.
    expect(arg.where.id).toBe(BIZ)
    expect(arg.where.OR).toEqual([
      { lastBillingEventAt: null },
      { lastBillingEventAt: { lt: NOW_DATE } },
    ])
    expect(arg.data.subscriptionStatus).toBe("active")
    expect(arg.data.stripeSubscriptionId).toBe("sub_123")
    expect(arg.data.lastBillingEventAt).toEqual(NOW_DATE)
  })
})

describe("customer.subscription.updated — status mapping", () => {
  const cases: Array<[string, string]> = [
    ["active", "active"],
    ["trialing", "active"],
    ["past_due", "past_due"],
    ["unpaid", "past_due"],
    ["incomplete", "past_due"],
    ["paused", "paused"],
    ["canceled", "cancelled"],
  ]

  for (const [stripeStatus, mapped] of cases) {
    it(`maps Stripe "${stripeStatus}" → "${mapped}" (resolved by customer id)`, async () => {
      constructEventMock.mockReturnValue({
        id: `evt_upd_${stripeStatus}`,
        type: "customer.subscription.updated",
        created: NOW_SECS,
        data: { object: { id: "sub_123", status: stripeStatus, customer: "cus_123", metadata: {} } },
      })

      const res = await POST(makeRequest("{}"))
      expect(res.status).toBe(200)

      expect(prismaMock.business.updateMany).toHaveBeenCalledTimes(1)
      const arg = prismaMock.business.updateMany.mock.calls[0][0]
      // metadata is empty here, so the resolver falls back to the customer id
      // (durable), NOT the subscription id. The freshness guard is folded in.
      expect(arg.where.stripeCustomerId).toBe("cus_123")
      expect(arg.where.OR).toEqual([
        { lastBillingEventAt: null },
        { lastBillingEventAt: { lt: NOW_DATE } },
      ])
      expect(arg.data.subscriptionStatus).toBe(mapped)
      // The sub id is persisted alongside the status.
      expect(arg.data.stripeSubscriptionId).toBe("sub_123")
      // The watermark is bumped to this event's created time.
      expect(arg.data.lastBillingEventAt).toEqual(NOW_DATE)
    })
  }

  it("resolves an OUT-OF-ORDER past_due update (sub id not yet stored) via metadata.businessId", async () => {
    // The .updated arrived BEFORE checkout.session.completed: the row's
    // stripeSubscriptionId is still null. Keying on the sub id would 0-match and
    // silently lose the event. metadata.businessId saves it.
    world = { id: BIZ, stripeCustomerId: "cus_123" }

    constructEventMock.mockReturnValue({
      id: "evt_upd_ooo",
      type: "customer.subscription.updated",
      created: NOW_SECS,
      data: { object: { id: "sub_999", status: "past_due", customer: "cus_other", metadata: { businessId: BIZ } } },
    })

    const res = await POST(makeRequest("{}"))
    expect(res.status).toBe(200)

    const arg = prismaMock.business.updateMany.mock.calls[0][0]
    expect(arg.where.id).toBe(BIZ)
    expect(arg.data.subscriptionStatus).toBe("past_due")
  })
})

describe("customer.subscription.deleted", () => {
  it("sets cancelled and RETAINS stripeSubscriptionId (so the hard gate can fire)", async () => {
    constructEventMock.mockReturnValue({
      id: "evt_del",
      type: "customer.subscription.deleted",
      created: NOW_SECS,
      data: { object: { id: "sub_123", status: "canceled", customer: "cus_123", metadata: {} } },
    })

    const res = await POST(makeRequest("{}"))
    expect(res.status).toBe(200)

    const arg = prismaMock.business.updateMany.mock.calls[0][0]
    // Resolved by customer id (metadata empty), sub id NOT nulled.
    expect(arg.where.stripeCustomerId).toBe("cus_123")
    expect(arg.data.subscriptionStatus).toBe("cancelled")
    expect(arg.data).not.toHaveProperty("stripeSubscriptionId")
  })

  it("resolves an OUT-OF-ORDER deletion (sub id not yet stored) via metadata.businessId", async () => {
    world = { id: BIZ, stripeCustomerId: "cus_123" }

    constructEventMock.mockReturnValue({
      id: "evt_del_ooo",
      type: "customer.subscription.deleted",
      created: NOW_SECS,
      data: { object: { id: "sub_777", status: "canceled", customer: "cus_other", metadata: { businessId: BIZ } } },
    })

    const res = await POST(makeRequest("{}"))
    expect(res.status).toBe(200)

    const arg = prismaMock.business.updateMany.mock.calls[0][0]
    expect(arg.where.id).toBe(BIZ)
    expect(arg.data.subscriptionStatus).toBe("cancelled")
  })
})

describe("invoice.payment_failed", () => {
  it("marks a LIVE-subscription business past_due (keyed by customer id + non-null sub)", async () => {
    constructEventMock.mockReturnValue({
      id: "evt_inv_fail",
      type: "invoice.payment_failed",
      created: NOW_SECS,
      data: { object: { id: "in_1", customer: "cus_123" } },
    })

    const res = await POST(makeRequest("{}"))
    expect(res.status).toBe(200)

    const arg = prismaMock.business.updateMany.mock.calls[0][0]
    expect(arg.where.stripeCustomerId).toBe("cus_123")
    expect(arg.where.NOT).toEqual({ stripeSubscriptionId: null })
    // Freshness guard folded into the where; watermark bumped in the data.
    expect(arg.where.OR).toEqual([
      { lastBillingEventAt: null },
      { lastBillingEventAt: { lt: NOW_DATE } },
    ])
    expect(arg.data.subscriptionStatus).toBe("past_due")
    expect(arg.data.lastBillingEventAt).toEqual(NOW_DATE)
  })

  it("does NOT resurrect past_due for a cancelled salon with no live subscription", async () => {
    // The salon cancelled (no sub id) but kept its customer id; a late invoice
    // for the old subscription arrives. The NOT-null guard 0-matches → no flip.
    world = {
      id: BIZ,
      stripeCustomerId: "cus_123",
      subscriptionStatus: "cancelled",
      lastBillingEventAt: null,
    } // no stripeSubscriptionId

    constructEventMock.mockReturnValue({
      id: "evt_inv_stray",
      type: "invoice.payment_failed",
      created: NOW_SECS,
      data: { object: { id: "in_3", customer: "cus_123" } },
    })

    const res = await POST(makeRequest("{}"))
    expect(res.status).toBe(200)

    // The updateMany was attempted but matched 0 rows (logged, not silently lost).
    expect(prismaMock.business.updateMany).toHaveBeenCalledTimes(1)
    const result = await prismaMock.business.updateMany.mock.results[0].value
    expect(result.count).toBe(0)
  })

  it("does NOT re-flip a RECOVERED salon when a STALE payment_failed arrives late", async () => {
    // The card retry already succeeded: the salon is active and its watermark was
    // bumped to a LATER event. A stale invoice.payment_failed (created EARLIER
    // than that watermark) is then delivered out of order. The freshness guard
    // 0-matches → the recovered, paying salon is NOT re-flipped to past_due.
    world = {
      id: BIZ,
      stripeCustomerId: "cus_123",
      stripeSubscriptionId: "sub_123",
      subscriptionStatus: "active",
      lastBillingEventAt: new Date((NOW_SECS + 100) * 1000), // newer than the stale event
    }

    constructEventMock.mockReturnValue({
      id: "evt_inv_stale_fail",
      type: "invoice.payment_failed",
      created: NOW_SECS, // OLDER than the applied recovery watermark
      data: { object: { id: "in_stale", customer: "cus_123" } },
    })

    const res = await POST(makeRequest("{}"))
    expect(res.status).toBe(200)

    // updateMany was attempted (freshness folded in) but rejected: 0 rows.
    expect(prismaMock.business.updateMany).toHaveBeenCalledTimes(1)
    const arg = prismaMock.business.updateMany.mock.calls[0][0]
    expect(arg.where.OR).toEqual([
      { lastBillingEventAt: null },
      { lastBillingEventAt: { lt: NOW_DATE } },
    ])
    const result = await prismaMock.business.updateMany.mock.results[0].value
    expect(result.count).toBe(0)
  })

  it("no-ops on an invoice with no customer (unknown — never guesses)", async () => {
    constructEventMock.mockReturnValue({
      id: "evt_inv_no_cus",
      type: "invoice.payment_failed",
      created: NOW_SECS,
      data: { object: { id: "in_2", customer: null } },
    })

    const res = await POST(makeRequest("{}"))
    expect(res.status).toBe(200)
    expect(prismaMock.business.updateMany).not.toHaveBeenCalled()
  })
})

describe("invoice.payment_succeeded / invoice.paid — recovery", () => {
  it("flips a past_due LIVE subscription back to active (resolved by customer id)", async () => {
    world = {
      id: BIZ,
      stripeCustomerId: "cus_123",
      stripeSubscriptionId: "sub_123",
      subscriptionStatus: "past_due",
      lastBillingEventAt: null,
    }

    constructEventMock.mockReturnValue({
      id: "evt_inv_paid_recover",
      type: "invoice.payment_succeeded",
      created: NOW_SECS,
      data: { object: { id: "in_recover", customer: "cus_123" } },
    })

    const res = await POST(makeRequest("{}"))
    expect(res.status).toBe(200)

    // First write is the recovery flip past_due → active, scoped + fresh.
    const arg = prismaMock.business.updateMany.mock.calls[0][0]
    expect(arg.where.stripeCustomerId).toBe("cus_123")
    expect(arg.where.NOT).toEqual({ stripeSubscriptionId: null })
    expect(arg.where.subscriptionStatus).toBe("past_due")
    expect(arg.where.OR).toEqual([
      { lastBillingEventAt: null },
      { lastBillingEventAt: { lt: NOW_DATE } },
    ])
    expect(arg.data.subscriptionStatus).toBe("active")
    expect(arg.data.lastBillingEventAt).toEqual(NOW_DATE)

    // The flip matched (count 1), so no second watermark-only write is issued.
    const result = await prismaMock.business.updateMany.mock.results[0].value
    expect(result.count).toBe(1)
    expect(prismaMock.business.updateMany).toHaveBeenCalledTimes(1)
  })

  it("resolves the live subscription via metadata.businessId when present", async () => {
    world = {
      id: BIZ,
      stripeCustomerId: "cus_123",
      stripeSubscriptionId: "sub_123",
      subscriptionStatus: "past_due",
      lastBillingEventAt: null,
    }

    constructEventMock.mockReturnValue({
      id: "evt_inv_paid_meta",
      type: "invoice.paid",
      created: NOW_SECS,
      data: {
        object: {
          id: "in_meta",
          customer: "cus_other",
          subscription_details: { metadata: { businessId: BIZ } },
        },
      },
    })

    const res = await POST(makeRequest("{}"))
    expect(res.status).toBe(200)

    const arg = prismaMock.business.updateMany.mock.calls[0][0]
    // Durable resolution by businessId, not the (mismatched) customer id.
    expect(arg.where.id).toBe(BIZ)
    expect(arg.where.subscriptionStatus).toBe("past_due")
    expect(arg.data.subscriptionStatus).toBe("active")
  })

  it("is a NO-OP for a cancelled salon (a stray successful invoice must not resurrect it)", async () => {
    world = {
      id: BIZ,
      stripeCustomerId: "cus_123",
      stripeSubscriptionId: "sub_123",
      subscriptionStatus: "cancelled",
      lastBillingEventAt: null,
    }

    constructEventMock.mockReturnValue({
      id: "evt_inv_paid_cancelled",
      type: "invoice.payment_succeeded",
      created: NOW_SECS,
      data: { object: { id: "in_cancelled", customer: "cus_123" } },
    })

    const res = await POST(makeRequest("{}"))
    expect(res.status).toBe(200)

    // Neither the past_due-scoped flip nor the active-scoped watermark bump
    // matches a cancelled salon → cancelled is preserved.
    const flip = await prismaMock.business.updateMany.mock.results[0].value
    expect(flip.count).toBe(0)
    for (const call of prismaMock.business.updateMany.mock.calls) {
      expect(call[0].data).not.toMatchObject({ subscriptionStatus: "cancelled" })
      // No call ever sets status to anything for a cancelled world (all writes
      // are scoped to past_due or active, which a cancelled row never matches).
      expect(call[0].where.subscriptionStatus === "cancelled").toBe(false)
    }
  })
})

describe("idempotency — record AFTER success", () => {
  it("short-circuits a duplicate (early findUnique hit) with NO side effects", async () => {
    prismaMock.stripeEvent.findUnique.mockResolvedValue({ id: "evt_dup", type: "customer.subscription.updated" })

    constructEventMock.mockReturnValue({
      id: "evt_dup",
      type: "customer.subscription.updated",
      data: { object: { id: "sub_123", status: "active", customer: "cus_123", metadata: {} } },
    })

    const res = await POST(makeRequest("{}"))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.duplicate).toBe(true)
    expect(prismaMock.business.updateMany).not.toHaveBeenCalled()
    expect(prismaMock.stripeEvent.create).not.toHaveBeenCalled()
  })

  it("records the event ONLY after the handler runs (so a 500 leaves no row)", async () => {
    constructEventMock.mockReturnValue({
      id: "evt_after",
      type: "customer.subscription.updated",
      data: { object: { id: "sub_123", status: "active", customer: "cus_123", metadata: {} } },
    })

    const res = await POST(makeRequest("{}"))
    expect(res.status).toBe(200)

    // The handler ran, THEN the event was recorded.
    expect(prismaMock.business.updateMany).toHaveBeenCalledTimes(1)
    expect(prismaMock.stripeEvent.create).toHaveBeenCalledTimes(1)
    const order =
      prismaMock.business.updateMany.mock.invocationCallOrder[0] <
      prismaMock.stripeEvent.create.mock.invocationCallOrder[0]
    expect(order).toBe(true)
  })

  it("does NOT record (and surfaces 500) when the handler throws — Stripe can retry", async () => {
    prismaMock.business.updateMany.mockRejectedValueOnce(new Error("transient DB error"))

    constructEventMock.mockReturnValue({
      id: "evt_throw",
      type: "customer.subscription.updated",
      data: { object: { id: "sub_123", status: "active", customer: "cus_123", metadata: {} } },
    })

    const res = await POST(makeRequest("{}"))
    expect(res.status).toBe(500)
    // No idempotency row was written, so a Stripe retry will re-run the side effect.
    expect(prismaMock.stripeEvent.create).not.toHaveBeenCalled()
  })
})
