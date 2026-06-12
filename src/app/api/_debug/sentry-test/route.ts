import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"

export const dynamic = "force-dynamic"

// Gated verification endpoint: throws on purpose so you can confirm Sentry is
// actually receiving errors after a deploy. SAFE in production because it only
// throws when ?token=<CRON_SECRET> matches (constant-time) — otherwise 404, so a
// random visitor can't trigger noise. Usage: GET /api/_debug/sentry-test?token=<CRON_SECRET>
// then check the Sentry Issues feed.
export function GET(req: NextRequest) {
  const provided = req.nextUrl.searchParams.get("token") || ""
  const secret = process.env.CRON_SECRET || ""
  const ok =
    secret.length > 0 &&
    provided.length === secret.length &&
    crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(secret))
  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  throw new Error("Sentry verification error — if you can see this in Sentry, reporting works.")
}
