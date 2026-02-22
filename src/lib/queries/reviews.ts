import { prisma } from "@/lib/prisma"

export async function getReviews(filter?: "all" | "needs-reply", businessId?: string) {
  const where: Record<string, unknown> = {}

  if (businessId) {
    where.businessId = businessId
  }

  if (filter === "needs-reply") {
    where.response = null
  }

  const reviews = await prisma.review.findMany({
    where,
    include: {
      client: true,
      staff: { include: { user: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return reviews.map((r) => ({
    id: r.id,
    clientId: r.clientId,
    clientName: `${r.client.firstName} ${r.client.lastName}`,
    clientAvatar: undefined as string | undefined,
    rating: r.overallRating,
    comment: r.comment || "",
    serviceId: "",
    serviceName: "",
    staffId: r.staffId || "",
    staffName: r.staff ? `${r.staff.user.firstName} ${r.staff.user.lastName}` : "",
    date: r.createdAt,
    response: r.response || undefined,
    responseDate: r.respondedAt || undefined,
    source: "Google" as const,
    isPublished: r.isPublic,
  }))
}

export async function getReviewStats(businessId?: string) {
  const businessFilter = businessId ? { businessId } : {}

  const reviews = await prisma.review.findMany({
    where: businessFilter,
    select: { overallRating: true, response: true },
  })

  const total = reviews.length
  if (total === 0) {
    return {
      averageRating: 0,
      totalReviews: 0,
      fiveStarCount: 0,
      fourStarCount: 0,
      threeStarCount: 0,
      twoStarCount: 0,
      oneStarCount: 0,
      responseRate: 0,
      ratingTrend: [],
    }
  }

  const avg = reviews.reduce((sum, r) => sum + r.overallRating, 0) / total
  const responded = reviews.filter((r) => r.response).length

  return {
    averageRating: Math.round(avg * 100) / 100,
    totalReviews: total,
    fiveStarCount: reviews.filter((r) => r.overallRating === 5).length,
    fourStarCount: reviews.filter((r) => r.overallRating === 4).length,
    threeStarCount: reviews.filter((r) => r.overallRating === 3).length,
    twoStarCount: reviews.filter((r) => r.overallRating === 2).length,
    oneStarCount: reviews.filter((r) => r.overallRating === 1).length,
    responseRate: Math.round((responded / total) * 100),
    ratingTrend: [],
  }
}
