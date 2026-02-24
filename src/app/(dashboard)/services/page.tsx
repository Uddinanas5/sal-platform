import { auth } from "@/lib/auth"
import { getServices } from "@/lib/queries/services"
import { getStaff } from "@/lib/queries/staff"
import { ServicesClient } from "./client"

export const dynamic = "force-dynamic"
export default async function ServicesPage() {
  const session = await auth()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const businessId = (session?.user as any)?.businessId as string | undefined

  const [services, staff] = await Promise.all([getServices(businessId), getStaff(businessId)])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <ServicesClient initialServices={services as any} staff={staff as any} />
}
