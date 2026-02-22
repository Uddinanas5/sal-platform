import { auth } from "@/lib/auth"
import { getAppointments } from "@/lib/queries/appointments"
import { getStaff } from "@/lib/queries/staff"
import { getServices } from "@/lib/queries/services"
import { getClients } from "@/lib/queries/clients"
import { getWaitlistEntries } from "@/lib/queries/waitlist"
import { mockAppointments, mockClients, mockServices, mockStaff } from "@/data/mock-data"
import type { Appointment, Staff, Service, Client } from "@/data/mock-data"
import { CalendarClient } from "./client"

type WaitlistData = Awaited<ReturnType<typeof getWaitlistEntries>>

export const dynamic = "force-dynamic"
export default async function CalendarPage() {
  const session = await auth()
  const businessId = session?.user?.businessId ?? undefined

  let appointments: Appointment[] | undefined
  let staff: Staff[] | undefined
  let services: Service[] | undefined
  let clients: Client[] | undefined
  let waitlistEntries: WaitlistData = []

  try {
    ;[appointments, staff, services, clients] = await Promise.all([
      getAppointments({ businessId }),
      getStaff(businessId),
      getServices(businessId),
      getClients(undefined, businessId),
    ])
  } catch {
    appointments = mockAppointments
    staff = mockStaff
    services = mockServices
    clients = mockClients
  }

  try {
    waitlistEntries = await getWaitlistEntries(businessId)
  } catch {
    waitlistEntries = []
  }

  return (
    <CalendarClient
      initialAppointments={appointments!}
      staff={staff!}
      services={services!}
      clients={clients!}
      waitlistEntries={waitlistEntries}
    />
  )
}
