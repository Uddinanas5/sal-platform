import { prisma } from "@/lib/prisma"
import type { Appointment } from "@/data/mock-data"
import { dayBoundsInZone } from "@/lib/scheduling/zoned-time"

type AppointmentStatus = Appointment["status"]

// Returns appointments in the shape the frontend expects
export async function getAppointments(filters: {
  businessId: string
  dateFrom?: Date
  dateTo?: Date
  staffId?: string
  status?: string
}) {
  const where: Record<string, unknown> = {
    businessId: filters.businessId,
  }

  if (filters.dateFrom || filters.dateTo) {
    where.startTime = {}
    if (filters.dateFrom) (where.startTime as Record<string, unknown>).gte = filters.dateFrom
    if (filters.dateTo) (where.startTime as Record<string, unknown>).lte = filters.dateTo
  }

  if (filters.staffId) {
    where.services = { some: { staffId: filters.staffId } }
  }

  if (filters.status) {
    where.status = filters.status
  }

  const appointments = await prisma.appointment.findMany({
    where,
    select: {
      id: true,
      clientId: true,
      startTime: true,
      endTime: true,
      status: true,
      totalAmount: true,
      notes: true,
      client: {
        select: {
          firstName: true,
          lastName: true,
          metadata: true,
        },
      },
      services: {
        select: {
          serviceId: true,
          staffId: true,
          name: true,
          staff: {
            select: {
              user: { select: { firstName: true, lastName: true } },
            },
          },
        },
      },
    },
    orderBy: { startTime: "asc" },
  })

  return appointments.map((a) => {
    const firstService = a.services[0]
    return {
      id: a.id,
      clientId: a.clientId || "",
      clientName: a.client ? `${a.client.firstName} ${a.client.lastName}` : "Walk-in",
      clientAvatar: a.client?.metadata && typeof a.client.metadata === "object" && "avatar" in (a.client.metadata as Record<string, unknown>)
        ? (a.client.metadata as Record<string, unknown>).avatar as string
        : undefined,
      serviceId: firstService?.serviceId || "",
      serviceName: firstService?.name || "",
      staffId: firstService?.staffId || "",
      staffName: firstService ? `${firstService.staff.user.firstName} ${firstService.staff.user.lastName}` : "",
      startTime: a.startTime,
      endTime: a.endTime,
      status: mapStatus(a.status),
      price: Number(a.totalAmount),
      notes: a.notes || undefined,
    }
  })
}

export async function getTodaysAppointments(businessId: string) {
  // "Today" is the salon's calendar day, not the server's (UTC on Vercel) —
  // otherwise the dashboard shows the wrong day's appointments near midnight.
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { timezone: true },
  })
  const { start, end } = dayBoundsInZone(new Date(), business?.timezone || "UTC")
  return getAppointments({
    dateFrom: start,
    dateTo: end,
    businessId,
  })
}

export async function getDashboardStats(businessId: string) {
  const now = new Date()
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { timezone: true },
  })
  // Salon-local "today" window so today's appointment count + revenue reflect
  // the salon's calendar day, not the server's.
  const { start: todayStart, end: todayEnd } = dayBoundsInZone(now, business?.timezone || "UTC")

  const businessFilter = { businessId }

  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)

  const monthAgo = new Date()
  monthAgo.setDate(monthAgo.getDate() - 30)

  const [
    todayAppointments,
    todayPayments,
    totalClients,
    newClientsThisMonth,
    reviews,
    weeklyRevenueResult,
    monthlyRevenueResult,
  ] = await Promise.all([
    prisma.appointment.findMany({
      where: { ...businessFilter, startTime: { gte: todayStart, lte: todayEnd } },
      select: { status: true },
    }),
    prisma.payment.aggregate({
      where: {
        ...businessFilter,
        status: "completed",
        createdAt: { gte: todayStart, lte: todayEnd },
      },
      _sum: { totalAmount: true },
    }),
    prisma.client.count({ where: businessFilter }),
    prisma.client.count({
      where: {
        ...businessFilter,
        createdAt: {
          gte: new Date(now.getFullYear(), now.getMonth(), 1),
        },
      },
    }),
    prisma.review.aggregate({
      where: businessFilter,
      _avg: { overallRating: true },
      _count: true,
    }),
    // Weekly + monthly revenue come from the Payment ledger (status completed,
    // createdAt window) — the SAME source as todayRevenue (above) and the 7-day
    // sparkline (getRevenueByDay). Previously these summed Appointment.totalAmount
    // (the booked price+tax estimate written at booking and never updated at
    // checkout), so they diverged from actually-collected revenue and ignored
    // walk-in/POS payments that have no appointment. Sourcing from Payment lets
    // the weekly card tie to the 7-day sparkline and reflects discounts, tips,
    // loyalty redemption, custom Quick-Sale lines, and appointment-less sales.
    prisma.payment.aggregate({
      where: {
        ...businessFilter,
        status: "completed",
        createdAt: { gte: weekAgo },
      },
      _sum: { totalAmount: true },
    }),
    prisma.payment.aggregate({
      where: {
        ...businessFilter,
        status: "completed",
        createdAt: { gte: monthAgo },
      },
      _sum: { totalAmount: true },
    }),
  ])

  const weeklyRevenue = Number(weeklyRevenueResult._sum.totalAmount || 0)
  const monthlyRevenue = Number(monthlyRevenueResult._sum.totalAmount || 0)

  const completed = todayAppointments.filter((a) => a.status === "completed").length
  const upcoming = todayAppointments.filter((a) =>
    ["confirmed", "pending", "checked_in"].includes(a.status)
  ).length
  const pending = todayAppointments.filter((a) => a.status === "pending").length

  return {
    todayRevenue: Number(todayPayments._sum.totalAmount || 0),
    todayAppointments: todayAppointments.length,
    completedAppointments: completed,
    upcomingAppointments: upcoming,
    pendingAppointments: pending,
    weeklyRevenue,
    weeklyGrowth: 0,
    monthlyRevenue,
    monthlyGrowth: 0,
    totalClients,
    newClientsThisMonth,
    averageRating: Number(reviews._avg.overallRating || 0),
    totalReviews: reviews._count,
  }
}

function mapStatus(dbStatus: string): AppointmentStatus {
  const map: Record<string, AppointmentStatus> = {
    pending: "pending",
    confirmed: "confirmed",
    checked_in: "checked-in",
    in_progress: "in-progress",
    completed: "completed",
    cancelled: "cancelled",
    no_show: "no-show",
  }
  return map[dbStatus] || (dbStatus as AppointmentStatus)
}
