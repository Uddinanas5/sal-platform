import { auth } from "@/lib/auth"
import { getClients } from "@/lib/queries/clients"
import { ClientsClient } from "./client"

export const dynamic = "force-dynamic"
export default async function ClientsPage() {
  const session = await auth()
  const businessId = session?.user?.businessId ?? undefined

  const clients = await getClients(undefined, businessId)

  return <ClientsClient initialClients={clients} />
}
