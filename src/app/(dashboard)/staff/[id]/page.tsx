import { getStaffById } from "@/lib/queries/staff"
import { getServices } from "@/lib/queries/services"
import { getAppointments } from "@/lib/queries/appointments"
import { getStaffPerformanceById } from "@/lib/queries/reports"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notFound, redirect } from "next/navigation"
import { StaffDetailClient } from "./client"

export const dynamic = "force-dynamic"
export default async function StaffDetailPage({ params }: { params: { id: string } }) {
  const session = await auth()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const businessId = (session?.user as any)?.businessId
  if (!session?.user || !businessId) redirect("/login")

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [staff, services, staffAppointments, businessHoursRaw] = await Promise.all([
    getStaffById(params.id, businessId),
    getServices(businessId), // active-only for staff assignment
    getAppointments({ staffId: params.id, businessId }),
    prisma.businessHours.findMany({
      where: { location: { businessId, isPrimary: true } },
      select: { dayOfWeek: true, isClosed: true },
    }),
  ])

  // Build a map of which days the business is closed
  const closedDays = businessHoursRaw
    .filter((bh) => bh.isClosed)
    .map((bh) => bh.dayOfWeek)

  if (!staff) notFound()

  // Staff role users can only view their own profile
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userRole = (session.user as any)?.role as string | undefined
  const userId = session.user.id
  if (userRole === "staff" && staff.userId !== userId) {
    redirect("/dashboard")
  }

  // Fetch performance data for this staff member. Scoped by the route's staff id
  // AND the session's businessId so it can never resolve a barber from another
  // shop (cross-tenant report leak fix).
  let staffPerformance = null
  try {
    staffPerformance = await getStaffPerformanceById(params.id, businessId)
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      assignedServiceIds={(staff as any).assignedServiceIds ?? []}
      closedDays={closedDays}
    />
  )
}
