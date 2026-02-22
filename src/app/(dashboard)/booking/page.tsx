import { getServices } from "@/lib/queries/services"
import { getStaff } from "@/lib/queries/staff"
import { mockServices, mockStaff } from "@/data/mock-data"
import { BookingClient } from "./client"

export const dynamic = "force-dynamic"
export default async function BookingPage() {
  let services
  let staff

  try {
    ;[services, staff] = await Promise.all([getServices(), getStaff()])
  } catch {
    services = mockServices
    staff = mockStaff
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <BookingClient services={services as any} staff={staff as any} />
}
