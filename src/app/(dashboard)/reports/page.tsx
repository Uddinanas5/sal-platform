import { redirect } from "next/navigation"
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

/**
 * Parse a `YYYY-MM-DD` (or ISO) URL param into a Date. Returns null for missing
 * or malformed input so a bad param degrades to the default window rather than
 * producing an invalid query.
 */
function parseDateParam(raw: string | string[] | undefined): Date | null {
  if (typeof raw !== "string" || raw.trim() === "") return null
  const d = new Date(raw)
  return isNaN(d.getTime()) ? null : d
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams?: { from?: string | string[]; to?: string | string[] }
}) {
  const session = await auth()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const businessId = (session?.user as any)?.businessId as string | undefined
  if (!businessId) redirect("/onboarding")

  // Date-range filter from the picker (URL search params). Absent/invalid →
  // the queries default to the current month.
  const from = parseDateParam(searchParams?.from)
  const to = parseDateParam(searchParams?.to)
  const range = { from, to }

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
    getReportSummary(businessId, range),
    getRevenueByMonth(6, businessId),
    getRevenueByCategory(businessId),
    getRevenueByPaymentMethod(businessId),
    getStaffPerformance(businessId, range),
    getAppointmentsByHour(businessId, range),
    getAppointmentCompletionRate(businessId, range),
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
