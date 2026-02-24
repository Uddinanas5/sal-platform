import { auth } from "@/lib/auth"
import { getStaff } from "@/lib/queries/staff"
import { getServices } from "@/lib/queries/services"
import { StaffClient } from "./client"

export const dynamic = "force-dynamic"
export default async function StaffPage() {
  const session = await auth()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const businessId = (session?.user as any)?.businessId as string | undefined

  const [staff, services] = await Promise.all([getStaff(businessId), getServices(businessId)])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <StaffClient initialStaff={staff as any} services={services as any} />
}
