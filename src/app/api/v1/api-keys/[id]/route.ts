import { withV1Auth } from "@/lib/api/auth"
import { apiSuccess, ERRORS } from "@/lib/api/response"
import { hasRole } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()
  if (!hasRole(ctx.role, "owner")) return ERRORS.FORBIDDEN()
  const { id } = await params

  const apiKey = await prisma.apiKey.findUnique({ where: { id } })
  if (!apiKey || apiKey.businessId !== ctx.businessId) return ERRORS.NOT_FOUND("API key")
  if (apiKey.revokedAt) return ERRORS.BAD_REQUEST("API key already revoked")

  await prisma.apiKey.update({ where: { id }, data: { revokedAt: new Date() } })
  return apiSuccess({ revoked: true })
}
