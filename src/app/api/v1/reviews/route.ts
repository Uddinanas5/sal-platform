import { withV1Auth } from "@/lib/api/auth"
import { apiPaginated, ERRORS } from "@/lib/api/response"
import { hasRole } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"

const REVIEW_STATUSES = ["responded", "unresponded"] as const

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

  // The Review model has no `status`/`rating` columns — the old code wrote both
  // into the where clause where Prisma silently ignored them, so the filters did
  // nothing. Map them to real columns (overallRating, and response presence) and
  // reject invalid values instead of returning everything.
  if (rating !== null) {
    const r = parseInt(rating)
    if (Number.isNaN(r) || r < 1 || r > 5) {
      return ERRORS.BAD_REQUEST("rating must be an integer between 1 and 5")
    }
    where.overallRating = r
  }
  if (status !== null) {
    if (!REVIEW_STATUSES.includes(status as (typeof REVIEW_STATUSES)[number])) {
      return ERRORS.BAD_REQUEST(`status must be one of: ${REVIEW_STATUSES.join(", ")}`)
    }
    where.response = status === "responded" ? { not: null } : null
  }

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
