import { NextRequest, NextResponse } from "next/server"
import { timingSafeEqual } from "crypto"
import { runDueReminders } from "@/lib/automation/reminders"

// This route is invoked by Vercel Cron (see vercel.json "crons") on a ~15-minute
// cadence. It is the runtime backbone for SAL's "Never Miss Again" reminders.
//
// SECURITY MODEL — FAIL CLOSED:
//   - Access requires the CRON_SECRET. We compare in constant time.
//   - If CRON_SECRET is UNSET, or the incoming credential does not match, we
//     return 401 and do NOTHING. There is no "open by default" path: a
//     misconfigured deploy is safe (no reminders, no leak), never wide open.
//   - Vercel Cron sends the secret as `Authorization: Bearer <CRON_SECRET>`.
//     We also accept an `x-cron-secret` header for manual/portable invocation.
export const dynamic = "force-dynamic"
// Reminders are pure server work; never cache, never prerender.
export const revalidate = 0

function constantTimeMatch(provided: string, expected: string): boolean {
  // timingSafeEqual throws if buffers differ in length, so guard first. We
  // still hash-compare to keep the comparison constant-time for equal lengths.
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

function extractSecret(req: NextRequest): string | null {
  const auth = req.headers.get("authorization")
  if (auth?.startsWith("Bearer ")) return auth.slice("Bearer ".length)
  const x = req.headers.get("x-cron-secret")
  if (x) return x
  return null
}

function authorize(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET
  // Fail closed: no configured secret means no one is authorized.
  if (!expected) return false
  const provided = extractSecret(req)
  if (!provided) return false
  return constantTimeMatch(provided, expected)
}

async function handle(req: NextRequest) {
  if (!authorize(req)) {
    // Opaque 401 — do not reveal whether the secret was unset vs. mismatched.
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const startedAt = new Date()
  try {
    const result = await runDueReminders(startedAt)
    console.log("[cron/dispatch] reminders run", {
      at: startedAt.toISOString(),
      ...result,
    })
    return NextResponse.json({
      ok: true,
      at: startedAt.toISOString(),
      ...result,
    })
  } catch (e) {
    console.error("[cron/dispatch] reminders run failed", e)
    return NextResponse.json(
      { ok: false, error: "dispatch_failed" },
      { status: 500 }
    )
  }
}

// Vercel Cron issues GET requests. POST is accepted too for manual/portable
// triggering with the same auth gate.
export async function GET(req: NextRequest) {
  return handle(req)
}

export async function POST(req: NextRequest) {
  return handle(req)
}
