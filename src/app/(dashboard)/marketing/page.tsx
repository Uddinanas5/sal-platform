import { auth } from "@/lib/auth"
import { getCampaigns, getCampaignStats, getDeals, getAutomatedMessages } from "@/lib/queries/marketing"
import { MarketingClient } from "./client"
import type { CampaignStats } from "./client"

export const dynamic = "force-dynamic"

export default async function MarketingPage() {
  const session = await auth()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const businessId = (session?.user as any)?.businessId as string | undefined

  const [campaigns, deals, automatedMessages] = await Promise.all([
    getCampaigns(businessId),
    getDeals(businessId),
    getAutomatedMessages(businessId),
  ])

  let campaignStats: CampaignStats
  try {
    campaignStats = await getCampaignStats(businessId)
  } catch {
    campaignStats = {
      total: campaigns.length,
      active: campaigns.filter((c) => c.status === "draft" || c.status === "scheduled").length,
      sent: campaigns.filter((c) => c.status === "sent").length,
      openRate: 0,
    }
  }

  return (
    <MarketingClient
      campaigns={campaigns}
      deals={deals}
      automatedMessages={automatedMessages}
      campaignStats={campaignStats}
    />
  )
}
