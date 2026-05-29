import { NextRequest } from "next/server"
import { publicError } from "@/lib/api/public-errors"

type RouteHandler<C> = (
  req: NextRequest,
  ctx: C,
) => Promise<Response> | Response

/**
 * Wraps a public unauth route handler with a catch-all that logs the raw
 * error server-side and returns the public-contract TEMPORARY_UNAVAILABLE
 * envelope (503). Public endpoints are reachable from the internet even in
 * dev/preview, so leaking Prisma bundles or stack traces to anonymous
 * callers is never acceptable — keep the message generic regardless of env.
 * Handlers can still return their own non-throw responses (validation,
 * not-found) by returning normally — only thrown errors are caught here.
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
      return publicError("TEMPORARY_UNAVAILABLE")
    }
  }
}
