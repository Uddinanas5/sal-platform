"use server"

import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getBusinessContext } from "@/lib/auth-utils"

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

    const { businessId } = await getBusinessContext()

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

    const { businessId } = await getBusinessContext()

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

    const { businessId } = await getBusinessContext()

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

    const { businessId } = await getBusinessContext()

    const campaign = await prisma.campaign.update({
      where: { id: parsed.id, businessId },
      data: {
        status: "sent",
        sentAt: new Date(),
      },
    })
    revalidatePath("/marketing")
    return campaign
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

    const { businessId } = await getBusinessContext()

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

    const { businessId } = await getBusinessContext()

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

    const { businessId } = await getBusinessContext()

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

    const { businessId } = await getBusinessContext()

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

    const { businessId } = await getBusinessContext()

    await prisma.automatedMessage.delete({ where: { id: parsed.id, businessId } })
    revalidatePath("/marketing")
  } catch (e) {
    if (e instanceof z.ZodError) return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    throw e
  }
}
