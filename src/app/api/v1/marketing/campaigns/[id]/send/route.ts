import { withV1Auth } from "@/lib/api/auth"
import { apiSuccess, ERRORS } from "@/lib/api/response"
import { hasRole } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()
  if (!hasRole(ctx.role, "admin")) return ERRORS.FORBIDDEN()
  const { id } = await params

  try {
    const campaign = await prisma.campaign.update({
      where: { id, businessId: ctx.businessId },
      data: { status: "sent", sentAt: new Date() },
    })
    return apiSuccess(campaign)
  } catch {
    return ERRORS.NOT_FOUND("Campaign")
  }
}
