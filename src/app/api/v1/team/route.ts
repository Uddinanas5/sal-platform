import { withV1Auth } from "@/lib/api/auth"
import { apiSuccess, ERRORS } from "@/lib/api/response"
import { hasRole } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"

export async function GET(req: Request) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()
  if (!hasRole(ctx.role, "admin")) return ERRORS.FORBIDDEN()

  const staff = await prisma.staff.findMany({
    where: { primaryLocation: { businessId: ctx.businessId }, isActive: true, deletedAt: null },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, role: true, createdAt: true } },
    },
    orderBy: { user: { firstName: "asc" } },
  })

  return apiSuccess(staff.map((s) => ({
    staffId: s.id,
    userId: s.user.id,
    firstName: s.user.firstName,
    lastName: s.user.lastName,
    email: s.user.email,
    role: s.user.role,
    title: s.title,
    joinedAt: s.user.createdAt,
  })))
}
