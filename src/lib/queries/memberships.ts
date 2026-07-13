import { prisma } from "@/lib/prisma"

export async function getGiftCards(businessId?: string) {
  if (!businessId) throw new Error("businessId is required — refusing to query across all tenants")
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

  const now = new Date()
  return giftCards.map((gc) => {
    const balance = Number(gc.currentBalance)
    const isExpired = gc.expiresAt != null && gc.expiresAt < now
    // Expiry wins over balance; a fully-drawn-down card is "redeemed";
    // anything else with a balance left is "active".
    const status: "active" | "redeemed" | "expired" = isExpired
      ? "expired"
      : balance <= 0 || !gc.isActive
        ? "redeemed"
        : "active"
    return {
      id: gc.id,
      code: gc.code,
      initialBalance: Number(gc.initialValue),
      currentBalance: balance,
      purchasedBy: gc.purchaser ? `${gc.purchaser.firstName} ${gc.purchaser.lastName}` : "",
      recipientName: gc.recipientName || undefined,
      recipientEmail: gc.recipientEmail || undefined,
      purchaseDate: gc.createdAt,
      expiryDate: gc.expiresAt || new Date(),
      status,
    }
  })
}

// Management view: returns ALL plans (active + inactive) so admins can
// reactivate deactivated ones. `activeMembers` is the count of active
// Membership rows on each plan. (The public booking/v1 layer filters to
// isActive itself, so widening here is safe — only this page consumes it.)
export async function getMembershipStats(businessId?: string) {
  if (!businessId) throw new Error("businessId is required — refusing to query across all tenants")
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

