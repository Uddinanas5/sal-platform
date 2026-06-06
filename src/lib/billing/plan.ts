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

export const SUBSCRIPTION_TIER = "pro"

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
