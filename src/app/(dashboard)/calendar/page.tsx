import { auth } from "@/lib/auth"
import { getAppointments } from "@/lib/queries/appointments"
import { getStaff } from "@/lib/queries/staff"
import { getServices } from "@/lib/queries/services"
import { getClients } from "@/lib/queries/clients"
import { getWaitlistEntries } from "@/lib/queries/waitlist"
import { prisma } from "@/lib/prisma"
import { CalendarClient } from "./client"

export const dynamic = "force-dynamic"
export default async function CalendarPage() {
  const session = await auth()
  const businessId = session?.user?.businessId ?? undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const role = (session?.user as any)?.role as string | undefined
  const userId = session?.user?.id as string | undefined

  // Staff users only see their own appointments
  let staffIdFilter: string | undefined
  if (role === "staff" && userId && businessId) {
    const staffProfile = await prisma.staff.findFirst({
      where: { userId, primaryLocation: { businessId }, isActive: true },
      select: { id: true },
    })
    staffIdFilter = staffProfile?.id
  }

  const [appointments, staff, services, clients] = await Promise.all([
    getAppointments({ businessId, staffId: staffIdFilter }),
    getStaff(businessId),
    getServices(businessId),
    getClients(undefined, businessId),
  ])

  let waitlistEntries: Awaited<ReturnType<typeof getWaitlistEntries>> = []
  try {
    waitlistEntries = await getWaitlistEntries(businessId)
  } catch {
    waitlistEntries = []
  }

  return (
    <CalendarClient
      initialAppointments={appointments}
      staff={staff}
      services={services}
      clients={clients}
      waitlistEntries={waitlistEntries}
    />
  )
}
