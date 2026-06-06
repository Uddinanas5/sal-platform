import type { z } from "zod"
import { withV1Auth, type ApiContext } from "@/lib/api/auth"
import { ERRORS } from "@/lib/api/response"
import { hasRole, type AppRole } from "@/lib/permissions"

export async function requireV1Context(
  req: Request,
  minimumRole?: AppRole
): Promise<{ ok: true; ctx: ApiContext } | { ok: false; response: Response }> {
  const ctx = await withV1Auth(req)
  if (!ctx) return { ok: false, response: ERRORS.UNAUTHORIZED() }
  if (minimumRole && !hasRole(ctx.role, minimumRole)) {
    return { ok: false, response: ERRORS.FORBIDDEN() }
  }
  return { ok: true, ctx }
}

export async function parseJsonBody<TSchema extends z.ZodType>(
  req: Request,
  schema: TSchema
): Promise<{ ok: true; data: z.infer<TSchema> } | { ok: false; response: Response }> {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return { ok: false, response: ERRORS.BAD_REQUEST("Invalid JSON") }
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return {
      ok: false,
      response: ERRORS.BAD_REQUEST(parsed.error.issues[0]?.message ?? "Invalid input"),
    }
  }

  return { ok: true, data: parsed.data }
}
