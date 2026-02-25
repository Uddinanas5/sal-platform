import { withV1Auth } from "@/lib/api/auth"
import { apiSuccess, ERRORS } from "@/lib/api/response"
import { hasRole } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import crypto from "crypto"
import { z } from "zod"

const createKeySchema = z.object({
  name: z.string().min(1).max(100),
  role: z.enum(["admin", "owner"]).optional().default("admin"),
  expiresAt: z.coerce.date().optional(),
})

export async function GET(req: Request) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()
  if (!hasRole(ctx.role, "owner")) return ERRORS.FORBIDDEN()

  const keys = await prisma.apiKey.findMany({
    where: { businessId: ctx.businessId, revokedAt: null },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      role: true,
      lastUsedAt: true,
      expiresAt: true,
      createdAt: true,
      createdBy: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return apiSuccess(keys)
}

export async function POST(req: Request) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()
  if (!hasRole(ctx.role, "owner")) return ERRORS.FORBIDDEN()

  let body: unknown
  try { body = await req.json() } catch { return ERRORS.BAD_REQUEST("Invalid JSON") }

  const parsed = createKeySchema.safeParse(body)
  if (!parsed.success) return ERRORS.BAD_REQUEST(parsed.error.issues[0]?.message ?? "Invalid input")

  const rawKey = crypto.randomBytes(32).toString("hex")
  const keyPrefix = rawKey.substring(0, 12)
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex")

  const apiKey = await prisma.apiKey.create({
    data: {
      businessId: ctx.businessId,
      name: parsed.data.name,
      keyHash,
      keyPrefix,
      role: parsed.data.role as never,
      expiresAt: parsed.data.expiresAt,
      createdById: ctx.userId,
    },
  })

  // Return raw key ONCE — not stored, only the hash is persisted
  return apiSuccess({
    id: apiKey.id,
    name: apiKey.name,
    keyPrefix,
    key: `sal_${rawKey}`,
    role: apiKey.role,
    expiresAt: apiKey.expiresAt,
    createdAt: apiKey.createdAt,
  }, 201)
}
