import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { stripe, createConnectAccount } from "@/lib/stripe"

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { businessId, businessName, email } = body

    if (!businessId || !businessName || !email) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Verify user owns this business
    const business = await prisma.business.findFirst({
      where: {
        id: businessId,
        ownerId: session.user.id,
        deletedAt: null,
      },
    })

    if (!business) {
      return NextResponse.json(
        { error: "Business not found or access denied" },
        { status: 404 }
      )
    }

    // Check if already has a Stripe account
    if (business.stripeAccountId) {
      // Create a new account link for existing account
      const accountLink = await stripe.accountLinks.create({
        account: business.stripeAccountId,
        refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?tab=payments&stripe_refresh=true`,
        return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?tab=payments&stripe_return=true`,
        type: "account_onboarding",
      })

      return NextResponse.json({ onboardingUrl: accountLink.url })
    }

    // Create new Stripe Connect account
    const result = await createConnectAccount(
      businessId,
      email,
      businessName,
      "US" // Could be passed from client based on business location
    )

    if (!result) {
      return NextResponse.json(
        { error: "Failed to create Stripe account" },
        { status: 500 }
      )
    }

    // Save the Stripe account ID to the business
    await prisma.business.update({
      where: { id: businessId },
      data: {
        stripeAccountId: result.accountId,
        stripeAccountStatus: "pending",
      },
    })

    return NextResponse.json({ onboardingUrl: result.onboardingUrl })
  } catch (error) {
    console.error("Error in Stripe connect:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
