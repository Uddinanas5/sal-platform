import { prisma } from "@/lib/prisma"

export async function getCampaigns(businessId?: string) {
  if (!businessId) throw new Error("businessId is required — refusing to query across all tenants")
  const where = businessId ? { businessId } : {}

  const campaigns = await prisma.campaign.findMany({
    where,
    orderBy: { createdAt: "desc" },
  })

  return campaigns.map((c) => ({
    id: c.id,
    name: c.name,
    subject: c.subject || "",
    body: c.body,
    channel: c.channel,
    status: c.status,
    audienceType: c.audienceType,
    scheduledAt: c.scheduledAt,
    sentAt: c.sentAt,
    recipientCount: c.recipientCount,
    openCount: c.openCount,
    clickCount: c.clickCount,
    bookingCount: c.bookingCount,
    revenue: Number(c.revenue),
    createdAt: c.createdAt,
  }))
}

export async function getCampaignStats(businessId?: string) {
  if (!businessId) throw new Error("businessId is required — refusing to query across all tenants")
  const where = businessId ? { businessId } : {}

  const [total, active, sent] = await Promise.all([
    prisma.campaign.count({ where }),
    prisma.campaign.count({ where: { ...where, status: { in: ["draft", "scheduled"] } } }),
    prisma.campaign.count({ where: { ...where, status: "sent" } }),
  ])

  const sentCampaigns = await prisma.campaign.findMany({
    where: { ...where, status: "sent" },
    select: { recipientCount: true, openCount: true },
  })

  const totalRecipients = sentCampaigns.reduce((sum, c) => sum + c.recipientCount, 0)
  const totalOpens = sentCampaigns.reduce((sum, c) => sum + c.openCount, 0)
  const openRate = totalRecipients > 0 ? Math.round((totalOpens / totalRecipients) * 100) : 0

  return { total, active, sent, openRate }
}

export async function getAutomatedMessages(businessId?: string) {
  if (!businessId) throw new Error("businessId is required — refusing to query across all tenants")
  const where = businessId ? { businessId } : {}

  const messages = await prisma.automatedMessage.findMany({
    where,
    orderBy: { createdAt: "desc" },
  })

  return messages.map((m) => ({
    id: m.id,
    name: m.name,
    trigger: m.trigger,
    channel: m.channel,
    subject: m.subject || "",
    body: m.body,
    delayHours: m.delayHours,
    isActive: m.isActive,
    sendCount: m.sendCount,
    createdAt: m.createdAt,
  }))
}
