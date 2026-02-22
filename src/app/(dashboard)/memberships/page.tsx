import { auth } from "@/lib/auth"
import { getMembershipStats, getGiftCards } from "@/lib/queries/memberships"
import { getClients } from "@/lib/queries/clients"
import { membershipStats, mockGiftCards, mockMembers } from "@/data/mock-memberships"
import { mockClients } from "@/data/mock-data"
import { MembershipsClient } from "./client"

export const dynamic = "force-dynamic"
export default async function MembershipsPage() {
  const session = await auth()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const businessId = (session?.user as any)?.businessId as string | undefined

  let stats
  let giftCards
  let clients

  try {
    ;[stats, giftCards, clients] = await Promise.all([
      getMembershipStats(businessId),
      getGiftCards(businessId),
      getClients(undefined, businessId),
    ])
  } catch {
    stats = membershipStats
    giftCards = mockGiftCards
    clients = mockClients.map((c) => ({ id: c.id, name: c.name }))
  }

  return (
    <MembershipsClient
      stats={stats}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      giftCards={giftCards as any}
      clients={clients.map((c) => ({ id: c.id, name: c.name }))}
      members={mockMembers}
    />
  )
}
