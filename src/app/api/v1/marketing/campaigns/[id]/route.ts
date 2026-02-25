import { withV1Auth } from "@/lib/api/auth"
import { apiSuccess, ERRORS } from "@/lib/api/response"
import { hasRole } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const updateCampaignSchema = z.object({
  name: z.string().min(1).optional(),
  subject: z.string().optional(),
  body: z.string().min(1).optional(),
  channel: z.enum(["email", "sms", "both"]).optional(),
  audienceType: z.string().optional(),
  scheduledAt: z.coerce.date().nullable().optional(),
})

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()
  if (!hasRole(ctx.role, "admin")) return ERRORS.FORBIDDEN()
  const { id } = await params

  let body: unknown
  try { body = await req.json() } catch { return ERRORS.BAD_REQUEST("Invalid JSON") }

  const parsed = updateCampaignSchema.safeParse(body)
  if (!parsed.success) return ERRORS.BAD_REQUEST(parsed.error.issues[0]?.message ?? "Invalid input")

  try {
    const campaign = await prisma.campaign.update({
      where: { id, businessId: ctx.businessId },
      data: parsed.data,
    })
    return apiSuccess(campaign)
  } catch {
    return ERRORS.NOT_FOUND("Campaign")
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()
  if (!hasRole(ctx.role, "admin")) return ERRORS.FORBIDDEN()
  const { id } = await params

  try {
    await prisma.campaign.delete({ where: { id, businessId: ctx.businessId } })
    return apiSuccess({ deleted: true })
  } catch {
    return ERRORS.NOT_FOUND("Campaign")
  }
}
