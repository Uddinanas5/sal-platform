import { NextResponse } from "next/server"
import { getBusinessContext } from "@/lib/auth-utils"
import { hasRole } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { stripe } from "@/lib/stripe"

// Stripe Customer Portal — self-service billing management (update card, view
// invoices, cancel). Owner-only; requires an existing Stripe Customer (created
// the first time the owner ran subscription checkout).
export async function POST() {
  try {
    let ctx
    try {
      ctx = await getBusinessContext()
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!hasRole(ctx.role, "owner")) {
      return NextResponse.json(
        { error: "Only the business owner can manage billing" },
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
      select: { stripeCustomerId: true },
    })

    if (!business?.stripeCustomerId) {
      return NextResponse.json(
        { error: "No billing account for this business yet" },
        { status: 400 }
      )
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: business.stripeCustomerId,
      return_url: `${appUrl}/settings?tab=billing`,
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error("billing-portal error:", error)
    return NextResponse.json(
      { error: "Failed to open billing portal" },
      { status: 500 }
    )
  }
}
