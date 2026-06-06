// Pure billing-gate decision logic, extracted so it can be unit-tested without
// rendering a server component. SAFE-BY-DEFAULT is the entire point:
//
//   - A business that NEVER subscribed (hasSubscription=false) is NEVER gated,
//     regardless of status. Every founding beta salon sits here.
//   - billingExempt businesses are NEVER gated.
//   - status "past_due" → a non-blocking banner only (full access retained).
//   - status "paused" (Stripe pause_collection — a TEMPORARY hold, the sub still
//     exists) → a non-blocking banner only. Never a hard gate.
//   - HARD gate ("redirect") ONLY when: status === "cancelled" AND the business
//     once had a subscription (hasSubscription=true) AND !billingExempt.

export type BillingGateInput = {
  status: string | null | undefined
  hasSubscription: boolean
  billingExempt: boolean
}

export type BillingGateDecision =
  | { kind: "allow" } // full access, no banner
  | { kind: "banner"; banner: "past_due" | "paused" } // full access + notice
  | { kind: "gate" } // hard redirect to billing

export function decideBillingGate(input: BillingGateInput): BillingGateDecision {
  // Exempt salons (founder waiver) are always fully allowed.
  if (input.billingExempt) return { kind: "allow" }

  // Never-subscribed salons are always fully allowed — the safe default.
  if (!input.hasSubscription) return { kind: "allow" }

  // Subscribed-then-cancelled is the ONLY hard gate.
  if (input.status === "cancelled") return { kind: "gate" }

  // Payment failed but still subscribed → non-blocking banner.
  if (input.status === "past_due") return { kind: "banner", banner: "past_due" }

  // Temporarily paused (pause_collection) → non-blocking banner; the sub still
  // exists and is expected to resume, so the salon keeps full dashboard access.
  if (input.status === "paused") return { kind: "banner", banner: "paused" }

  return { kind: "allow" }
}
