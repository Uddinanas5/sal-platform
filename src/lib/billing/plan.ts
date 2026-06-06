import type Stripe from "stripe"

// SAL subscription billing — the salon paying SAL (distinct from Stripe Connect,
// which is the salon collecting money from ITS clients). This is the founder's
// Grand Slam Offer: a one-time setup fee + a recurring monthly subscription.

// Dollar amounts (USD). Stripe works in the smallest currency unit (cents), so
// multiply by 100 when creating Prices.
export const SETUP_FEE_USD = 1500
export const MONTHLY_USD = 497

// Stable lookup_keys so we can find-or-create Prices at runtime. lookup_key is
// the contract between this code and Stripe — it never has to be configured by
// hand in the Dashboard, and it is the same in test and live mode.
export const SETUP_LOOKUP_KEY = "sal_setup_1500"
export const MONTHLY_LOOKUP_KEY = "sal_monthly_497"

export const SUBSCRIPTION_TIER = "pro" as const

export type BillingPrices = {
  setupPriceId: string
  monthlyPriceId: string
}

// Find-or-create the two Prices SAL bills on. Idempotent: a Price is located by
// its lookup_key first; only if it is missing do we create the Product + Price.
// Works identically in test and live mode (Stripe keys decide the mode), so the
// founder never has to click anything in the Stripe dashboard — the first
// checkout in a given mode lazily provisions the catalog there.
export async function ensureBillingPrices(stripe: Stripe): Promise<BillingPrices> {
  const [setupPriceId, monthlyPriceId] = await Promise.all([
    findOrCreatePrice(stripe, {
      lookupKey: SETUP_LOOKUP_KEY,
      productName: "SAL Setup Fee",
      productDescription: "One-time SAL onboarding & setup",
      unitAmount: SETUP_FEE_USD * 100,
      recurring: null,
    }),
    findOrCreatePrice(stripe, {
      lookupKey: MONTHLY_LOOKUP_KEY,
      productName: "SAL Subscription",
      productDescription: "SAL platform subscription (monthly)",
      unitAmount: MONTHLY_USD * 100,
      recurring: { interval: "month" },
    }),
  ])

  return { setupPriceId, monthlyPriceId }
}

// Server-side reconciliation of a completed Checkout Session on return from
// Stripe. The success_url carries &session_id={CHECKOUT_SESSION_ID}; when the
// salon lands back on /settings we retrieve the session and, if it is a PAID,
// COMPLETE subscription session belonging to this business, persist the active
// state immediately rather than waiting on the webhook. This closes the UI
// window where the "Set up billing" CTA could otherwise reappear post-payment
// (and let a salon mint a SECOND subscription). It is idempotent with the
// webhook: both write the same absolute target state keyed by the same ids.
//
// `persist` is the narrow Prisma surface we touch (business.updateMany), passed
// in so this stays free of a direct prisma import (and trivially mockable).
export async function reconcileCheckoutSession(
  stripe: Stripe,
  persist: (args: {
    where: { id: string }
    data: {
      subscriptionStatus: "active"
      subscriptionTier: typeof SUBSCRIPTION_TIER
      stripeSubscriptionId?: string
      stripeCustomerId?: string
    }
  }) => Promise<unknown>,
  opts: { sessionId: string; businessId: string }
): Promise<boolean> {
  let session: Stripe.Checkout.Session | null = null
  try {
    session = await stripe.checkout.sessions.retrieve(opts.sessionId)
  } catch {
    return false
  }
  if (!session) return false

  // Only a PAID, COMPLETE subscription session for THIS business counts. The
  // businessId match is the trust anchor — we never activate a business from a
  // session id that doesn't carry its own businessId.
  if (session.mode !== "subscription") return false
  if (session.status !== "complete" || session.payment_status !== "paid") return false
  const sessionBusinessId =
    session.metadata?.businessId ?? session.client_reference_id ?? null
  if (sessionBusinessId !== opts.businessId) return false

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id ?? undefined
  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id ?? undefined

  await persist({
    where: { id: opts.businessId },
    data: {
      subscriptionStatus: "active",
      subscriptionTier: SUBSCRIPTION_TIER,
      ...(subscriptionId ? { stripeSubscriptionId: subscriptionId } : {}),
      ...(customerId ? { stripeCustomerId: customerId } : {}),
    },
  })
  return true
}

async function findOrCreatePrice(
  stripe: Stripe,
  opts: {
    lookupKey: string
    productName: string
    productDescription: string
    unitAmount: number
    recurring: { interval: "month" } | null
  }
): Promise<string> {
  // 1) Look up an existing Price by its lookup_key (the idempotency anchor).
  const existing = await stripe.prices.list({
    lookup_keys: [opts.lookupKey],
    active: true,
    limit: 1,
  })
  if (existing.data.length > 0) {
    return existing.data[0].id
  }

  // 2) None found — create the Product, then the Price carrying the lookup_key.
  //    transfer_lookup_key is not needed: there is no prior Price to move it from.
  const product = await stripe.products.create({
    name: opts.productName,
    description: opts.productDescription,
  })

  const price = await stripe.prices.create({
    product: product.id,
    currency: "usd",
    unit_amount: opts.unitAmount,
    lookup_key: opts.lookupKey,
    ...(opts.recurring ? { recurring: opts.recurring } : {}),
  })

  return price.id
}
