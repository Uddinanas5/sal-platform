import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { createDashboardLink } from "@/lib/stripe"

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { accountId } = body

    if (!accountId) {
      return NextResponse.json(
        { error: "Missing account ID" },
        { status: 400 }
      )
    }

    const url = await createDashboardLink(accountId)

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
