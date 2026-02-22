import { auth } from "@/lib/auth"
import { getResources } from "@/lib/queries/resources"
import { getServices } from "@/lib/queries/services"
import SettingsClient from "./client"

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  const session = await auth()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const businessId = (session?.user as any)?.businessId as string | undefined

  let resources: Awaited<ReturnType<typeof getResources>> = []
  let services: Awaited<ReturnType<typeof getServices>> = []

  try {
    resources = await getResources(businessId)
  } catch {
    resources = []
  }

  try {
    services = await getServices(businessId)
  } catch {
    services = []
  }

  // Map services to the format expected by the resources section
  const serviceOptions = services.map((s) => ({
    id: s.id,
    name: s.name,
    category: s.category,
  }))

  return <SettingsClient resources={resources} services={serviceOptions} />
}
