import { describe, it, expect } from "vitest"
import { decideBillingGate } from "@/lib/billing/gate"

// Proves the SAFE-BY-DEFAULT billing gate decision (pure function, no DB):
//   - a business that NEVER subscribed is NEVER gated (any status)
//   - billingExempt is NEVER gated (even cancelled + had a subscription)
//   - cancelled + had a subscription + not exempt → HARD gate
//   - past_due + had a subscription → non-blocking banner only

describe("decideBillingGate — safe by default", () => {
  it("NEVER gates a business that never subscribed (free tier / beta default)", () => {
    expect(
      decideBillingGate({ status: "active", hasSubscription: false, billingExempt: false })
    ).toEqual({ kind: "allow" })

    // Even if some status somehow says cancelled, no subscription = no gate.
    expect(
      decideBillingGate({ status: "cancelled", hasSubscription: false, billingExempt: false })
    ).toEqual({ kind: "allow" })

    // And past_due without a subscription shows no banner either.
    expect(
      decideBillingGate({ status: "past_due", hasSubscription: false, billingExempt: false })
    ).toEqual({ kind: "allow" })
  })

  it("NEVER gates a billing-exempt business (founder waiver), even cancelled", () => {
    expect(
      decideBillingGate({ status: "cancelled", hasSubscription: true, billingExempt: true })
    ).toEqual({ kind: "allow" })

    expect(
      decideBillingGate({ status: "past_due", hasSubscription: true, billingExempt: true })
    ).toEqual({ kind: "allow" })
  })

  it("HARD gates only a subscribed-then-cancelled, non-exempt business", () => {
    expect(
      decideBillingGate({ status: "cancelled", hasSubscription: true, billingExempt: false })
    ).toEqual({ kind: "gate" })
  })

  it("shows a non-blocking banner (not a gate) for past_due with a subscription", () => {
    expect(
      decideBillingGate({ status: "past_due", hasSubscription: true, billingExempt: false })
    ).toEqual({ kind: "banner", banner: "past_due" })
  })

  it("shows a non-blocking banner (not a gate) for a paused subscription", () => {
    // Stripe pause_collection is a TEMPORARY hold — the sub still exists and is
    // expected to resume, so the salon keeps full access (never a hard gate).
    expect(
      decideBillingGate({ status: "paused", hasSubscription: true, billingExempt: false })
    ).toEqual({ kind: "banner", banner: "paused" })
  })

  it("allows an active, subscribed, non-exempt business with no banner", () => {
    expect(
      decideBillingGate({ status: "active", hasSubscription: true, billingExempt: false })
    ).toEqual({ kind: "allow" })
  })
})

describe("billing lifecycle — cancellation actually hard-gates (bridging test)", () => {
  // The webhook's customer.subscription.deleted handler writes
  //   { subscriptionStatus: "cancelled" }  and RETAINS stripeSubscriptionId.
  // The layout derives the gate input as:
  //   hasSubscription = Boolean(business.stripeSubscriptionId)
  // This test feeds that exact post-deletion DB shape through the same
  // derivation into decideBillingGate, proving the end-to-end claim
  // "subscribed-then-cancelled hard-gates the salon" — which would be FALSE if
  // the handler nulled stripeSubscriptionId (hasSubscription=false → allow).
  function deriveFromDb(business: {
    subscriptionStatus: string
    stripeSubscriptionId: string | null
    billingExempt: boolean
  }) {
    return decideBillingGate({
      status: business.subscriptionStatus,
      hasSubscription: Boolean(business.stripeSubscriptionId),
      billingExempt: business.billingExempt,
    })
  }

  it("a once-subscribed, now-cancelled salon (sub id retained) is HARD gated", () => {
    expect(
      deriveFromDb({
        subscriptionStatus: "cancelled",
        stripeSubscriptionId: "sub_123", // retained by the deleted handler
        billingExempt: false,
      })
    ).toEqual({ kind: "gate" })
  })

  it("(regression) clearing the sub id on cancellation would WRONGLY allow access", () => {
    // Documents the bug that was fixed: if the deletion handler had nulled the
    // id, the gate would return allow (free access for a cancelled salon).
    expect(
      deriveFromDb({
        subscriptionStatus: "cancelled",
        stripeSubscriptionId: null,
        billingExempt: false,
      })
    ).toEqual({ kind: "allow" })
  })
})
