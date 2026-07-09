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
      // Never return the full user row (it carries passwordHash + auth columns).
      user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, avatarUrl: true, role: true } },
      staffSchedules: true,
      timeOff: { where: { startDate: { gte: new Date() } }, orderBy: { startDate: "asc" } },
      staffServices: { include: { service: { select: { id: true, name: true } } } },
    },
  })
  if (!staff) return ERRORS.NOT_FOUND("Staff member")

  // Pay fields AND contact PII (email/phone) are admin-only — mirrors getStaff's
  // data-layer model so the REST surface can't leak a colleague's pay or contact
  // info to a staff-role caller (L-046). Explicit public allowlist for user.
  if (!hasRole(ctx.role, "admin")) {
    const { commissionRate, hourlyRate, employmentType, employeeId, hireDate, user, ...rest } = staff
    void commissionRate; void hourlyRate; void employmentType; void employeeId; void hireDate
    return apiSuccess({
      ...rest,
      user: { id: user.id, firstName: user.firstName, lastName: user.lastName, avatarUrl: user.avatarUrl, role: user.role },
    })
  }
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
