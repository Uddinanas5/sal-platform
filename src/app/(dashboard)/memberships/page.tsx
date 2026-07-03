import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { getMembershipStats, getGiftCards } from "@/lib/queries/memberships"
import { getClients } from "@/lib/queries/clients"
import { MembershipsClient } from "./client"

export const dynamic = "force-dynamic"
export default async function MembershipsPage() {
  const session = await auth()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const businessId = (session?.user as any)?.businessId as string | undefined
  if (!businessId) redirect("/onboarding")

  const [stats, giftCards, clients] = await Promise.all([
    getMembershipStats(businessId),
    getGiftCards(businessId),
    getClients(undefined, businessId),
  ])

  return (
    <MembershipsClient
      stats={{
        totalGiftCardsSold: stats.totalGiftCardsSold,
        outstandingGiftCardBalance: stats.outstandingGiftCardBalance,
      }}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      giftCards={giftCards as any}
      clients={clients.map((c) => ({ id: c.id, name: c.name }))}
    />
  )
}
