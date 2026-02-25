import { withV1Auth } from "@/lib/api/auth"
import { apiSuccess, ERRORS } from "@/lib/api/response"
import { hasRole } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()
  const { id } = await params

  const staff = await prisma.staff.findFirst({
    where: { id, primaryLocation: { businessId: ctx.businessId }, isActive: true },
    include: {
      user: true,
      staffSchedules: true,
      timeOff: { where: { startDate: { gte: new Date() } }, orderBy: { startDate: "asc" } },
      staffServices: { include: { service: { select: { id: true, name: true } } } },
    },
  })
  if (!staff) return ERRORS.NOT_FOUND("Staff member")
  return apiSuccess(staff)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()
  if (!hasRole(ctx.role, "admin")) return ERRORS.FORBIDDEN()
  const { id } = await params

  const staff = await prisma.staff.findFirst({
    where: { id, primaryLocation: { businessId: ctx.businessId } },
  })
  if (!staff) return ERRORS.NOT_FOUND("Staff member")

  await prisma.staff.update({ where: { id }, data: { isActive: false, deletedAt: new Date() } })
  return apiSuccess({ deleted: true })
}
