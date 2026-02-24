import { getStaffById } from "@/lib/queries/staff"
import { getServices } from "@/lib/queries/services"
import { getAppointments } from "@/lib/queries/appointments"
import { getStaffPerformanceByName } from "@/lib/queries/reports"
import { auth } from "@/lib/auth"
import { notFound, redirect } from "next/navigation"
import { StaffDetailClient } from "./client"

export const dynamic = "force-dynamic"
export default async function StaffDetailPage({ params }: { params: { id: string } }) {
  const session = await auth()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const businessId = (session?.user as any)?.businessId
  if (!session?.user || !businessId) redirect("/login")

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [staff, services, staffAppointments] = await Promise.all([
    getStaffById(params.id, businessId),
    getServices(),
    getAppointments({ staffId: params.id }),
  ])

  if (!staff) notFound()

  // Fetch performance data for this staff member
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const staffName = (staff as any).name ?? `${(staff as any).user?.firstName ?? ""} ${(staff as any).user?.lastName ?? ""}`.trim()
  let staffPerformance = null
  try {
    staffPerformance = await getStaffPerformanceByName(staffName)
  } catch {
    staffPerformance = null
  }

  return (
    <StaffDetailClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      staff={staff as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      services={services as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      appointments={staffAppointments as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      staffPerformance={staffPerformance as any}
    />
  )
}
