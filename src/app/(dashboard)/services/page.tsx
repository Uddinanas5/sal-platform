import { auth } from "@/lib/auth"
import { getServices } from "@/lib/queries/services"
import { getStaff } from "@/lib/queries/staff"
import { mockServices, mockStaff } from "@/data/mock-data"
import { ServicesClient } from "./client"

export const dynamic = "force-dynamic"
export default async function ServicesPage() {
  const session = await auth()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const businessId = (session?.user as any)?.businessId as string | undefined

  let services
  let staff

  try {
    ;[services, staff] = await Promise.all([getServices(businessId), getStaff(businessId)])
  } catch {
    services = mockServices
    staff = mockStaff
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <ServicesClient initialServices={services as any} staff={staff as any} />
}
