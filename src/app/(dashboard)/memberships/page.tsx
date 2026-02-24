import { auth } from "@/lib/auth"
import { getMembershipStats, getGiftCards, getMemberships } from "@/lib/queries/memberships"
import { getClients } from "@/lib/queries/clients"
import { MembershipsClient } from "./client"

export const dynamic = "force-dynamic"
export default async function MembershipsPage() {
  const session = await auth()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const businessId = (session?.user as any)?.businessId as string | undefined

  const [stats, giftCards, clients, memberships] = await Promise.all([
    getMembershipStats(businessId),
    getGiftCards(businessId),
    getClients(undefined, businessId),
    getMemberships(businessId),
  ])

  // Map memberships to the Member shape expected by the client component
  const members = memberships.map((m) => ({
    id: m.id,
    clientId: m.clientId,
    clientName: m.clientName,
    planId: m.planId,
    planName: m.planName,
    startDate: m.startDate,
    nextBillingDate: m.nextBillingDate ?? m.startDate,
    status: mapMembershipStatus(m.status),
    totalSpent: m.totalPaid,
  }))

  return (
    <MembershipsClient
      stats={stats}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      giftCards={giftCards as any}
      clients={clients.map((c) => ({ id: c.id, name: c.name }))}
      members={members}
    />
  )
}

function mapMembershipStatus(dbStatus: string): "active" | "paused" | "cancelled" | "past_due" {
  const map: Record<string, "active" | "paused" | "cancelled" | "past_due"> = {
    active_membership: "active",
    paused_membership: "paused",
    cancelled_membership: "cancelled",
    past_due_membership: "past_due",
  }
  return map[dbStatus] ?? "active"
}
