import { ERRORS } from "@/lib/api/response"
import { mapPrismaErrorToV1 } from "@/lib/api/prisma-errors"

type V1Handler<C> = (req: Request, ctx: C) => Promise<Response> | Response

/**
 * Wraps a v1 route handler with a Prisma-aware catch-all. Known Prisma errors
 * (P2002, P2003, P2025) are mapped to clean 409/422/404 responses; anything
 * else logs server-side and returns the generic 500 envelope.
 *
 * The handler can still return its own non-throw responses (validation,
 * auth, custom 404s) — only thrown errors hit this catch. See
 * execution/bugs/API-PRISMA-ERROR-MAP.md for the contract.
 */
export function withV1Errors<C = unknown>(
  name: string,
  handler: V1Handler<C>,
): V1Handler<C> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx)
    } catch (error) {
      const mapped = mapPrismaErrorToV1(error)
      if (mapped) return mapped
      console.error(`[${name}]`, error)
      return ERRORS.SERVER_ERROR()
    }
  }
}
