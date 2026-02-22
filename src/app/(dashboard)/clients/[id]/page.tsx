import { getClientById } from "@/lib/queries/clients"
import { mockClients } from "@/data/mock-data"
import { notFound } from "next/navigation"
import { ClientDetailClient } from "./client"

export const dynamic = "force-dynamic"
export default async function ClientDetailPage({ params }: { params: { id: string } }) {
  let client
  try {
    client = await getClientById(params.id)
    if (!client) notFound()
  } catch {
    client = mockClients.find(c => c.id === params.id) || mockClients[0]
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <ClientDetailClient client={client as any} />
}
