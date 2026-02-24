import { auth } from "@/lib/auth"
import {
  getReportSummary,
  getRevenueByMonth,
  getRevenueByCategory,
  getRevenueByPaymentMethod,
  getStaffPerformance,
  getAppointmentsByHour,
  getAppointmentCompletionRate,
  getBusiestTimesHeatmap,
  getClientRetention,
  getTopClients,
  getClientAcquisitionSources,
} from "@/lib/queries/reports"
import { ReportsClient } from "./client"

export const dynamic = "force-dynamic"
export default async function ReportsPage() {
  const session = await auth()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const businessId = (session?.user as any)?.businessId as string | undefined

  const [
    summary,
    revenueByMonth,
    revenueByCategory,
    revenueByPaymentMethod,
    staffPerformance,
    appointmentsByHour,
    appointmentCompletionRate,
    busiestTimesHeatmap,
    clientRetention,
    topClients,
    clientAcquisitionSources,
  ] = await Promise.all([
    getReportSummary(businessId),
    getRevenueByMonth(6, businessId),
    getRevenueByCategory(businessId),
    getRevenueByPaymentMethod(businessId),
    getStaffPerformance(businessId),
    getAppointmentsByHour(businessId),
    getAppointmentCompletionRate(businessId),
    getBusiestTimesHeatmap(businessId),
    getClientRetention(6, businessId),
    getTopClients(5, businessId),
    getClientAcquisitionSources(businessId),
  ])

  return (
    <ReportsClient
      summary={summary}
      revenueByMonth={revenueByMonth}
      revenueByCategory={revenueByCategory}
      revenueByPaymentMethod={revenueByPaymentMethod}
      staffPerformance={staffPerformance}
      appointmentsByHour={appointmentsByHour}
      appointmentCompletionRate={appointmentCompletionRate}
      busiestTimesHeatmap={busiestTimesHeatmap}
      clientRetention={clientRetention}
      topClients={topClients}
      clientAcquisitionSources={clientAcquisitionSources}
    />
  )
}
