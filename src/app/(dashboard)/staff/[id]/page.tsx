import { getStaffById } from "@/lib/queries/staff"
import { getServices } from "@/lib/queries/services"
import { getAppointments } from "@/lib/queries/appointments"
import { getStaffPerformanceByName } from "@/lib/queries/reports"
import { mockStaff, mockServices } from "@/data/mock-data"
import { staffPerformance as mockStaffPerformanceData } from "@/data/mock-reports"
import { notFound } from "next/navigation"
import { StaffDetailClient } from "./client"

export const dynamic = "force-dynamic"
export default async function StaffDetailPage({ params }: { params: { id: string } }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let staff: any, services: any, staffAppointments: any[] = [], staffPerformance: any = null

  try {
    ;[staff, services, staffAppointments] = await Promise.all([
      getStaffById(params.id),
      getServices(),
      getAppointments({ staffId: params.id }),
    ])
    if (!staff) notFound()

    // Fetch performance data for this staff member
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const staffName = (staff as any).name ?? `${(staff as any).user?.firstName ?? ""} ${(staff as any).user?.lastName ?? ""}`.trim()
    try {
      staffPerformance = await getStaffPerformanceByName(staffName)
    } catch {
      staffPerformance = mockStaffPerformanceData.find((p) => p.name === staffName) ?? null
    }
  } catch {
    staff = mockStaff.find(s => s.id === params.id) || mockStaff[0]
    services = mockServices
    staffAppointments = []
    staffPerformance = mockStaffPerformanceData.find((p) => p.name === (staff as { name: string }).name) ?? null
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
