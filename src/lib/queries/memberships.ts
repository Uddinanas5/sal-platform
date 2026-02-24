import { prisma } from "@/lib/prisma"

export async function getGiftCards(businessId?: string) {
  const businessFilter = businessId ? { businessId } : {}

  const giftCards = await prisma.giftCard.findMany({
    where: businessFilter,
    select: {
      id: true,
      code: true,
      initialValue: true,
      currentBalance: true,
      recipientName: true,
      recipientEmail: true,
      expiresAt: true,
      isActive: true,
      createdAt: true,
      purchaser: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return giftCards.map((gc) => ({
    id: gc.id,
    code: gc.code,
    initialBalance: Number(gc.initialValue),
    currentBalance: Number(gc.currentBalance),
    purchasedBy: gc.purchaser ? `${gc.purchaser.firstName} ${gc.purchaser.lastName}` : "",
    recipientName: gc.recipientName || undefined,
    recipientEmail: gc.recipientEmail || undefined,
    purchaseDate: gc.createdAt,
    expiryDate: gc.expiresAt || new Date(),
    status: gc.isActive
      ? Number(gc.currentBalance) > 0 ? "active" as const : "redeemed" as const
      : gc.expiresAt && gc.expiresAt < new Date() ? "expired" as const : "redeemed" as const,
  }))
}

export async function getMembershipPlans(businessId?: string) {
  const businessFilter = businessId ? { businessId } : {}

  const plans = await prisma.membershipPlan.findMany({
    where: { ...businessFilter, isActive: true },
    select: {
      id: true,
      name: true,
      description: true,
      price: true,
      billingCycle: true,
      sessionsIncluded: true,
      discountPercent: true,
      serviceIds: true,
      benefits: true,
      isActive: true,
      _count: { select: { memberships: { where: { status: "active_membership" } } } },
    },
    orderBy: { sortOrder: "asc" },
  })

  return plans.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description || "",
    price: Number(p.price),
    billingCycle: p.billingCycle,
    sessionsIncluded: p.sessionsIncluded,
    discountPercent: p.discountPercent ? Number(p.discountPercent) : null,
    serviceIds: p.serviceIds,
    benefits: p.benefits,
    activeMembers: p._count.memberships,
    isActive: p.isActive,
  }))
}

export async function getMemberships(businessId?: string) {
  // Membership doesn't have businessId directly; filter through plan
  const planFilter = businessId
    ? { plan: { businessId } }
    : {}

  const memberships = await prisma.membership.findMany({
    where: planFilter,
    select: {
      id: true,
      clientId: true,
      planId: true,
      status: true,
      startDate: true,
      endDate: true,
      nextBillingDate: true,
      sessionsRemaining: true,
      totalPaid: true,
      createdAt: true,
      client: { select: { firstName: true, lastName: true, email: true } },
      plan: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return memberships.map((m) => ({
    id: m.id,
    clientId: m.clientId,
    clientName: `${m.client.firstName} ${m.client.lastName}`,
    clientEmail: m.client.email || "",
    planId: m.planId,
    planName: m.plan.name,
    status: m.status,
    startDate: m.startDate,
    endDate: m.endDate,
    nextBillingDate: m.nextBillingDate,
    sessionsRemaining: m.sessionsRemaining,
    totalPaid: Number(m.totalPaid),
    createdAt: m.createdAt,
  }))
}

export async function getMembershipStats(businessId?: string) {
  // Try to get real membership data first
  let totalMembers = 0
  let activeMembers = 0
  let mrr = 0
  let churnRate = 0

  // Membership doesn't have businessId directly; filter through plan
  const planFilter = businessId
    ? { plan: { businessId } }
    : {}

  try {
    const [total, active, cancelled] = await Promise.all([
      prisma.membership.count({ where: planFilter }),
      prisma.membership.count({ where: { ...planFilter, status: "active_membership" } }),
      prisma.membership.count({ where: { ...planFilter, status: "cancelled_membership" } }),
    ])

    totalMembers = total
    activeMembers = active

    const activeMemberships = await prisma.membership.findMany({
      where: { ...planFilter, status: "active_membership" },
      select: {
        plan: { select: { price: true, billingCycle: true } },
      },
    })

    mrr = activeMemberships.reduce((sum, m) => {
      const price = Number(m.plan.price)
      switch (m.plan.billingCycle) {
        case "monthly": return sum + price
        case "quarterly": return sum + price / 3
        case "yearly": return sum + price / 12
        default: return sum
      }
    }, 0)

    churnRate = total > 0 ? Math.round((cancelled / total) * 100 * 10) / 10 : 0
  } catch {
    // No membership table yet — return zeros
  }

  // Gift card stats (always available)
  const giftCardFilter = businessId ? { businessId } : {}
  const giftCards = await prisma.giftCard.findMany({
    where: giftCardFilter,
    select: { isActive: true, currentBalance: true },
  })
  const activeGiftCards = giftCards.filter((gc) => gc.isActive)
  const outstandingBalance = activeGiftCards.reduce(
    (sum, gc) => sum + Number(gc.currentBalance),
    0
  )

  return {
    totalMembers,
    activeMembers,
    mrr: Math.round(mrr * 100) / 100,
    churnRate,
    totalGiftCardsSold: giftCards.length,
    outstandingGiftCardBalance: Math.round(outstandingBalance * 100) / 100,
  }
}
