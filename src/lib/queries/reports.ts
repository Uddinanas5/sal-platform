import { prisma } from "@/lib/prisma"
import { subDays, subMonths, startOfDay, startOfMonth, format } from "date-fns"

// ============================================================================
// EXISTING QUERIES
// ============================================================================

export async function getRevenueByDay(days: number, businessId?: string) {
  const since = startOfDay(subDays(new Date(), days - 1))
  const businessFilter = businessId ? { businessId } : {}

  const payments = await prisma.payment.findMany({
    where: {
      ...businessFilter,
      status: "completed",
      createdAt: { gte: since },
    },
    select: { totalAmount: true, createdAt: true },
  })

  const byDay: Record<string, number> = {}
  for (let i = 0; i < days; i++) {
    const d = subDays(new Date(), days - 1 - i)
    byDay[format(d, "EEE")] = 0
  }

  for (const p of payments) {
    const key = format(p.createdAt, "EEE")
    byDay[key] = (byDay[key] || 0) + Number(p.totalAmount)
  }

  return Object.entries(byDay).map(([day, revenue]) => ({
    day,
    revenue: Math.round(revenue * 100) / 100,
    appointments: 0,
  }))
}

export async function getStaffPerformance(businessId?: string) {
  // Staff links to business through location
  const locationFilter = businessId
    ? { primaryLocation: { businessId } }
    : {}

  // 1. Fetch staff with minimal data (no nested relations)
  const staff = await prisma.staff.findMany({
    where: { isActive: true, ...locationFilter },
    select: {
      id: true,
      commissionRate: true,
      user: { select: { firstName: true, lastName: true } },
    },
  })

  const staffIds = staff.map((s) => s.id)
  if (staffIds.length === 0) return []

  // 2. Aggregate revenue and appointment counts per staff (DB-level filtering for completed)
  const revenueByStaff = await prisma.appointmentService.groupBy({
    by: ["staffId"],
    where: {
      staffId: { in: staffIds },
      appointment: { status: "completed" },
    },
    _sum: { finalPrice: true },
    _count: true,
  })

  // 3. Aggregate average ratings per staff
  const ratingsByStaff = await prisma.review.groupBy({
    by: ["staffId"],
    where: {
      staffId: { in: staffIds },
    },
    _avg: { overallRating: true },
  })

  // 4. Build lookup maps for O(1) access
  const revenueMap = new Map(
    revenueByStaff.map((r) => [
      r.staffId,
      { revenue: Number(r._sum.finalPrice ?? 0), count: r._count },
    ])
  )
  const ratingMap = new Map(
    ratingsByStaff
      .filter((r): r is typeof r & { staffId: string } => r.staffId !== null)
      .map((r) => [r.staffId, Number(r._avg.overallRating ?? 0)])
  )

  // 5. Combine results
  return staff.map((s) => {
    const stats = revenueMap.get(s.id) ?? { revenue: 0, count: 0 }
    const avgRating = ratingMap.get(s.id) ?? 0

    return {
      name: `${s.user.firstName} ${s.user.lastName}`,
      appointments: stats.count,
      revenue: Math.round(stats.revenue * 100) / 100,
      rating: Math.round(avgRating * 10) / 10,
      commission: Math.round(stats.revenue * Number(s.commissionRate) / 100),
    }
  })
}

export async function getChannelBreakdown(businessId?: string) {
  const businessFilter = businessId ? { businessId } : {}

  const appointments = await prisma.appointment.groupBy({
    by: ["source"],
    where: businessFilter,
    _count: true,
  })

  const total = appointments.reduce((sum, a) => sum + a._count, 0)
  const sourceNames: Record<string, string> = {
    online: "Online",
    phone: "Phone",
    walk_in: "Walk-in",
    app: "App",
    pos: "POS",
  }

  return appointments.map((a) => ({
    name: sourceNames[a.source] || a.source,
    value: total > 0 ? Math.round((a._count / total) * 100) : 0,
    color: getSourceColor(a.source),
  }))
}

function getSourceColor(source: string): string {
  const colors: Record<string, string> = {
    online: "#059669",
    phone: "#34d399",
    walk_in: "#6ee7b7",
    app: "#a7f3d0",
    pos: "#d1fae5",
  }
  return colors[source] || "#059669"
}

// ============================================================================
// REPORT SUMMARY
// ============================================================================

export async function getReportSummary(businessId?: string) {
  const now = new Date()
  const thisMonthStart = startOfMonth(now)
  const lastMonthStart = startOfMonth(subMonths(now, 1))
  const lastMonthEnd = startOfMonth(now)
  const businessFilter = businessId ? { businessId } : {}

  // Current month payments
  const currentPayments = await prisma.payment.findMany({
    where: {
      ...businessFilter,
      status: "completed",
      createdAt: { gte: thisMonthStart },
    },
    select: { totalAmount: true },
  })

  // Last month payments
  const lastPayments = await prisma.payment.findMany({
    where: {
      ...businessFilter,
      status: "completed",
      createdAt: { gte: lastMonthStart, lt: lastMonthEnd },
    },
    select: { totalAmount: true },
  })

  const totalRevenue = currentPayments.reduce((sum, p) => sum + Number(p.totalAmount), 0)
  const lastRevenue = lastPayments.reduce((sum, p) => sum + Number(p.totalAmount), 0)

  // Current month appointments
  const currentAppointments = await prisma.appointment.count({
    where: { ...businessFilter, startTime: { gte: thisMonthStart } },
  })
  const lastAppointments = await prisma.appointment.count({
    where: { ...businessFilter, startTime: { gte: lastMonthStart, lt: lastMonthEnd } },
  })

  // New clients this month
  const newClients = await prisma.client.count({
    where: { ...businessFilter, createdAt: { gte: thisMonthStart } },
  })
  const lastNewClients = await prisma.client.count({
    where: { ...businessFilter, createdAt: { gte: lastMonthStart, lt: lastMonthEnd } },
  })

  const averageTicket = currentAppointments > 0 ? totalRevenue / currentAppointments : 0
  const lastAvgTicket = lastAppointments > 0 ? lastRevenue / lastAppointments : 0

  // Retention rate: returning clients / total clients with visits this month
  const totalClientsThisMonth = await prisma.client.count({
    where: {
      ...businessFilter,
      appointments: { some: { startTime: { gte: thisMonthStart } } },
    },
  })
  const returningClientsThisMonth = await prisma.client.count({
    where: {
      ...businessFilter,
      totalVisits: { gt: 1 },
      appointments: { some: { startTime: { gte: thisMonthStart } } },
    },
  })
  const retentionRate = totalClientsThisMonth > 0
    ? Math.round((returningClientsThisMonth / totalClientsThisMonth) * 1000) / 10
    : 0

  // Product vs service revenue
  const productPayments = await prisma.appointmentProduct.aggregate({
    where: {
      appointment: {
        ...businessFilter,
        status: "completed",
        startTime: { gte: thisMonthStart },
      },
    },
    _sum: { totalPrice: true },
  })
  const productRevenue = Number(productPayments._sum.totalPrice ?? 0)
  const serviceRevenue = totalRevenue - productRevenue

  return {
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    revenueGrowth: lastRevenue > 0
      ? Math.round(((totalRevenue - lastRevenue) / lastRevenue) * 1000) / 10
      : 0,
    totalAppointments: currentAppointments,
    appointmentGrowth: lastAppointments > 0
      ? Math.round(((currentAppointments - lastAppointments) / lastAppointments) * 1000) / 10
      : 0,
    averageTicket: Math.round(averageTicket * 100) / 100,
    ticketGrowth: lastAvgTicket > 0
      ? Math.round(((averageTicket - lastAvgTicket) / lastAvgTicket) * 1000) / 10
      : 0,
    newClients,
    clientGrowth: lastNewClients > 0
      ? Math.round(((newClients - lastNewClients) / lastNewClients) * 1000) / 10
      : 0,
    retentionRate,
    productRevenue: Math.round(productRevenue * 100) / 100,
    serviceRevenue: Math.round(serviceRevenue * 100) / 100,
  }
}

// ============================================================================
// REVENUE TAB QUERIES
// ============================================================================

export async function getRevenueByMonth(months: number = 6, businessId?: string) {
  const results: { month: string; revenue: number }[] = []
  const businessFilter = businessId ? { businessId } : {}

  for (let i = months - 1; i >= 0; i--) {
    const monthStart = startOfMonth(subMonths(new Date(), i))
    const monthEnd = i > 0 ? startOfMonth(subMonths(new Date(), i - 1)) : new Date()

    const payments = await prisma.payment.findMany({
      where: {
        ...businessFilter,
        status: "completed",
        createdAt: { gte: monthStart, lt: monthEnd },
      },
      select: { totalAmount: true },
    })

    const revenue = payments.reduce((sum, p) => sum + Number(p.totalAmount), 0)
    results.push({
      month: format(monthStart, "MMM"),
      revenue: Math.round(revenue * 100) / 100,
    })
  }

  return results
}

export async function getRevenueByCategory(businessId?: string) {
  const categoryColors: Record<string, string> = {
    Hair: "#f97316",
    Wellness: "#10b981",
    Nails: "#ec4899",
    Skincare: "#06b6d4",
    Products: "#8b5cf6",
  }
  const defaultColors = ["#f97316", "#10b981", "#ec4899", "#06b6d4", "#8b5cf6", "#6366f1", "#14b8a6"]
  const businessFilter = businessId ? { businessId } : {}

  const services = await prisma.appointmentService.findMany({
    where: {
      appointment: { ...businessFilter, status: "completed" },
    },
    include: {
      service: {
        include: { category: true },
      },
    },
  })

  const byCategory: Record<string, number> = {}
  for (const s of services) {
    const catName = s.service.category?.name ?? "Other"
    byCategory[catName] = (byCategory[catName] ?? 0) + Number(s.finalPrice)
  }

  // Add product revenue
  const productRevenue = await prisma.appointmentProduct.aggregate({
    where: {
      appointment: { ...businessFilter, status: "completed" },
    },
    _sum: { totalPrice: true },
  })
  const prodTotal = Number(productRevenue._sum.totalPrice ?? 0)
  if (prodTotal > 0) {
    byCategory["Products"] = (byCategory["Products"] ?? 0) + prodTotal
  }

  let colorIndex = 0
  return Object.entries(byCategory)
    .map(([name, value]) => ({
      name,
      value: Math.round(value * 100) / 100,
      color: categoryColors[name] ?? defaultColors[colorIndex++ % defaultColors.length],
    }))
    .sort((a, b) => b.value - a.value)
}

export async function getRevenueByPaymentMethod(businessId?: string) {
  const methodColors: Record<string, string> = {
    card: "#059669",
    cash: "#34d399",
    gift_card: "#6ee7b7",
    online: "#a7f3d0",
    other: "#d1fae5",
  }

  const methodNames: Record<string, string> = {
    card: "Card",
    cash: "Cash",
    gift_card: "Gift Card",
    online: "Online",
    other: "Other",
  }

  const businessFilter = businessId ? { businessId } : {}

  const payments = await prisma.payment.groupBy({
    by: ["method"],
    where: { ...businessFilter, status: "completed" },
    _sum: { totalAmount: true },
  })

  return payments.map((p) => ({
    name: methodNames[p.method] ?? p.method,
    value: Math.round(Number(p._sum.totalAmount ?? 0) * 100) / 100,
    color: methodColors[p.method] ?? "#059669",
  }))
}

// ============================================================================
// APPOINTMENTS TAB QUERIES
// ============================================================================

export async function getAppointmentsByHour(businessId?: string) {
  const hourLabels = [
    "8AM", "9AM", "10AM", "11AM", "12PM", "1PM",
    "2PM", "3PM", "4PM", "5PM", "6PM", "7PM",
  ]

  const thisMonthStart = startOfMonth(new Date())
  const businessFilter = businessId ? { businessId } : {}

  const appointments = await prisma.appointment.findMany({
    where: { ...businessFilter, startTime: { gte: thisMonthStart } },
    select: { startTime: true },
  })

  const hourCounts: Record<number, number> = {}
  for (let h = 8; h <= 19; h++) {
    hourCounts[h] = 0
  }

  for (const a of appointments) {
    const hour = a.startTime.getHours()
    if (hour >= 8 && hour <= 19) {
      hourCounts[hour] = (hourCounts[hour] ?? 0) + 1
    }
  }

  return hourLabels.map((label, idx) => ({
    hour: label,
    count: hourCounts[idx + 8] ?? 0,
  }))
}

export async function getAppointmentCompletionRate(businessId?: string) {
  const thisMonthStart = startOfMonth(new Date())
  const businessFilter = businessId ? { businessId } : {}

  const total = await prisma.appointment.count({
    where: { ...businessFilter, startTime: { gte: thisMonthStart } },
  })

  if (total === 0) {
    return { completed: 0, cancelled: 0, noShow: 0, rescheduled: 0 }
  }

  const completed = await prisma.appointment.count({
    where: { ...businessFilter, startTime: { gte: thisMonthStart }, status: "completed" },
  })

  const cancelled = await prisma.appointment.count({
    where: { ...businessFilter, startTime: { gte: thisMonthStart }, status: "cancelled" },
  })

  const noShow = await prisma.appointment.count({
    where: { ...businessFilter, startTime: { gte: thisMonthStart }, status: "no_show" },
  })

  const rescheduled = await prisma.appointment.count({
    where: {
      ...businessFilter,
      startTime: { gte: thisMonthStart },
      rescheduledTo: { not: null },
    },
  })

  return {
    completed: Math.round((completed / total) * 100),
    cancelled: Math.round((cancelled / total) * 100),
    noShow: Math.round((noShow / total) * 100),
    rescheduled: Math.round((rescheduled / total) * 100),
  }
}

export async function getBusiestTimesHeatmap(businessId?: string) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const dayMap: Record<number, number> = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5 }
  const businessFilter = businessId ? { businessId } : {}

  // Look at the last 30 days of appointments
  const since = subDays(new Date(), 30)

  const appointments = await prisma.appointment.findMany({
    where: { ...businessFilter, startTime: { gte: since } },
    select: { startTime: true },
  })

  // Initialize grid: 6 days x 12 hours (8AM-7PM)
  const grid: number[][] = days.map(() => Array(12).fill(0))

  for (const a of appointments) {
    const dayOfWeek = a.startTime.getDay() // 0=Sun, 1=Mon, ...
    const hour = a.startTime.getHours()
    const dayIdx = dayMap[dayOfWeek]
    if (dayIdx !== undefined && hour >= 8 && hour <= 19) {
      grid[dayIdx][hour - 8]++
    }
  }

  return days.map((day, idx) => ({
    day,
    hours: grid[idx],
  }))
}

// ============================================================================
// CLIENTS TAB QUERIES
// ============================================================================

export async function getClientRetention(months: number = 6, businessId?: string) {
  const businessFilter = businessId ? { businessId } : {}
  const now = new Date()
  const rangeStart = startOfMonth(subMonths(now, months - 1))

  // Build month boundaries once for grouping
  const monthBoundaries: { start: Date; end: Date; label: string }[] = []
  for (let i = months - 1; i >= 0; i--) {
    const start = startOfMonth(subMonths(now, i))
    const end = i > 0 ? startOfMonth(subMonths(now, i - 1)) : now
    monthBoundaries.push({ start, end, label: format(start, "MMM") })
  }

  // 1. Single query: fetch all new clients in the full date range with their createdAt
  const newClients = await prisma.client.findMany({
    where: { ...businessFilter, createdAt: { gte: rangeStart } },
    select: { createdAt: true },
  })

  // 2. Single query: fetch returning clients with their appointment times in range
  const returningWithAppointments = await prisma.client.findMany({
    where: {
      ...businessFilter,
      totalVisits: { gt: 1 },
      appointments: {
        some: { startTime: { gte: rangeStart } },
      },
    },
    select: {
      appointments: {
        where: { startTime: { gte: rangeStart } },
        select: { startTime: true },
      },
    },
  })

  // 3. Group new clients by month in JS
  const newByMonth = new Map<string, number>()
  for (const { start, end, label } of monthBoundaries) {
    const count = newClients.filter(
      (c) => c.createdAt >= start && c.createdAt < end
    ).length
    newByMonth.set(label, count)
  }

  const returningByMonth = new Map<string, number>()
  for (const { label } of monthBoundaries) {
    returningByMonth.set(label, 0)
  }
  for (const client of returningWithAppointments) {
    // Track which months this client had appointments in to count them once per month
    const clientMonths = new Set<string>()
    for (const appt of client.appointments) {
      for (const { start, end, label } of monthBoundaries) {
        if (appt.startTime >= start && appt.startTime < end) {
          clientMonths.add(label)
        }
      }
    }
    Array.from(clientMonths).forEach((label) => {
      returningByMonth.set(label, (returningByMonth.get(label) ?? 0) + 1)
    })
  }

  // 5. Assemble results in order
  return monthBoundaries.map(({ label }) => ({
    month: label,
    newClients: newByMonth.get(label) ?? 0,
    returning: returningByMonth.get(label) ?? 0,
  }))
}

export async function getTopClients(limit: number = 5, businessId?: string) {
  const businessFilter = businessId ? { businessId } : {}

  const clients = await prisma.client.findMany({
    where: businessFilter,
    orderBy: { totalSpent: "desc" },
    take: limit,
    select: {
      firstName: true,
      lastName: true,
      totalVisits: true,
      totalSpent: true,
      lastVisitAt: true,
    },
  })

  return clients.map((c) => ({
    name: `${c.firstName} ${c.lastName}`,
    visits: c.totalVisits,
    spent: Math.round(Number(c.totalSpent) * 100) / 100,
    lastVisit: c.lastVisitAt ? format(c.lastVisitAt, "MMM d") : "Never",
  }))
}

export async function getClientAcquisitionSources(businessId?: string) {
  const colors: Record<string, string> = {
    google: "#059669",
    referral: "#34d399",
    social_media: "#6ee7b7",
    walk_in: "#a7f3d0",
    other: "#d1fae5",
  }

  const names: Record<string, string> = {
    google: "Google Search",
    referral: "Referrals",
    social_media: "Social Media",
    walk_in: "Walk-ins",
    other: "Other",
  }

  const defaultColors = ["#059669", "#34d399", "#6ee7b7", "#a7f3d0", "#d1fae5"]
  const businessFilter = businessId ? { businessId } : {}

  const clients = await prisma.client.groupBy({
    by: ["source"],
    where: businessFilter,
    _count: true,
  })

  const total = clients.reduce((sum, c) => sum + c._count, 0)

  let colorIdx = 0
  return clients
    .filter((c) => c.source !== null)
    .map((c) => ({
      name: names[c.source ?? "other"] ?? (c.source ?? "Other"),
      value: total > 0 ? Math.round((c._count / total) * 100) : 0,
      color: colors[c.source ?? "other"] ?? defaultColors[colorIdx++ % defaultColors.length],
    }))
}

// ============================================================================
// INDIVIDUAL STAFF PERFORMANCE (for staff detail page)
// ============================================================================

export async function getStaffPerformanceByName(staffName: string, businessId?: string) {
  const nameParts = staffName.split(" ")
  const firstName = nameParts[0]
  const lastName = nameParts.slice(1).join(" ")

  const locationFilter = businessId
    ? { primaryLocation: { businessId } }
    : {}

  const staff = await prisma.staff.findFirst({
    where: {
      isActive: true,
      ...locationFilter,
      user: {
        firstName: { equals: firstName, mode: "insensitive" },
        lastName: { equals: lastName, mode: "insensitive" },
      },
    },
    include: {
      user: true,
      appointmentServices: {
        include: { appointment: true },
      },
      reviews: true,
    },
  })

  if (!staff) return null

  const completedServices = staff.appointmentServices.filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (as_: any) => as_.appointment.status === "completed"
  )
  const revenue = completedServices.reduce(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sum: number, as_: any) => sum + Number(as_.finalPrice),
    0
  )
  const avgRating =
    staff.reviews.length > 0
      ? staff.reviews.reduce((sum, r) => sum + r.overallRating, 0) / staff.reviews.length
      : 0

  return {
    name: `${staff.user.firstName} ${staff.user.lastName}`,
    appointments: completedServices.length,
    revenue: Math.round(revenue * 100) / 100,
    rating: Math.round(avgRating * 10) / 10,
    commission: Math.round(revenue * Number(staff.commissionRate) / 100),
  }
}
