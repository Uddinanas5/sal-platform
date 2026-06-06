import { NextResponse } from "next/server"
import type Stripe from "stripe"
import { getBusinessContext } from "@/lib/auth-utils"
import { hasRole } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { stripe } from "@/lib/stripe"
import { ensureBillingPrices } from "@/lib/billing/plan"

// SAL subscription checkout — the salon owner pays SAL ($1,500 one-time setup +
// $497/mo). Uses a Checkout Session in subscription mode with two line items:
// the recurring monthly Price plus the one-time setup Price (Stripe allows
// mixing a one-time line item into a subscription-mode session). State is driven
// entirely by the webhook (checkout.session.completed) — we never mark a
// business "active" from this route; we only mint the redirect URL.
export async function POST() {
  try {
    let ctx
    try {
      ctx = await getBusinessContext()
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Owner-only: billing is the business owner's responsibility, not staff/admin.
    if (!hasRole(ctx.role, "owner")) {
      return NextResponse.json(
        { error: "Only the business owner can set up billing" },
        { status: 403 }
      )
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    if (!appUrl) {
      return NextResponse.json(
        { error: "Billing is not configured" },
        { status: 500 }
      )
    }

    const business = await prisma.business.findUnique({
      where: { id: ctx.businessId },
      select: {
        id: true,
        name: true,
        email: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        subscriptionStatus: true,
        owner: { select: { email: true } },
      },
    })

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 })
    }

    // Honest guard against minting a SECOND paid subscription. The local
    // subscriptionStatus is webhook-driven and LAGS the actual payment, so we
    // must NOT rely on it alone (a salon that just paid but whose webhook hasn't
    // landed would still read status=active/stripeSubscriptionId=null and slip
    // through). Instead, whenever a subscription id is on file, verify its real
    // state at Stripe and only allow a fresh checkout when the existing sub is
    // genuinely terminal (canceled / incomplete_expired) or no longer exists.
    if (business.stripeSubscriptionId) {
      let existing: Stripe.Subscription | null = null
      try {
        existing = await stripe.subscriptions.retrieve(business.stripeSubscriptionId)
      } catch {
        // Not found at Stripe (e.g. stale id) → safe to start fresh.
        existing = null
      }
      if (
        existing &&
        existing.status !== "canceled" &&
        existing.status !== "incomplete_expired"
      ) {
        return NextResponse.json(
          { error: "This business already has a subscription on file" },
          { status: 409 }
        )
      }
    }

    // Create or reuse the Stripe Customer that represents this salon-as-payer,
    // and persist it so the Customer Portal + future checkouts reuse it.
    //
    // Idempotent against concurrent first checkouts (two tabs, etc.):
    //   - The idempotencyKey makes two concurrent same-business creates return
    //     the SAME Customer within Stripe's 24h window (no duplicate).
    //   - The atomic updateMany claim (where stripeCustomerId is still null —
    //     leveraging the @unique constraint) ensures only ONE writer wins. The
    //     loser re-reads the winner's id and deletes its own orphan Customer.
    let customerId = business.stripeCustomerId
    if (!customerId) {
      const customer = await stripe.customers.create(
        {
          email: business.email ?? business.owner?.email ?? undefined,
          name: business.name,
          metadata: { businessId: business.id },
        },
        { idempotencyKey: `sal-customer-${business.id}` }
      )
      const claimed = await prisma.business.updateMany({
        where: { id: business.id, stripeCustomerId: null },
        data: { stripeCustomerId: customer.id },
      })
      if (claimed.count === 1) {
        customerId = customer.id
      } else {
        // Lost the race: another request already set the customer id. Re-read
        // the winner and discard our orphan Customer at Stripe.
        const fresh = await prisma.business.findUnique({
          where: { id: business.id },
          select: { stripeCustomerId: true },
        })
        customerId = fresh?.stripeCustomerId ?? customer.id
        if (customerId !== customer.id) {
          await stripe.customers.del(customer.id).catch(() => {})
        }
      }
    }

    // Lazily provision the SAL Price catalog in whichever Stripe mode the keys
    // point at (test or live). Idempotent — keyed on lookup_key.
    const { setupPriceId, monthlyPriceId } = await ensureBillingPrices(stripe)

    const session = await stripe.checkout.sessions.create(
      {
        mode: "subscription",
        customer: customerId,
        // Do NOT pass payment_method_types — let Stripe pick eligible methods
        // dynamically from Dashboard settings (best practice for conversion).
        line_items: [
          { price: monthlyPriceId, quantity: 1 },
          { price: setupPriceId, quantity: 1 },
        ],
        client_reference_id: business.id,
        // The webhook resolves the business from these — never trust ids the
        // browser could forge; metadata on a signature-verified event is safe.
        metadata: { businessId: business.id },
        subscription_data: { metadata: { businessId: business.id } },
        // success_url carries the session id so /settings can reconcile the
        // payment server-side on return (don't wait only on the webhook) and
        // stop showing the "Set up billing" CTA in the post-payment window.
        success_url: `${appUrl}/settings?tab=billing&billing=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/settings?tab=billing&billing=cancelled`,
      },
      {
        // Deterministic key bucketed by hour: a re-click within the same window
        // reuses the SAME Checkout Session instead of minting a second
        // subscription (defense in depth against double-charge).
        idempotencyKey: `sub-checkout-${business.id}-${Math.floor(Date.now() / 3_600_000)}`,
      }
    )

    if (!session.url) {
      return NextResponse.json(
        { error: "Failed to create checkout session" },
        { status: 500 }
      )
    }

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error("create-subscription-checkout error:", error)
    return NextResponse.json(
      { error: "Failed to start billing checkout" },
      { status: 500 }
    )
  }
}
