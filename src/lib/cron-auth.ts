import { NextRequest } from "next/server"
import { timingSafeEqual } from "crypto"

// Shared FAIL-CLOSED auth for Vercel Cron routes (/api/cron/dispatch,
// /api/cron/reconcile). Extracted from cron/dispatch so every cron clones the
// exact same security model instead of re-implementing it:
//
//   - Access requires the CRON_SECRET. We compare in constant time.
//   - If CRON_SECRET is UNSET, or the incoming credential does not match,
//     authorizeCron returns false and the route must return 401 and do
//     NOTHING. There is no "open by default" path: a misconfigured deploy is
//     safe (no work runs, nothing leaks), never wide open.
//   - Vercel Cron sends the secret as `Authorization: Bearer <CRON_SECRET>`.
//     An `x-cron-secret` header is also accepted for manual/portable runs.

export function constantTimeMatch(provided: string, expected: string): boolean {
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

export function extractCronSecret(req: NextRequest): string | null {
  const auth = req.headers.get("authorization")
  if (auth?.startsWith("Bearer ")) return auth.slice("Bearer ".length)
  const x = req.headers.get("x-cron-secret")
  if (x) return x
  return null
}

export function authorizeCron(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET
  // Fail closed: no configured secret means no one is authorized.
  if (!expected) return false
  const provided = extractCronSecret(req)
  if (!provided) return false
  return constantTimeMatch(provided, expected)
}
