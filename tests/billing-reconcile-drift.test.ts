import { describe, it, expect, vi } from "vitest"

// Proves the PURE reconciliation core (Phase 2C): computeDrift() over plain
// fixtures — one test per Drift kind plus the all-clean case. No DB, no
// network: the loader is a separate thin wrapper exercised in the cron route
// test. Also pins the shared mapStripeStatus (webhook + reconciler must agree).

// reconcile.ts imports the prisma/stripe singletons for its loader; mock them
// so importing the module never touches a connection string.
vi.mock("@/lib/prisma", () => ({ prisma: {} }))
vi.mock("@/lib/stripe", () => ({ stripe: {} }))

import {
  computeDrift,
  mapStripeStatus,
  buildDriftDigest,
  type ReconcileInputs,
} from "@/lib/billing/reconcile"

function inputs(partial: Partial<ReconcileInputs> = {}): ReconcileInputs {
  return {
    stripePaymentIntents: [],
    stripeDisputes: [],
    stripeSubscriptions: [],
    dbPayments: [],
    dbDisputes: [],
    dbBusinesses: [],
    ...partial,
  }
}

const PI_OK = {
  id: "pi_ok",
  status: "succeeded",
  amountReceivedCents: 5000,
  currency: "usd",
}
const PAYMENT_OK = {
  id: "pay_ok",
  processorId: "pi_ok",
  status: "completed",
  totalAmountCents: 5000,
  currency: "USD",
}

describe("computeDrift — all clean", () => {
  it("returns [] when Stripe and the DB fully agree", () => {
    const drift = computeDrift(
      inputs({
        stripePaymentIntents: [PI_OK],
        dbPayments: [PAYMENT_OK],
        stripeDisputes: [
          { id: "du_1", paymentIntentId: "pi_ok", status: "needs_response", amountCents: 5000 },
        ],
        dbDisputes: [{ id: "du_1", status: "needs_response" }],
        stripeSubscriptions: [
          { id: "sub_1", status: "active", metadataBusinessId: "biz_1", customerId: "cus_1" },
        ],
        dbBusinesses: [
          {
            id: "biz_1",
            stripeCustomerId: "cus_1",
            stripeSubscriptionId: "sub_1",
            subscriptionStatus: "active",
          },
        ],
      })
    )
    expect(drift).toEqual([])
  })

  it("ignores in-flight payment intents (processing / requires_*)", () => {
    const drift = computeDrift(
      inputs({
        stripePaymentIntents: [
          { id: "pi_p", status: "processing", amountReceivedCents: 0, currency: "usd" },
          { id: "pi_r", status: "requires_payment_method", amountReceivedCents: 0, currency: "usd" },
        ],
      })
    )
    expect(drift).toEqual([])
  })
})

describe("computeDrift — payment drift kinds", () => {
  it("missing_payment: Stripe says money moved, we have no row", () => {
    const drift = computeDrift(inputs({ stripePaymentIntents: [PI_OK] }))
    expect(drift).toEqual([
      {
        kind: "missing_payment",
        paymentIntentId: "pi_ok",
        stripeStatus: "succeeded",
        amountCents: 5000,
        currency: "usd",
      },
    ])
  })

  it("payment_status_drift: PI succeeded but the row never left pending (missed webhook)", () => {
    const drift = computeDrift(
      inputs({
        stripePaymentIntents: [PI_OK],
        dbPayments: [{ ...PAYMENT_OK, status: "pending" }],
      })
    )
    expect(drift).toEqual([
      {
        kind: "payment_status_drift",
        paymentId: "pay_ok",
        paymentIntentId: "pi_ok",
        dbStatus: "pending",
        stripeStatus: "succeeded",
      },
    ])
  })

  it("payment_status_drift: PI canceled but the row claims completed", () => {
    const drift = computeDrift(
      inputs({
        stripePaymentIntents: [{ ...PI_OK, status: "canceled" }],
        dbPayments: [PAYMENT_OK],
      })
    )
    expect(drift).toEqual([
      {
        kind: "payment_status_drift",
        paymentId: "pay_ok",
        paymentIntentId: "pi_ok",
        dbStatus: "completed",
        stripeStatus: "canceled",
      },
    ])
  })

  it("refunded/disputed rows are NOT status drift for a succeeded PI (post-success lifecycles)", () => {
    const drift = computeDrift(
      inputs({
        stripePaymentIntents: [PI_OK, { ...PI_OK, id: "pi_2" }],
        dbPayments: [
          { ...PAYMENT_OK, status: "refunded" },
          { ...PAYMENT_OK, id: "pay_2", processorId: "pi_2", status: "disputed" },
        ],
      })
    )
    expect(drift).toEqual([])
  })

  it("payment_amount_drift: amounts disagree on a settled payment", () => {
    const drift = computeDrift(
      inputs({
        stripePaymentIntents: [PI_OK],
        dbPayments: [{ ...PAYMENT_OK, totalAmountCents: 4500 }],
      })
    )
    expect(drift).toEqual([
      {
        kind: "payment_amount_drift",
        paymentId: "pay_ok",
        paymentIntentId: "pi_ok",
        dbAmountCents: 4500,
        stripeAmountCents: 5000,
      },
    ])
  })
})

describe("computeDrift — dispute drift kinds", () => {
  it("missing_dispute: Stripe has a dispute we never recorded (missed webhook)", () => {
    const drift = computeDrift(
      inputs({
        stripeDisputes: [
          { id: "du_x", paymentIntentId: "pi_ok", status: "needs_response", amountCents: 5000 },
        ],
      })
    )
    expect(drift).toEqual([
      {
        kind: "missing_dispute",
        disputeId: "du_x",
        paymentIntentId: "pi_ok",
        stripeStatus: "needs_response",
        amountCents: 5000,
      },
    ])
  })

  it("dispute_status_drift: our row's status disagrees with Stripe's", () => {
    const drift = computeDrift(
      inputs({
        stripeDisputes: [
          { id: "du_x", paymentIntentId: null, status: "lost", amountCents: 5000 },
        ],
        dbDisputes: [{ id: "du_x", status: "under_review" }],
      })
    )
    expect(drift).toEqual([
      {
        kind: "dispute_status_drift",
        disputeId: "du_x",
        dbStatus: "under_review",
        stripeStatus: "lost",
      },
    ])
  })
})

describe("computeDrift — subscription drift", () => {
  const BIZ = {
    id: "biz_1",
    stripeCustomerId: "cus_1",
    stripeSubscriptionId: "sub_1",
    subscriptionStatus: "active",
  }

  it("subscription_status_drift: Stripe canceled, DB still active", () => {
    const drift = computeDrift(
      inputs({
        stripeSubscriptions: [
          { id: "sub_1", status: "canceled", metadataBusinessId: "biz_1", customerId: "cus_1" },
        ],
        dbBusinesses: [BIZ],
      })
    )
    expect(drift).toEqual([
      {
        kind: "subscription_status_drift",
        businessId: "biz_1",
        subscriptionId: "sub_1",
        dbStatus: "active",
        stripeStatus: "canceled",
        expectedStatus: "cancelled",
      },
    ])
  })

  it("trialing maps to active — NOT drift against an active business", () => {
    const drift = computeDrift(
      inputs({
        stripeSubscriptions: [
          { id: "sub_1", status: "trialing", metadataBusinessId: "biz_1", customerId: "cus_1" },
        ],
        dbBusinesses: [BIZ],
      })
    )
    expect(drift).toEqual([])
  })

  it("an old, replaced subscription for the same customer is skipped", () => {
    const drift = computeDrift(
      inputs({
        stripeSubscriptions: [
          // canceled OLD sub — the business has since moved to sub_2
          { id: "sub_1", status: "canceled", metadataBusinessId: "biz_1", customerId: "cus_1" },
        ],
        dbBusinesses: [{ ...BIZ, stripeSubscriptionId: "sub_2" }],
      })
    )
    expect(drift).toEqual([])
  })

  it("a foreign/unattributable subscription is skipped (not ours to judge)", () => {
    const drift = computeDrift(
      inputs({
        stripeSubscriptions: [
          { id: "sub_x", status: "canceled", metadataBusinessId: null, customerId: "cus_unknown" },
        ],
        dbBusinesses: [BIZ],
      })
    )
    expect(drift).toEqual([])
  })
})

describe("mapStripeStatus — shared webhook/reconciler mapping", () => {
  it("maps every Stripe status onto SAL's enum exactly as the webhook always has", () => {
    expect(mapStripeStatus("active")).toBe("active")
    expect(mapStripeStatus("trialing")).toBe("active")
    expect(mapStripeStatus("past_due")).toBe("past_due")
    expect(mapStripeStatus("unpaid")).toBe("past_due")
    expect(mapStripeStatus("incomplete")).toBe("past_due")
    expect(mapStripeStatus("incomplete_expired")).toBe("past_due")
    expect(mapStripeStatus("paused")).toBe("paused")
    expect(mapStripeStatus("canceled")).toBe("cancelled")
  })
})

describe("buildDriftDigest", () => {
  it("subject carries the count; body lists each drift item", () => {
    const { subject, html } = buildDriftDigest(
      [
        {
          kind: "missing_payment",
          paymentIntentId: "pi_x",
          stripeStatus: "succeeded",
          amountCents: 1200,
          currency: "usd",
        },
      ],
      new Date("2026-06-11T14:30:00Z")
    )
    expect(subject).toContain("1 item")
    expect(html).toContain("missing_payment")
    expect(html).toContain("pi_x")
  })
})
