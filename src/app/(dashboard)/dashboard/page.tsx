import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { getTodaysAppointments, getDashboardStats } from "@/lib/queries/appointments"
import { getClients } from "@/lib/queries/clients"
import { getRevenueByDay, getChannelBreakdown, getStaffPerformance } from "@/lib/queries/reports"
import { DashboardClient } from "./client"

export const dynamic = "force-dynamic"
export default async function DashboardPage() {
  const session = await auth()
  const businessId = session?.user?.businessId ?? undefined
  if (!businessId) redirect("/onboarding")
  // Staff are blocked from /reports; the dashboard must not leak the same
  // financial data (shop revenue, per-colleague earnings) as a side door.
  const isStaff = session?.user?.role === "staff"

  const [appointments, stats, clients, revenueData, channelData, staffData] = await Promise.all([
    getTodaysAppointments(businessId),
    getDashboardStats(businessId),
    getClients(undefined, businessId),
    getRevenueByDay(7, businessId),
    getChannelBreakdown(businessId),
    getStaffPerformance(businessId),
  ])

  const safeStats = isStaff
    ? { ...stats, todayRevenue: 0, weeklyRevenue: 0, monthlyRevenue: 0, averageOrderValue: 0 }
    : stats

  return (
    <DashboardClient
      appointments={appointments}
      stats={safeStats}
      clients={clients}
      revenueData={isStaff ? [] : revenueData}
      channelData={channelData}
      staffData={isStaff ? [] : staffData}
      hideRevenue={isStaff}
    />
  )
}
