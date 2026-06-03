import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createDashboardLink } from "@/lib/stripe"

export async function POST() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Resolve the Stripe account from the caller's OWN business server-side.
    // Never accept an accountId from the request body — doing so let any
    // authenticated user mint a Stripe Express login link into another salon's
    // payment account (cross-tenant financial IDOR).
    const business = await prisma.business.findFirst({
      where: { ownerId: session.user.id, deletedAt: null },
      select: { stripeAccountId: true },
    })

    if (!business?.stripeAccountId) {
      return NextResponse.json(
        { error: "No connected payment account for this business" },
        { status: 400 }
      )
    }

    const url = await createDashboardLink(business.stripeAccountId)

    if (!url) {
      return NextResponse.json(
        { error: "Failed to create dashboard link" },
        { status: 500 }
      )
    }

    return NextResponse.json({ url })
  } catch (error) {
    console.error("Error creating dashboard link:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
