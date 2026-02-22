import { auth } from "@/lib/auth"
import { getCampaigns, getCampaignStats, getDeals, getAutomatedMessages } from "@/lib/queries/marketing"
import { mockCampaigns, mockDeals, mockAutomatedMessages } from "@/data/mock-marketing"
import { MarketingClient } from "./client"
import type { CampaignItem, DealItem, MessageItem, CampaignStats } from "./client"

export const dynamic = "force-dynamic"

export default async function MarketingPage() {
  const session = await auth()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const businessId = (session?.user as any)?.businessId as string | undefined

  let campaigns: CampaignItem[]
  let deals: DealItem[]
  let automatedMessages: MessageItem[]
  let campaignStats: CampaignStats

  try {
    campaigns = await getCampaigns(businessId)
  } catch {
    campaigns = mockCampaigns.map((c) => ({
      id: c.id,
      name: c.name,
      subject: c.subject || "",
      body: c.content,
      channel: c.type,
      status: c.status === "active" ? "sent" : c.status === "completed" ? "sent" : c.status,
      audienceType: c.audience,
      scheduledAt: c.scheduledDate || null,
      sentAt: c.completedDate || null,
      recipientCount: c.audienceSize,
      openCount: Math.round(c.sentCount * c.openRate / 100),
      clickCount: Math.round(c.sentCount * c.clickRate / 100),
      bookingCount: 0,
      revenue: 0,
      createdAt: c.createdAt,
    }))
  }

  try {
    deals = await getDeals(businessId)
  } catch {
    deals = mockDeals.map((d) => ({
      id: d.id,
      name: d.name,
      description: d.description,
      discountType: d.type === "percentage" ? "percentage" : d.type === "fixed" ? "fixed_amount" : "percentage",
      discountValue: d.value,
      code: d.code || "",
      status: d.isActive ? "active" : "inactive",
      appliesTo: "all",
      serviceIds: d.serviceIds,
      usageLimit: d.usageLimit || null,
      usageCount: d.usageCount,
      validFrom: d.startDate,
      validUntil: d.endDate,
      createdAt: d.startDate,
    }))
  }

  try {
    automatedMessages = await getAutomatedMessages(businessId)
  } catch {
    automatedMessages = mockAutomatedMessages.map((m) => ({
      id: m.id,
      name: m.name,
      trigger: m.trigger,
      channel: m.channel,
      subject: m.subject || "",
      body: m.content,
      delayHours: 0,
      isActive: m.isActive,
      sendCount: 0,
      createdAt: new Date(),
    }))
  }

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
