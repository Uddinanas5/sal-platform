import { describe, it, expect, vi } from "vitest"
import { reconcileCheckoutSession } from "@/lib/billing/plan"

// P1-5 — reconcileCheckoutSession must NOT re-activate a business by replaying an
// old completed Checkout URL: a Checkout session is complete/paid forever, so the
// LIVE subscription status has to be re-checked before activating.

const BIZ = "biz-1"

function makeStripe(subStatus: string | null) {
  return {
    checkout: {
      sessions: {
        retrieve: vi.fn().mockResolvedValue({
          mode: "subscription",
          status: "complete",
          payment_status: "paid",
          metadata: { businessId: BIZ },
          subscription: "sub_123",
          customer: "cus_123",
        }),
      },
    },
    subscriptions: {
      retrieve: subStatus === null
        ? vi.fn().mockRejectedValue(new Error("no such subscription"))
        : vi.fn().mockResolvedValue({ status: subStatus }),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

describe("reconcileCheckoutSession replay guard", () => {
  it("does NOT activate when the live subscription is canceled", async () => {
    const persist = vi.fn()
    const ok = await reconcileCheckoutSession(makeStripe("canceled"), persist, {
      sessionId: "cs_old",
      businessId: BIZ,
    })
    expect(ok).toBe(false)
    expect(persist).not.toHaveBeenCalled()
  })

  it("does NOT activate when the subscription can't be retrieved", async () => {
    const persist = vi.fn()
    const ok = await reconcileCheckoutSession(makeStripe(null), persist, {
      sessionId: "cs_old",
      businessId: BIZ,
    })
    expect(ok).toBe(false)
    expect(persist).not.toHaveBeenCalled()
  })

  it("activates when the live subscription is active", async () => {
    const persist = vi.fn().mockResolvedValue(undefined)
    const ok = await reconcileCheckoutSession(makeStripe("active"), persist, {
      sessionId: "cs_new",
      businessId: BIZ,
    })
    expect(ok).toBe(true)
    expect(persist).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ subscriptionStatus: "active" }) })
    )
  })

  it("activates for a trialing subscription", async () => {
    const persist = vi.fn().mockResolvedValue(undefined)
    const ok = await reconcileCheckoutSession(makeStripe("trialing"), persist, {
      sessionId: "cs_new",
      businessId: BIZ,
    })
    expect(ok).toBe(true)
  })
})
