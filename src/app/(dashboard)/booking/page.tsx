import { getServices } from "@/lib/queries/services"
import { getStaff } from "@/lib/queries/staff"
import { BookingClient } from "./client"

export const dynamic = "force-dynamic"
export default async function BookingPage() {
  const [services, staff] = await Promise.all([getServices(), getStaff()])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <BookingClient services={services as any} staff={staff as any} />
}
