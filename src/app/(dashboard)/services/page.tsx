import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { getServices } from "@/lib/queries/services"
import { getStaff } from "@/lib/queries/staff"
import { getBundles } from "@/lib/actions/bundles"
import { ServicesClient } from "./client"

export const dynamic = "force-dynamic"
export default async function ServicesPage() {
  const session = await auth()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const businessId = (session?.user as any)?.businessId as string | undefined
  if (!businessId) redirect("/onboarding")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const role = ((session?.user as any)?.role as string | undefined) ?? "staff"

  const [services, staff, bundles] = await Promise.all([
    getServices(businessId, true),
    getStaff(businessId),
    getBundles(businessId),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <ServicesClient initialServices={services as any} staff={staff as any} role={role} bundles={bundles} />
}
