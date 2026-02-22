import { auth } from "@/lib/auth"
import { getTodaysAppointments, getDashboardStats } from "@/lib/queries/appointments"
import { getClients } from "@/lib/queries/clients"
import { getRevenueByDay, getChannelBreakdown, getStaffPerformance } from "@/lib/queries/reports"
import { mockAppointments, mockClients, dashboardStats } from "@/data/mock-data"
import type { Appointment, Client } from "@/data/mock-data"
import { revenueByDay, channelBreakdown, staffPerformance } from "@/data/mock-reports"
import { isSameDay } from "date-fns"
import { DashboardClient } from "./client"

type StatsData = Awaited<ReturnType<typeof getDashboardStats>>
type RevenueData = Awaited<ReturnType<typeof getRevenueByDay>>
type ChannelData = Awaited<ReturnType<typeof getChannelBreakdown>>
type StaffPerfData = Awaited<ReturnType<typeof getStaffPerformance>>

export const dynamic = "force-dynamic"
export default async function DashboardPage() {
  const session = await auth()
  const businessId = session?.user?.businessId ?? undefined

  let appointments: Appointment[] | undefined
  let stats: StatsData | undefined
  let clients: Client[] | undefined
  let revenueData: RevenueData | undefined
  let channelData: ChannelData | undefined
  let staffData: StaffPerfData | undefined

  try {
    ;[appointments, stats, clients, revenueData, channelData, staffData] = await Promise.all([
      getTodaysAppointments(businessId),
      getDashboardStats(businessId),
      getClients(undefined, businessId),
      getRevenueByDay(7, businessId),
      getChannelBreakdown(businessId),
      getStaffPerformance(businessId),
    ])
  } catch {
    const today = new Date()
    appointments = mockAppointments.filter((a) => isSameDay(a.startTime, today))
    stats = dashboardStats
    clients = mockClients
    revenueData = revenueByDay.map((d) => ({ day: d.day, revenue: d.revenue, appointments: d.appointments }))
    channelData = channelBreakdown
    staffData = staffPerformance
  }

  return (
    <DashboardClient
      appointments={appointments!}
      stats={stats!}
      clients={clients!}
      revenueData={revenueData!}
      channelData={channelData!}
      staffData={staffData!}
    />
  )
}
