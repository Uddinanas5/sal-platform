import { prisma } from "@/lib/prisma"
import { subDays, subMonths, startOfDay, startOfMonth, endOfMonth, format } from "date-fns"

// ============================================================================
// DATE RANGE HELPER
// ============================================================================

/**
 * A resolved reporting window. `from` is inclusive, `to` is exclusive — built
 * by `resolveRange` so all period-scoped queries agree on the same boundaries.
 */
export interface DateRange {
  from: Date
  to: Date
}

/**
 * Resolve an optional caller-supplied window into a concrete {from, to}.
 *
 * - Defaults to the current calendar month when nothing is supplied (preserves
 *   the historical behaviour the UI relied on).
 * - `to` is treated as exclusive; when a caller passes a day-precision `to` we
 *   bump it to the end of that day so the picked end date is itself included.
 * - Invalid / inverted ranges fall back to the default month rather than
 *   throwing, so a malformed URL param can never leak an unbounded query.
 */
export function resolveRange(range?: { from?: Date | null; to?: Date | null }): DateRange {
  const now = new Date()
  const defaultFrom = startOfMonth(now)
  const defaultTo = endOfMonth(now)

  const from = range?.from instanceof Date && !isNaN(range.from.getTime()) ? range.from : defaultFrom
  let to = range?.to instanceof Date && !isNaN(range.to.getTime()) ? range.to : defaultTo

  // Make a day-precision `to` inclusive of that whole day.
  if (to.getHours() === 0 && to.getMinutes() === 0 && to.getSeconds() === 0 && to.getMilliseconds() === 0) {
    to = new Date(to.getTime() + 24 * 60 * 60 * 1000 - 1)
  }

  if (from > to) return { from: defaultFrom, to: defaultTo }
  return { from, to }
}

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

export async function getStaffPerformance(
  businessId?: string,
  range?: { from?: Date | null; to?: Date | null }
) {
  // Staff links to business through location
  const locationFilter = businessId
    ? { primaryLocation: { businessId } }
    : {}

  // A window is applied only when the caller explicitly passes a range. With no
  // range this aggregates across all time, preserving the existing behaviour for
  // callers like the dashboard. The reports page passes the picker's range.
  const hasWindow = !!(range && (range.from || range.to))
  const { from, to } = hasWindow ? resolveRange(range) : { from: undefined, to: undefined }
  const periodFilter = hasWindow ? { createdAt: { gte: from, lte: to } } : {}
  const apptPeriodFilter = hasWindow ? { startTime: { gte: from, lte: to } } : {}

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

  // 2. Aggregate average ratings per staff.
  // 3. Aggregate REAL earned commission AND the matching service revenue from the
  //    SAME Commission ledger window (populated by checkout). Revenue is the sum of
  //    Commission.grossAmount (= AppointmentService.finalPrice snapshotted at
  //    checkout) and commission is the sum of Commission.commissionAmount, both over
  //    the SAME { createdAt window, type:"service" }. This ties the two columns to
  //    the same paid sales — commission reads as ~rate% of the displayed revenue —
  //    and reflects checked-out (paid) revenue, the correct basis for an earnings
  //    table. (Previously revenue used appointment-startTime pre-discount finalPrice
  //    while commission used Commission.createdAt, so they described different sales
  //    and never reconciled.) If the ledger has no rows for a staff member, both
  //    honestly read $0 rather than a fabricated estimate.
  // 4. Appointment count stays on the appointment basis (completed appointments in
  //    the window) — a distinct "how many visits" metric, labelled as such.
  const [appointmentsByStaff, ratingsByStaff, ledgerByStaff] = await Promise.all([
    prisma.appointmentService.groupBy({
      by: ["staffId"],
      where: {
        staffId: { in: staffIds },
        appointment: { status: "completed", ...apptPeriodFilter },
      },
      _count: true,
    }),
    prisma.review.groupBy({
      by: ["staffId"],
      where: {
        staffId: { in: staffIds },
      },
      _avg: { overallRating: true },
    }),
    prisma.commission.groupBy({
      by: ["staffId"],
      where: {
        staffId: { in: staffIds },
        type: "service",
        ...periodFilter,
      },
      _sum: { grossAmount: true, commissionAmount: true },
    }),
  ])

  // 5. Build lookup maps for O(1) access
  const appointmentCountMap = new Map(
    appointmentsByStaff.map((r) => [r.staffId, r._count])
  )
  const ratingMap = new Map(
    ratingsByStaff
      .filter((r): r is typeof r & { staffId: string } => r.staffId !== null)
      .map((r) => [r.staffId, Number(r._avg.overallRating ?? 0)])
  )
  const ledgerMap = new Map(
    ledgerByStaff.map((c) => [
      c.staffId,
      {
        revenue: Number(c._sum.grossAmount ?? 0),
        commission: Number(c._sum.commissionAmount ?? 0),
      },
    ])
  )

  // 6. Combine results
  return staff.map((s) => {
    const ledger = ledgerMap.get(s.id) ?? { revenue: 0, commission: 0 }
    const avgRating = ratingMap.get(s.id) ?? 0

    return {
      name: `${s.user.firstName} ${s.user.lastName}`,
      appointments: appointmentCountMap.get(s.id) ?? 0,
      revenue: Math.round(ledger.revenue * 100) / 100,
      rating: Math.round(avgRating * 10) / 10,
      commission: Math.round(ledger.commission * 100) / 100,
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

export async function getReportSummary(
  businessId?: string,
  range?: { from?: Date | null; to?: Date | null }
) {
  // Current window = the selected range (defaults to this month). The previous
  // comparison window is the immediately-preceding span of equal length, so
  // growth % stays meaningful for any picked range.
  const { from: thisMonthStart, to: rangeEnd } = resolveRange(range)
  const windowMs = rangeEnd.getTime() - thisMonthStart.getTime()
  const lastMonthStart = new Date(thisMonthStart.getTime() - windowMs)
  const lastMonthEnd = thisMonthStart
  const businessFilter = businessId ? { businessId } : {}

  // Run independent queries in parallel
  const [
    currentPaymentAgg,
    lastPaymentAgg,
    currentAppointments,
    lastAppointments,
    newClients,
    lastNewClients,
  ] = await Promise.all([
    prisma.payment.aggregate({
      where: {
        ...businessFilter,
        status: "completed",
        createdAt: { gte: thisMonthStart, lte: rangeEnd },
      },
      _sum: { totalAmount: true, tipAmount: true, amount: true },
      _count: true,
    }),
    prisma.payment.aggregate({
      where: {
        ...businessFilter,
        status: "completed",
        createdAt: { gte: lastMonthStart, lt: lastMonthEnd },
      },
      _sum: { totalAmount: true },
      _count: true,
    }),
    prisma.appointment.count({
      where: { ...businessFilter, startTime: { gte: thisMonthStart, lte: rangeEnd } },
    }),
    prisma.appointment.count({
      where: { ...businessFilter, startTime: { gte: lastMonthStart, lt: lastMonthEnd } },
    }),
    prisma.client.count({
      where: { ...businessFilter, createdAt: { gte: thisMonthStart, lte: rangeEnd } },
    }),
    prisma.client.count({
      where: { ...businessFilter, createdAt: { gte: lastMonthStart, lt: lastMonthEnd } },
    }),
  ])

  const totalRevenue = Number(currentPaymentAgg._sum.totalAmount ?? 0)
  const lastRevenue = Number(lastPaymentAgg._sum.totalAmount ?? 0)

  // Average ticket = completed revenue / completed PAYMENTS in the SAME window.
  // Numerator and denominator are now on the same rows + time axis (Payment.createdAt),
  // so cancelled/no-show appointments no longer inflate the denominator and the two
  // sides are no longer on mismatched time bases. (totalAppointments below stays an
  // all-status booking count — a separate metric.)
  const currentPaymentCount = currentPaymentAgg._count
  const lastPaymentCount = lastPaymentAgg._count
  const averageTicket = currentPaymentCount > 0 ? totalRevenue / currentPaymentCount : 0
  const lastAvgTicket = lastPaymentCount > 0 ? lastRevenue / lastPaymentCount : 0

  // Retention rate: returning clients / total clients with visits in window
  const totalClientsThisMonth = await prisma.client.count({
    where: {
      ...businessFilter,
      appointments: { some: { startTime: { gte: thisMonthStart, lte: rangeEnd } } },
    },
  })
  const returningClientsThisMonth = await prisma.client.count({
    where: {
      ...businessFilter,
      totalVisits: { gt: 1 },
      appointments: { some: { startTime: { gte: thisMonthStart, lte: rangeEnd } } },
    },
  })
  const retentionRate = totalClientsThisMonth > 0
    ? Math.round((returningClientsThisMonth / totalClientsThisMonth) * 1000) / 10
    : 0

  // Service vs product revenue, each on a clean PRE-TAX, PRE-TIP line basis —
  // NOT by subtracting a gross product total from a tax+tip-inclusive payment
  // total (which conflated tax + tip + discount into "service revenue").
  //
  // - serviceRevenue: sum of AppointmentService.finalPrice (post-discount,
  //   pre-tax, pre-tip) for completed appointments in the window.
  // - productRevenue: sum of AppointmentProduct.totalPrice for product lines sold
  //   in the window. Product lines are now written at checkout (record-checkout.ts);
  //   they carry a paymentId so they window by the SAME Payment.createdAt axis as
  //   totalRevenue, and are businessId-scoped through the product relation (a
  //   standalone walk-in product sale has no appointment, so we cannot scope via
  //   the appointment relation alone).
  // - tax + tips are reported as their own summary lines rather than folded into
  //   service revenue (taxCollected = total − amount − tip; tips = Payment.tipAmount).
  const [serviceRevenueAgg, productRevenueAgg] = await Promise.all([
    prisma.appointmentService.aggregate({
      where: {
        appointment: {
          ...businessFilter,
          status: "completed",
          startTime: { gte: thisMonthStart, lte: rangeEnd },
        },
      },
      _sum: { finalPrice: true },
    }),
    prisma.appointmentProduct.aggregate({
      where: {
        product: businessId ? { businessId } : {},
        payment: { status: "completed", createdAt: { gte: thisMonthStart, lte: rangeEnd } },
      },
      _sum: { totalPrice: true },
    }),
  ])
  const serviceRevenue = Number(serviceRevenueAgg._sum.finalPrice ?? 0)
  const productRevenue = Number(productRevenueAgg._sum.totalPrice ?? 0)

  // Tax + tips as their own lines (kept out of service/product revenue).
  const tipsCollected = Number(currentPaymentAgg._sum.tipAmount ?? 0)
  const taxCollected =
    totalRevenue - Number(currentPaymentAgg._sum.amount ?? 0) - tipsCollected

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
    taxCollected: Math.round(taxCollected * 100) / 100,
    tipsCollected: Math.round(tipsCollected * 100) / 100,
  }
}

// ============================================================================
// REVENUE TAB QUERIES
// ============================================================================

export async function getRevenueByMonth(months: number = 6, businessId?: string) {
  const businessFilter = businessId ? { businessId } : {}
  const rangeStart = startOfMonth(subMonths(new Date(), months - 1))

  // Single query: fetch all payments in the full date range
  const payments = await prisma.payment.findMany({
    where: {
      ...businessFilter,
      status: "completed",
      createdAt: { gte: rangeStart },
    },
    select: { totalAmount: true, createdAt: true },
  })

  // Build month boundaries for grouping
  const monthBoundaries: { start: Date; end: Date; label: string }[] = []
  for (let i = months - 1; i >= 0; i--) {
    const start = startOfMonth(subMonths(new Date(), i))
    const end = i > 0 ? startOfMonth(subMonths(new Date(), i - 1)) : new Date()
    monthBoundaries.push({ start, end, label: format(start, "MMM") })
  }

  // Group payments by month in JS
  const revenueByMonth = new Map<string, number>()
  for (const { label } of monthBoundaries) {
    revenueByMonth.set(label, 0)
  }
  for (const p of payments) {
    for (const { start, end, label } of monthBoundaries) {
      if (p.createdAt >= start && p.createdAt < end) {
        revenueByMonth.set(label, (revenueByMonth.get(label) ?? 0) + Number(p.totalAmount))
        break
      }
    }
  }

  return monthBoundaries.map(({ label }) => ({
    month: label,
    revenue: Math.round((revenueByMonth.get(label) ?? 0) * 100) / 100,
  }))
}

export async function getRevenueByCategory(
  businessId?: string,
  range?: { from?: Date | null; to?: Date | null }
) {
  const categoryColors: Record<string, string> = {
    Hair: "#f97316",
    Wellness: "#10b981",
    Nails: "#ec4899",
    Skincare: "#06b6d4",
    Products: "#8b5cf6",
  }
  const defaultColors = ["#f97316", "#10b981", "#ec4899", "#06b6d4", "#8b5cf6", "#6366f1", "#14b8a6"]
  const businessFilter = businessId ? { businessId } : {}

  // Honour the picker range so this breakdown reconciles with the windowed Total
  // Revenue card on the same tab (previously this query was all-time). A window is
  // applied only when the caller passes a range; absent one it stays all-time.
  const window = range && (range.from || range.to) ? resolveRange(range) : null
  const apptWhere = {
    ...businessFilter,
    status: "completed" as const,
    ...(window ? { startTime: { gte: window.from, lte: window.to } } : {}),
  }

  const services = await prisma.appointmentService.findMany({
    where: {
      appointment: apptWhere,
    },
    select: {
      finalPrice: true,
      service: {
        select: {
          category: { select: { name: true } },
        },
      },
    },
  })

  const byCategory: Record<string, number> = {}
  for (const s of services) {
    const catName = s.service.category?.name ?? "Other"
    byCategory[catName] = (byCategory[catName] ?? 0) + Number(s.finalPrice)
  }

  // Add product revenue from the product-sale lines, windowed by the Payment
  // ledger (same createdAt axis as the Total Revenue card) and businessId-scoped
  // through the product relation so standalone (no-appointment) sales count too.
  const productRevenue = await prisma.appointmentProduct.aggregate({
    where: {
      product: businessId ? { businessId } : {},
      payment: {
        status: "completed",
        ...(window ? { createdAt: { gte: window.from, lte: window.to } } : {}),
      },
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

export async function getRevenueByPaymentMethod(
  businessId?: string,
  range?: { from?: Date | null; to?: Date | null }
) {
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

  // Honour the picker range (windowed by Payment.createdAt, matching the Total
  // Revenue card) so this pie reconciles with the windowed summary instead of
  // showing all-time totals. A window is applied only when a range is passed.
  const window = range && (range.from || range.to) ? resolveRange(range) : null

  const payments = await prisma.payment.groupBy({
    by: ["method"],
    where: {
      ...businessFilter,
      status: "completed",
      ...(window ? { createdAt: { gte: window.from, lte: window.to } } : {}),
    },
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

export async function getAppointmentsByHour(
  businessId: string,
  range?: { from?: Date | null; to?: Date | null }
) {
  const hourLabels = [
    "8AM", "9AM", "10AM", "11AM", "12PM", "1PM",
    "2PM", "3PM", "4PM", "5PM", "6PM", "7PM",
  ]

  const { from, to } = resolveRange(range)
  const businessFilter = { businessId }

  const appointments = await prisma.appointment.findMany({
    where: { ...businessFilter, startTime: { gte: from, lte: to } },
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

export async function getAppointmentCompletionRate(
  businessId?: string,
  range?: { from?: Date | null; to?: Date | null }
) {
  const { from, to } = resolveRange(range)
  const businessFilter = businessId ? { businessId } : {}

  // Single query: group by status to get all counts at once
  const [statusCounts, rescheduledCount] = await Promise.all([
    prisma.appointment.groupBy({
      by: ["status"],
      where: { ...businessFilter, startTime: { gte: from, lte: to } },
      _count: true,
    }),
    prisma.appointment.count({
      where: {
        ...businessFilter,
        startTime: { gte: from, lte: to },
        rescheduledTo: { not: null },
      },
    }),
  ])

  const total = statusCounts.reduce((sum, s) => sum + s._count, 0)

  if (total === 0) {
    return { completed: 0, cancelled: 0, noShow: 0, rescheduled: 0 }
  }

  const countMap = new Map(statusCounts.map((s) => [s.status, s._count]))

  return {
    completed: Math.round(((countMap.get("completed") ?? 0) / total) * 100),
    cancelled: Math.round(((countMap.get("cancelled") ?? 0) / total) * 100),
    noShow: Math.round(((countMap.get("no_show") ?? 0) / total) * 100),
    rescheduled: Math.round((rescheduledCount / total) * 100),
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

/**
 * Per-staff performance for the staff detail page.
 *
 * SECURITY: scopes by BOTH the staff row id AND the caller's businessId (via the
 * staff's primary location). `businessId` is REQUIRED — there is no name-based,
 * cross-business fallback, so it is impossible to return a staff member from
 * another business (closes the cross-tenant report leak). Returns null when the
 * id does not belong to the caller's business.
 *
 * `commission` reads the REAL earned-commission ledger (Commission, populated by
 * checkout) for the window — never a hardcoded percentage estimate. An empty
 * ledger honestly yields $0.
 */
export async function getStaffPerformanceById(
  staffId: string,
  businessId: string,
  range?: { from?: Date | null; to?: Date | null }
) {
  if (!staffId || !businessId) return null

  // The staff detail page wants lifetime numbers, so when NO range is supplied we
  // aggregate across all time (matching the prior behaviour). A window is applied
  // only when the caller explicitly asks for one.
  const hasWindow = !!(range && (range.from || range.to))
  const { from, to } = hasWindow ? resolveRange(range) : { from: undefined, to: undefined }
  const apptWindow = hasWindow ? { startTime: { gte: from, lte: to } } : {}
  const commissionWindow = hasWindow ? { createdAt: { gte: from, lte: to } } : {}

  // The id AND the business must both match. findFirst with both predicates can
  // never resolve a row whose primary location belongs to another business.
  const staff = await prisma.staff.findFirst({
    where: {
      id: staffId,
      primaryLocation: { businessId },
    },
    select: {
      id: true,
      user: { select: { firstName: true, lastName: true } },
    },
  })

  if (!staff) return null

  // Aggregations (all scoped by the verified staff.id + optional window).
  const [revenueAgg, ratingAgg, commissionAgg] = await Promise.all([
    prisma.appointmentService.aggregate({
      where: {
        staffId: staff.id,
        appointment: { status: "completed", ...apptWindow },
      },
      _sum: { finalPrice: true },
      _count: true,
    }),
    prisma.review.aggregate({
      where: { staffId: staff.id },
      _avg: { overallRating: true },
    }),
    prisma.commission.aggregate({
      where: { staffId: staff.id, ...commissionWindow },
      _sum: { commissionAmount: true },
    }),
  ])

  const revenue = Number(revenueAgg._sum.finalPrice ?? 0)
  const avgRating = Number(ratingAgg._avg.overallRating ?? 0)
  const commission = Number(commissionAgg._sum.commissionAmount ?? 0)

  return {
    name: `${staff.user.firstName} ${staff.user.lastName}`,
    appointments: revenueAgg._count,
    revenue: Math.round(revenue * 100) / 100,
    rating: Math.round(avgRating * 10) / 10,
    commission: Math.round(commission * 100) / 100,
  }
}
