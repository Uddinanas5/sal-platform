import { NextResponse } from "next/server"
import { sendAppointmentNotifications } from "@/lib/cron/appointment-notifications"

export const dynamic = "force-dynamic"

function isAuthorized(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return process.env.NODE_ENV !== "production"

  const url = new URL(req.url)
  const authHeader = req.headers.get("authorization")
  return authHeader === `Bearer ${secret}` || url.searchParams.get("secret") === secret
}

async function run(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const counts = await sendAppointmentNotifications()
  return NextResponse.json({ data: counts })
}

export const GET = run
export const POST = run
