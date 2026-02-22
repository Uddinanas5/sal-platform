"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getBusinessContext } from "@/lib/auth-utils"

export async function createCampaign(data: {
  name: string
  subject?: string
  body: string
  channel: "email" | "sms" | "both"
  audienceType?: string
  scheduledAt?: Date
}) {
  const { businessId } = await getBusinessContext()

  const campaign = await prisma.campaign.create({
    data: {
      businessId,
      name: data.name,
      subject: data.subject,
      body: data.body,
      channel: data.channel,
      audienceType: data.audienceType || "all",
      scheduledAt: data.scheduledAt,
      status: data.scheduledAt ? "scheduled" : "draft",
    },
  })
  revalidatePath("/marketing")
  return campaign
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
  const { businessId } = await getBusinessContext()

  const campaign = await prisma.campaign.update({
    where: { id, businessId },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.subject !== undefined && { subject: data.subject }),
      ...(data.body && { body: data.body }),
      ...(data.channel && { channel: data.channel }),
      ...(data.audienceType && { audienceType: data.audienceType }),
      ...(data.scheduledAt !== undefined && { scheduledAt: data.scheduledAt }),
    },
  })
  revalidatePath("/marketing")
  return campaign
}

export async function deleteCampaign(id: string) {
  const { businessId } = await getBusinessContext()

  await prisma.campaign.delete({ where: { id, businessId } })
  revalidatePath("/marketing")
}

export async function sendCampaign(id: string) {
  const { businessId } = await getBusinessContext()

  const campaign = await prisma.campaign.update({
    where: { id, businessId },
    data: {
      status: "sent",
      sentAt: new Date(),
    },
  })
  revalidatePath("/marketing")
  return campaign
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
  const { businessId } = await getBusinessContext()

  const deal = await prisma.deal.create({
    data: {
      businessId,
      name: data.name,
      description: data.description,
      discountType: data.discountType,
      discountValue: data.discountValue,
      code: data.code,
      validFrom: data.validFrom,
      validUntil: data.validUntil,
      appliesTo: data.appliesTo || "all",
      serviceIds: data.serviceIds || [],
      usageLimit: data.usageLimit,
    },
  })
  revalidatePath("/marketing")
  return deal
}

export async function deleteDeal(id: string) {
  const { businessId } = await getBusinessContext()

  await prisma.deal.delete({ where: { id, businessId } })
  revalidatePath("/marketing")
}

export async function createAutomatedMessage(data: {
  name: string
  trigger: string
  channel: "email" | "sms" | "both"
  subject?: string
  body: string
  delayHours?: number
}) {
  const { businessId } = await getBusinessContext()

  const msg = await prisma.automatedMessage.create({
    data: {
      businessId,
      name: data.name,
      trigger: data.trigger as "booking_confirmation" | "appointment_reminder" | "thank_you" | "no_show_followup" | "birthday" | "rebooking_reminder" | "win_back" | "welcome" | "review_request",
      channel: data.channel,
      subject: data.subject,
      body: data.body,
      delayHours: data.delayHours || 0,
    },
  })
  revalidatePath("/marketing")
  return msg
}

export async function toggleAutomatedMessage(id: string, isActive: boolean) {
  const { businessId } = await getBusinessContext()

  await prisma.automatedMessage.update({
    where: { id, businessId },
    data: { isActive },
  })
  revalidatePath("/marketing")
}

export async function deleteAutomatedMessage(id: string) {
  const { businessId } = await getBusinessContext()

  await prisma.automatedMessage.delete({ where: { id, businessId } })
  revalidatePath("/marketing")
}
