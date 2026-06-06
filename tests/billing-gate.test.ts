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

  it("allows an active, subscribed, non-exempt business with no banner", () => {
    expect(
      decideBillingGate({ status: "active", hasSubscription: true, billingExempt: false })
    ).toEqual({ kind: "allow" })
  })
})
