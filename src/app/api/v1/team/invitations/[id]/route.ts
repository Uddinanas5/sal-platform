import { withV1Auth } from "@/lib/api/auth"
import { apiSuccess, ERRORS } from "@/lib/api/response"
import { hasRole } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()
  if (!hasRole(ctx.role, "admin")) return ERRORS.FORBIDDEN()
  const { id } = await params

  const invitation = await prisma.staffInvitation.findUnique({ where: { id } })
  if (!invitation || invitation.businessId !== ctx.businessId) return ERRORS.NOT_FOUND("Invitation")
  if (invitation.acceptedAt) return ERRORS.BAD_REQUEST("Invitation already accepted")
  if (invitation.revokedAt) return ERRORS.BAD_REQUEST("Invitation already revoked")

  await prisma.staffInvitation.update({ where: { id }, data: { revokedAt: new Date() } })
  return apiSuccess({ revoked: true })
}
