"use server"

import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { requireMinRole } from "@/lib/auth-utils"
import { sendEmail } from "@/lib/email"
import { marketingEmail } from "@/lib/email-templates"
import {
  resolveCampaignAudience,
  CAMPAIGN_RECIPIENT_CAP,
  CAMPAIGN_BATCH_SIZE,
} from "@/lib/marketing/audience"

const channelEnum = z.literal("email")

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

const updateAutomatedMessageSchema = z.object({
  id: z.string().uuid(),
  subject: z.string().optional(),
  body: z.string().min(1),
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

    const existing = await prisma.campaign.findFirst({
      where: { id: parsed.id, businessId },
      select: { channel: true, status: true },
    })
    if (!existing) return { success: false, error: "Campaign not found" }
    if (existing.channel !== "email") {
      return { success: false, error: "SMS messaging is not configured yet" }
    }
    // Editing is honest: a campaign that has already been sent (or is mid-send)
    // is immutable — its content/audience reflect what actually went out. Only
    // unsent campaigns (draft / scheduled) can be revised.
    if (existing.status === "sent" || existing.status === "sending") {
      return { success: false, error: "A sent campaign can no longer be edited" }
    }

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
    return { success: true, data: campaign }
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

/**
 * Actually send an email campaign.
 *  1. Reject non-email channels (SMS stays disabled for beta).
 *  2. Only "draft" / "scheduled" campaigns can be sent — never re-send a "sent"
 *     one (idempotent at the status level).
 *  3. Resolve the consented audience; refuse above the safety cap.
 *  4. Email in sequential batches with per-recipient try/catch so one bounce
 *     does not kill the run.
 *  5. Stamp status="sent", sentAt, recipientCount = actual successful sends.
 */
export async function sendCampaign(id: string) {
  try {
    const parsed = idSchema.parse({ id })

    const { businessId } = await requireMinRole("admin")

    const existing = await prisma.campaign.findFirst({
      where: { id: parsed.id, businessId },
      select: {
        channel: true,
        status: true,
        name: true,
        subject: true,
        body: true,
        audienceType: true,
      },
    })
    if (!existing) return { success: false, error: "Campaign not found" }
    if (existing.channel !== "email") {
      return { success: false, error: "SMS messaging is not configured yet" }
    }
    if (existing.status === "sent") {
      return { success: false, error: "This campaign has already been sent" }
    }
    if (existing.status === "sending") {
      return { success: false, error: "This campaign is already being sent" }
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { name: true },
    })

    const audience = await resolveCampaignAudience(businessId, existing.audienceType)
    const deliverable = audience.filter((c) => c.email)

    if (deliverable.length === 0) {
      return {
        success: false,
        error: "No consented recipients with an email address match this audience",
      }
    }
    if (deliverable.length > CAMPAIGN_RECIPIENT_CAP) {
      return {
        success: false,
        error: `This audience has ${deliverable.length} recipients, above the ${CAMPAIGN_RECIPIENT_CAP} per-send limit. Narrow the audience and try again.`,
      }
    }

    // Mark "sending" up front so a concurrent click sees it in flight.
    await prisma.campaign.update({
      where: { id: parsed.id, businessId },
      data: { status: "sending" },
    })

    const subject = existing.subject?.trim() || existing.name
    const html = marketingEmail({
      subject: existing.subject?.trim() || undefined,
      body: existing.body,
      businessName: business?.name,
    })

    let sent = 0
    for (let i = 0; i < deliverable.length; i += CAMPAIGN_BATCH_SIZE) {
      const batch = deliverable.slice(i, i + CAMPAIGN_BATCH_SIZE)
      for (const client of batch) {
        try {
          const res = await sendEmail({
            to: client.email as string,
            subject,
            html,
          })
          // sendEmail never throws; it returns {success:false} when the provider
          // rejects or is unconfigured. Count only genuine successes.
          if (res?.success) sent++
        } catch (e) {
          // Belt-and-suspenders: a single bad recipient must not abort the run.
          console.error("[sendCampaign] recipient failed", {
            campaignId: parsed.id,
            error: e,
          })
        }
      }
    }

    const campaign = await prisma.campaign.update({
      where: { id: parsed.id, businessId },
      data: {
        status: "sent",
        sentAt: new Date(),
        recipientCount: sent,
      },
    })
    revalidatePath("/marketing")
    return { success: true, data: campaign, sent }
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

export async function toggleDeal(id: string, isActive: boolean) {
  try {
    const parsed = idSchema.parse({ id })

    const { businessId } = await requireMinRole("admin")

    await prisma.deal.update({
      where: { id: parsed.id, businessId },
      data: { status: isActive ? "active_deal" : "paused_deal" },
    })
    revalidatePath("/marketing")
    return { success: true }
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

export async function updateAutomatedMessage(
  id: string,
  data: {
    subject?: string
    body: string
  }
) {
  try {
    const parsed = updateAutomatedMessageSchema.parse({ id, ...data })

    const { businessId } = await requireMinRole("admin")

    const msg = await prisma.automatedMessage.update({
      where: { id: parsed.id, businessId },
      data: {
        subject: parsed.subject,
        body: parsed.body,
      },
    })
    revalidatePath("/marketing")
    return { success: true, data: msg }
  } catch (e) {
    if (e instanceof z.ZodError) return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    throw e
  }
}

export async function toggleAutomatedMessage(id: string, isActive: boolean) {
  try {
    const parsed = toggleAutomatedMessageSchema.parse({ id, isActive })

    const { businessId } = await requireMinRole("admin")

    if (parsed.isActive) {
      const message = await prisma.automatedMessage.findFirst({
        where: { id: parsed.id, businessId },
        select: { channel: true },
      })
      if (!message) return { success: false, error: "Automated message not found" }
      if (message.channel !== "email") {
        return { success: false, error: "SMS messaging is not configured yet" }
      }
    }

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
