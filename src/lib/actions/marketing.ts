"use server"

import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { requireMinRole } from "@/lib/auth-utils"
import { sendEmail } from "@/lib/email"

const channelEnum = z.enum(["email", "sms", "both"])

const createCampaignSchema = z.object({
  name: z.string().min(1),
  subject: z.string().optional(),
  body: z.string().min(1),
  channel: channelEnum,
  audienceType: z.string().optional(),
  scheduledAt: z.coerce.date().optional(),
})

const updateCampaignSchema = z.object({
  id: z.string().uuid(),
  data: z.object({
    name: z.string().min(1).optional(),
    subject: z.string().optional(),
    body: z.string().min(1).optional(),
    channel: channelEnum.optional(),
    audienceType: z.string().optional(),
    scheduledAt: z.coerce.date().nullable().optional(),
  }),
})

const idSchema = z.object({ id: z.string().uuid() })

const createDealSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  discountType: z.enum(["percentage", "fixed", "free_service"]),
  discountValue: z.number().nonnegative(),
  code: z.string().optional(),
  validFrom: z.coerce.date(),
  validUntil: z.coerce.date(),
  appliesTo: z.enum(["all", "services", "products", "specific"]).optional(),
  serviceIds: z.array(z.string().uuid()).optional(),
  usageLimit: z.number().int().nonnegative().optional(),
})

const createAutomatedMessageSchema = z.object({
  name: z.string().min(1),
  trigger: z.string().min(1),
  channel: channelEnum,
  subject: z.string().optional(),
  body: z.string().min(1),
  delayHours: z.number().int().nonnegative().optional(),
})

const toggleAutomatedMessageSchema = z.object({
  id: z.string().uuid(),
  isActive: z.boolean(),
})

export async function createCampaign(data: {
  name: string
  subject?: string
  body: string
  channel: "email" | "sms" | "both"
  audienceType?: string
  scheduledAt?: Date
}) {
  try {
    const parsed = createCampaignSchema.parse(data)

    const { businessId } = await requireMinRole("admin")

    const campaign = await prisma.campaign.create({
      data: {
        businessId,
        name: parsed.name,
        subject: parsed.subject,
        body: parsed.body,
        channel: parsed.channel,
        audienceType: parsed.audienceType || "all",
        scheduledAt: parsed.scheduledAt,
        status: parsed.scheduledAt ? "scheduled" : "draft",
      },
    })
    revalidatePath("/marketing")
    return campaign
  } catch (e) {
    if (e instanceof z.ZodError) return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    throw e
  }
}

export async function updateCampaign(
  id: string,
  data: {
    name?: string
    subject?: string
    body?: string
    channel?: "email" | "sms" | "both"
    audienceType?: string
    scheduledAt?: Date | null
  }
) {
  try {
    const parsed = updateCampaignSchema.parse({ id, data })

    const { businessId } = await requireMinRole("admin")

    const campaign = await prisma.campaign.update({
      where: { id: parsed.id, businessId },
      data: {
        ...(parsed.data.name && { name: parsed.data.name }),
        ...(parsed.data.subject !== undefined && { subject: parsed.data.subject }),
        ...(parsed.data.body && { body: parsed.data.body }),
        ...(parsed.data.channel && { channel: parsed.data.channel }),
        ...(parsed.data.audienceType && { audienceType: parsed.data.audienceType }),
        ...(parsed.data.scheduledAt !== undefined && { scheduledAt: parsed.data.scheduledAt }),
      },
    })
    revalidatePath("/marketing")
    return campaign
  } catch (e) {
    if (e instanceof z.ZodError) return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    throw e
  }
}

export async function deleteCampaign(id: string) {
  try {
    const parsed = idSchema.parse({ id })

    const { businessId } = await requireMinRole("admin")

    await prisma.campaign.delete({ where: { id: parsed.id, businessId } })
    revalidatePath("/marketing")
  } catch (e) {
    if (e instanceof z.ZodError) return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    throw e
  }
}

export async function sendCampaign(id: string) {
  try {
    const parsed = idSchema.parse({ id })

    const { businessId } = await requireMinRole("admin")

    const campaign = await prisma.campaign.findUnique({
      where: { id: parsed.id, businessId },
    })

    if (!campaign) return { success: false, error: "Campaign not found" }
    if (campaign.status === "sent") return { success: false, error: "Campaign already sent" }

    // Build audience based on audienceType
    const clients = await prisma.client.findMany({
      where: {
        businessId,
        email: { not: null },
        ...(campaign.audienceType === "vip" ? { tags: { has: "VIP" } } : {}),
        ...(campaign.audienceType === "new" ? { totalVisits: { lte: 2 } } : {}),
        ...(campaign.audienceType === "inactive" ? {
          lastVisitAt: { lt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) },
        } : {}),
      },
      select: { email: true, firstName: true },
    })

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { name: true },
    })

    let sentCount = 0
    for (const client of clients) {
      if (!client.email) continue

      const personalizedBody = campaign.body
        .replace(/\{\{firstName\}\}/g, client.firstName || "there")
        .replace(/\{\{businessName\}\}/g, business?.name || "our salon")

      try {
        await sendEmail({
          to: client.email,
          subject: campaign.subject || campaign.name,
          html: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #059669;">${business?.name || "SAL"}</h2>
            <div style="line-height: 1.6;">${personalizedBody.replace(/\n/g, "<br>")}</div>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
            <p style="color: #9ca3af; font-size: 12px;">You received this because you're a client of ${business?.name || "our salon"}.</p>
          </div>`,
        })
        sentCount++
      } catch {
        // Continue sending to remaining recipients
      }
    }

    const updated = await prisma.campaign.update({
      where: { id: parsed.id, businessId },
      data: {
        status: "sent",
        sentAt: new Date(),
        recipientCount: sentCount,
      },
    })

    revalidatePath("/marketing")
    return updated
  } catch (e) {
    if (e instanceof z.ZodError) return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    throw e
  }
}

export async function createDeal(data: {
  name: string
  description?: string
  discountType: "percentage" | "fixed" | "free_service"
  discountValue: number
  code?: string
  validFrom: Date
  validUntil: Date
  appliesTo?: "all" | "services" | "products" | "specific"
  serviceIds?: string[]
  usageLimit?: number
}) {
  try {
    const parsed = createDealSchema.parse(data)

    const { businessId } = await requireMinRole("admin")

    const deal = await prisma.deal.create({
      data: {
        businessId,
        name: parsed.name,
        description: parsed.description,
        discountType: parsed.discountType,
        discountValue: parsed.discountValue,
        code: parsed.code,
        validFrom: parsed.validFrom,
        validUntil: parsed.validUntil,
        appliesTo: parsed.appliesTo || "all",
        serviceIds: parsed.serviceIds || [],
        usageLimit: parsed.usageLimit,
      },
    })
    revalidatePath("/marketing")
    return deal
  } catch (e) {
    if (e instanceof z.ZodError) return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    throw e
  }
}

export async function toggleDeal(id: string, isActive: boolean) {
  try {
    idSchema.parse({ id })
    const { businessId } = await requireMinRole("admin")

    await prisma.deal.update({
      where: { id, businessId },
      data: { status: isActive ? "active_deal" : "paused_deal" },
    })
    revalidatePath("/marketing")
    return { success: true }
  } catch (e) {
    if (e instanceof z.ZodError) return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    return { success: false, error: (e as Error).message }
  }
}

export async function deleteDeal(id: string) {
  try {
    const parsed = idSchema.parse({ id })

    const { businessId } = await requireMinRole("admin")

    await prisma.deal.delete({ where: { id: parsed.id, businessId } })
    revalidatePath("/marketing")
  } catch (e) {
    if (e instanceof z.ZodError) return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    throw e
  }
}

export async function createAutomatedMessage(data: {
  name: string
  trigger: string
  channel: "email" | "sms" | "both"
  subject?: string
  body: string
  delayHours?: number
}) {
  try {
    const parsed = createAutomatedMessageSchema.parse(data)

    const { businessId } = await requireMinRole("admin")

    const msg = await prisma.automatedMessage.create({
      data: {
        businessId,
        name: parsed.name,
        trigger: parsed.trigger as "booking_confirmation" | "appointment_reminder" | "thank_you" | "no_show_followup" | "birthday" | "rebooking_reminder" | "win_back" | "welcome" | "review_request",
        channel: parsed.channel,
        subject: parsed.subject,
        body: parsed.body,
        delayHours: parsed.delayHours || 0,
      },
    })
    revalidatePath("/marketing")
    return msg
  } catch (e) {
    if (e instanceof z.ZodError) return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    throw e
  }
}

export async function toggleAutomatedMessage(id: string, isActive: boolean) {
  try {
    const parsed = toggleAutomatedMessageSchema.parse({ id, isActive })

    const { businessId } = await requireMinRole("admin")

    await prisma.automatedMessage.update({
      where: { id: parsed.id, businessId },
      data: { isActive: parsed.isActive },
    })
    revalidatePath("/marketing")
  } catch (e) {
    if (e instanceof z.ZodError) return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    throw e
  }
}

export async function updateAutomatedMessage(
  id: string,
  data: { subject?: string; body?: string }
) {
  try {
    idSchema.parse({ id })
    const { businessId } = await requireMinRole("admin")

    await prisma.automatedMessage.update({
      where: { id, businessId },
      data: {
        ...(data.subject !== undefined && { subject: data.subject }),
        ...(data.body && { body: data.body }),
      },
    })
    revalidatePath("/marketing")
    return { success: true }
  } catch (e) {
    if (e instanceof z.ZodError) return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    return { success: false, error: (e as Error).message }
  }
}

export async function deleteAutomatedMessage(id: string) {
  try {
    const parsed = idSchema.parse({ id })

    const { businessId } = await requireMinRole("admin")

    await prisma.automatedMessage.delete({ where: { id: parsed.id, businessId } })
    revalidatePath("/marketing")
  } catch (e) {
    if (e instanceof z.ZodError) return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    throw e
  }
}
