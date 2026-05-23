import { NextRequest, NextResponse } from "next/server"

type RouteHandler<C> = (
  req: NextRequest,
  ctx: C,
) => Promise<Response> | Response

/**
 * Wraps a public unauth route handler with a catch-all that logs the raw
 * error server-side and returns a generic 500. Always returns the fixed
 * "Internal server error" string regardless of NODE_ENV — public endpoints
 * are reachable from the internet even in dev/preview, so leaking Prisma
 * bundles or stack traces to anonymous callers is never acceptable.
 * Handlers can still return their own non-500 responses (400 validation,
 * 404 not found) by returning normally — only thrown errors are caught.
 */
export function withSafeErrors<C = unknown>(
  name: string,
  handler: RouteHandler<C>,
): RouteHandler<C> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx)
    } catch (error) {
      console.error(`[${name}]`, error)
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      )
    }
  }
}
