import { getClientById } from "@/lib/queries/clients"
import { auth } from "@/lib/auth"
import { notFound, redirect } from "next/navigation"
import { ClientDetailClient } from "./client"

export const dynamic = "force-dynamic"
export default async function ClientDetailPage({ params }: { params: { id: string } }) {
  const session = await auth()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const businessId = (session?.user as any)?.businessId
  if (!session?.user || !businessId) redirect("/login")

  const client = await getClientById(params.id, businessId)
  if (!client) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <ClientDetailClient client={client as any} />
}
