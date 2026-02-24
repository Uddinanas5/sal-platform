import { auth } from "@/lib/auth"
import { getAppointments } from "@/lib/queries/appointments"
import { getStaff } from "@/lib/queries/staff"
import { getServices } from "@/lib/queries/services"
import { getClients } from "@/lib/queries/clients"
import { getWaitlistEntries } from "@/lib/queries/waitlist"
import { CalendarClient } from "./client"

export const dynamic = "force-dynamic"
export default async function CalendarPage() {
  const session = await auth()
  const businessId = session?.user?.businessId ?? undefined

  const [appointments, staff, services, clients] = await Promise.all([
    getAppointments({ businessId }),
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
