import { NextResponse } from "next/server"
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

    // Honest guard: a business that already has a live subscription should not
    // be able to create a second one. (status comes from webhooks; trust it.)
    if (
      business.stripeSubscriptionId &&
      (business.subscriptionStatus === "active" ||
        business.subscriptionStatus === "trialing")
    ) {
      return NextResponse.json(
        { error: "This business already has an active subscription" },
        { status: 409 }
      )
    }

    // Create or reuse the Stripe Customer that represents this salon-as-payer,
    // and persist it so the Customer Portal + future checkouts reuse it.
    let customerId = business.stripeCustomerId
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: business.email ?? business.owner?.email ?? undefined,
        name: business.name,
        metadata: { businessId: business.id },
      })
      customerId = customer.id
      await prisma.business.update({
        where: { id: business.id },
        data: { stripeCustomerId: customerId },
      })
    }

    // Lazily provision the SAL Price catalog in whichever Stripe mode the keys
    // point at (test or live). Idempotent — keyed on lookup_key.
    const { setupPriceId, monthlyPriceId } = await ensureBillingPrices(stripe)

    const session = await stripe.checkout.sessions.create({
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
      success_url: `${appUrl}/settings?tab=billing&billing=success`,
      cancel_url: `${appUrl}/settings?tab=billing&billing=cancelled`,
    })

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
