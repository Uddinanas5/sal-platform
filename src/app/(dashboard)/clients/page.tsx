import { auth } from "@/lib/auth"
import { getClients } from "@/lib/queries/clients"
import { mockClients } from "@/data/mock-data"
import type { Client } from "@/data/mock-data"
import { ClientsClient } from "./client"

export const dynamic = "force-dynamic"
export default async function ClientsPage() {
  const session = await auth()
  const businessId = session?.user?.businessId ?? undefined

  let clients: Client[] | undefined

  try {
    clients = await getClients(undefined, businessId)
  } catch {
    clients = mockClients
  }

  return <ClientsClient initialClients={clients!} />
}
