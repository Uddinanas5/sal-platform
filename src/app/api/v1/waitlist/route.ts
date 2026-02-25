import { withV1Auth } from "@/lib/api/auth"
import { apiSuccess, ERRORS } from "@/lib/api/response"
import { hasRole } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const addToWaitlistSchema = z.object({
  clientId: z.string().uuid(),
  serviceId: z.string().uuid().optional(),
  staffId: z.string().uuid().optional(),
  preferredDate: z.coerce.date().optional(),
  preferredTimeStart: z.string().optional(),
  preferredTimeEnd: z.string().optional(),
  notes: z.string().optional(),
})

export async function GET(req: Request) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()
  if (!hasRole(ctx.role, "admin")) return ERRORS.FORBIDDEN()

  const entries = await prisma.waitlistEntry.findMany({
    where: { businessId: ctx.businessId, status: "waiting" },
    orderBy: { createdAt: "asc" },
  })
  return apiSuccess(entries)
}

export async function POST(req: Request) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()

  let body: unknown
  try { body = await req.json() } catch { return ERRORS.BAD_REQUEST("Invalid JSON") }

  const parsed = addToWaitlistSchema.safeParse(body)
  if (!parsed.success) return ERRORS.BAD_REQUEST(parsed.error.issues[0]?.message ?? "Invalid input")

  const entry = await prisma.waitlistEntry.create({
    data: {
      businessId: ctx.businessId,
      clientId: parsed.data.clientId,
      serviceId: parsed.data.serviceId,
      staffId: parsed.data.staffId,
      preferredDate: parsed.data.preferredDate,
      preferredTimeStart: parsed.data.preferredTimeStart
        ? new Date(`1970-01-01T${parsed.data.preferredTimeStart}`)
        : undefined,
      preferredTimeEnd: parsed.data.preferredTimeEnd
        ? new Date(`1970-01-01T${parsed.data.preferredTimeEnd}`)
        : undefined,
      notes: parsed.data.notes,
    },
  })
  return apiSuccess(entry, 201)
}
