import { prisma } from "@/lib/prisma"
import { startOfDay, endOfDay } from "date-fns"
import type { Appointment } from "@/data/mock-data"

type AppointmentStatus = Appointment["status"]

// Returns appointments in the shape the frontend expects
export async function getAppointments(filters?: {
  dateFrom?: Date
  dateTo?: Date
  staffId?: string
  status?: string
  businessId?: string
}) {
  const where: Record<string, unknown> = {}

  if (filters?.businessId) {
    where.businessId = filters.businessId
  }

  if (filters?.dateFrom || filters?.dateTo) {
    where.startTime = {}
    if (filters.dateFrom) (where.startTime as Record<string, unknown>).gte = filters.dateFrom
    if (filters.dateTo) (where.startTime as Record<string, unknown>).lte = filters.dateTo
  }

  if (filters?.staffId) {
    where.services = { some: { staffId: filters.staffId } }
  }

  if (filters?.status) {
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

export async function getTodaysAppointments(businessId?: string) {
  const now = new Date()
  return getAppointments({
    dateFrom: startOfDay(now),
    dateTo: endOfDay(now),
    businessId,
  })
}

export async function getDashboardStats(businessId?: string) {
  const now = new Date()
  const todayStart = startOfDay(now)
  const todayEnd = endOfDay(now)

  const businessFilter = businessId ? { businessId } : {}

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
    prisma.appointment.aggregate({
      where: {
        ...businessFilter,
        status: "completed",
        completedAt: { gte: weekAgo },
      },
      _sum: { totalAmount: true },
    }),
    prisma.appointment.aggregate({
      where: {
        ...businessFilter,
        status: "completed",
        completedAt: { gte: monthAgo },
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
