import { withV1Auth } from "@/lib/api/auth"
import { apiPaginated, ERRORS } from "@/lib/api/response"
import { hasRole } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"

export async function GET(req: Request) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()
  if (!hasRole(ctx.role, "admin")) return ERRORS.FORBIDDEN()

  const url = new URL(req.url)
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"))
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20")))
  const status = url.searchParams.get("status")
  const rating = url.searchParams.get("rating")

  const where: Record<string, unknown> = { businessId: ctx.businessId }
  if (status) where.status = status
  if (rating) where.rating = parseInt(rating)

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where: where as never,
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        appointment: { select: { id: true, bookingReference: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.review.count({ where: where as never }),
  ])

  return apiPaginated(reviews, { page, limit, total })
}
