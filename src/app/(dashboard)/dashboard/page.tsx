import { auth } from "@/lib/auth"
import { getTodaysAppointments, getDashboardStats } from "@/lib/queries/appointments"
import { getClients } from "@/lib/queries/clients"
import { getRevenueByDay, getChannelBreakdown, getStaffPerformance } from "@/lib/queries/reports"
import { DashboardClient } from "./client"

export const dynamic = "force-dynamic"
export default async function DashboardPage() {
  const session = await auth()
  const businessId = session?.user?.businessId ?? undefined

  const [appointments, stats, clients, revenueData, channelData, staffData] = await Promise.all([
    getTodaysAppointments(businessId),
    getDashboardStats(businessId),
    getClients(undefined, businessId),
    getRevenueByDay(7, businessId),
    getChannelBreakdown(businessId),
    getStaffPerformance(businessId),
  ])

  return (
    <DashboardClient
      appointments={appointments}
      stats={stats}
      clients={clients}
      revenueData={revenueData}
      channelData={channelData}
      staffData={staffData}
    />
  )
}
