"use server"

import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { requireMinRole, getBusinessContext } from "@/lib/auth-utils"

type ActionResult<T = void> = { success: true; data: T } | { success: false; error: string }

const updateBusinessSettingsSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  timezone: z.string().optional(),
  currency: z.string().optional(),
})

export async function updateBusinessSettings(data: {
  name?: string
  phone?: string
  email?: string
  address?: string
  city?: string
  state?: string
  zipCode?: string
  timezone?: string
  currency?: string
}): Promise<ActionResult> {
  try {
    const parsed = updateBusinessSettingsSchema.parse(data)
    const { businessId } = await requireMinRole("admin")

    // Update business-level fields
    await prisma.business.update({
      where: { id: businessId },
      data: {
        name: parsed.name,
        phone: parsed.phone,
        email: parsed.email,
        timezone: parsed.timezone,
        currency: parsed.currency,
      },
    })

    // Update location-level address fields
    if (parsed.address || parsed.city || parsed.state || parsed.zipCode) {
      const location = await prisma.location.findFirst({
        where: { businessId },
      })
      if (location) {
        await prisma.location.update({
          where: { id: location.id },
          data: {
            addressLine1: parsed.address,
            city: parsed.city,
            state: parsed.state,
            postalCode: parsed.zipCode,
          },
        })
      }
    }

    revalidatePath("/settings")
    revalidatePath("/dashboard")
    return { success: true, data: undefined }
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    }
    const msg = (e as Error).message
    if (msg === "Not authenticated" || msg === "No business context") {
      return { success: false, error: msg }
    }
    console.error("updateBusinessSettings error:", e)
    return { success: false, error: msg }
  }
}

// ── Online Presence Settings ──────────────────────────────────────────────────

const onlinePresenceSettingsSchema = z.object({
  buttonColor: z.string().default("#059669"),
  buttonText: z.string().default("Book Now"),
  widgetSize: z.enum(["small", "medium", "large"]).default("medium"),
  socialLinks: z
    .object({
      instagram: z.string().default(""),
      facebook: z.string().default(""),
      tiktok: z.string().default(""),
      website: z.string().default(""),
    })
    .default({ instagram: "", facebook: "", tiktok: "", website: "" }),
})

export type OnlinePresenceSettings = z.infer<typeof onlinePresenceSettingsSchema>

export async function updateOnlinePresenceSettings(
  data: OnlinePresenceSettings
): Promise<{ success: true; data: OnlinePresenceSettings } | { success: false; error: string }> {
  try {
    const { businessId } = await getBusinessContext()
    const validated = onlinePresenceSettingsSchema.parse(data)

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { settings: true },
    })
    const existingSettings = (business?.settings as Record<string, unknown>) ?? {}

    await prisma.business.update({
      where: { id: businessId },
      data: {
        settings: { ...existingSettings, onlinePresence: validated },
      },
    })

    revalidatePath("/settings")
    return { success: true as const, data: validated }
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Failed to save online presence settings",
    }
  }
}

export async function getOnlinePresenceSettings(businessId: string): Promise<OnlinePresenceSettings> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { settings: true },
  })
  const rawSettings = (business?.settings as Record<string, unknown>)?.onlinePresence
  return onlinePresenceSettingsSchema.parse(rawSettings ?? {})
}

// ── Notification Settings ─────────────────────────────────────────────────────

const emailTemplatesSchema = z.object({
  bookingConfirmation: z
    .string()
    .default(
      "Hi {client_name},\n\nYour appointment has been confirmed!\n\nService: {service_name}\nDate: {date}\nTime: {time}\nStylist: {staff_name}\n\nWe look forward to seeing you at {salon_name}.\n\nBest regards,\n{salon_name} Team"
    ),
  appointmentReminder: z
    .string()
    .default(
      "Hi {client_name},\n\nThis is a friendly reminder about your upcoming appointment.\n\nService: {service_name}\nDate: {date}\nTime: {time}\nStylist: {staff_name}\n\nIf you need to reschedule, please contact us as soon as possible.\n\nSee you soon!\n{salon_name}"
    ),
  cancellationNotice: z
    .string()
    .default(
      "Hi {client_name},\n\nYour appointment has been cancelled.\n\nService: {service_name}\nDate: {date}\nTime: {time}\n\nIf this was a mistake or you'd like to rebook, please visit our booking page or give us a call.\n\n{salon_name} Team"
    ),
  followUp: z
    .string()
    .default(
      "Hi {client_name},\n\nThank you for visiting {salon_name}! We hope you loved your {service_name}.\n\nWe'd really appreciate it if you could take a moment to leave us a review. Your feedback helps us improve!\n\nSee you next time!\n{salon_name} Team"
    ),
})

const smsTemplatesSchema = z.object({
  bookingConfirmation: z
    .string()
    .default(
      "Hi {client_name}! Your {service_name} appointment is confirmed for {date} at {time} with {staff_name}. See you at {salon_name}!"
    ),
  appointmentReminder: z
    .string()
    .default(
      "Reminder: {client_name}, you have a {service_name} appointment tomorrow at {time} with {staff_name} at {salon_name}. Reply C to cancel."
    ),
  cancellationNotice: z
    .string()
    .default(
      "Hi {client_name}, your {service_name} appointment on {date} at {time} has been cancelled. Visit us to rebook! - {salon_name}"
    ),
  followUp: z
    .string()
    .default(
      "Hi {client_name}! Thanks for visiting {salon_name}. How was your {service_name}? We'd love your feedback! Reply to rate 1-5."
    ),
})

const internalAlertsSchema = z.object({
  newBooking: z.boolean().default(true),
  cancellation: z.boolean().default(true),
  lowInventory: z.boolean().default(false),
  dailySummary: z.boolean().default(true),
})

const notificationSettingsSchema = z.object({
  emailTemplates: emailTemplatesSchema.default(() => emailTemplatesSchema.parse({})),
  smsTemplates: smsTemplatesSchema.default(() => smsTemplatesSchema.parse({})),
  internalAlerts: internalAlertsSchema.default(() => internalAlertsSchema.parse({})),
})

export type NotificationSettings = z.infer<typeof notificationSettingsSchema>

export async function updateNotificationSettings(
  data: NotificationSettings
): Promise<{ success: true; data: NotificationSettings } | { success: false; error: string }> {
  try {
    const { businessId } = await getBusinessContext()
    const validated = notificationSettingsSchema.parse(data)

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { settings: true },
    })
    const existingSettings = (business?.settings as Record<string, unknown>) ?? {}

    await prisma.business.update({
      where: { id: businessId },
      data: {
        settings: { ...existingSettings, notifications: validated },
      },
    })

    revalidatePath("/settings")
    return { success: true as const, data: validated }
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Failed to save notification settings",
    }
  }
}

export async function getNotificationSettings(businessId: string): Promise<NotificationSettings> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { settings: true },
  })
  const rawSettings = (business?.settings as Record<string, unknown>)?.notifications
  return notificationSettingsSchema.parse(rawSettings ?? {})
}

// ── Payment Settings ──────────────────────────────────────────────────────────

const paymentSettingsSchema = z.object({
  paymentMethods: z
    .object({
      cash: z.boolean().default(true),
      card: z.boolean().default(true),
      giftCards: z.boolean().default(false),
      splitPayment: z.boolean().default(false),
    })
    .default({ cash: true, card: true, giftCards: false, splitPayment: false }),
  taxRate: z.string().default("8.875"),
  taxName: z.string().default("Sales Tax"),
  taxOnProducts: z.boolean().default(true),
  taxOnServices: z.boolean().default(true),
  enableTipping: z.boolean().default(true),
  tipAmounts: z.array(z.string()).default(["15", "18", "20"]),
  customTip: z.boolean().default(true),
  autoSendReceipt: z.boolean().default(true),
  receiptChannel: z.enum(["email", "sms", "both"]).default("email"),
  receiptFooter: z
    .string()
    .default(
      "Thank you for choosing SAL Beauty Studio! We look forward to seeing you again."
    ),
})

export type PaymentSettings = z.infer<typeof paymentSettingsSchema>

export async function updatePaymentSettings(
  data: PaymentSettings
): Promise<{ success: true; data: PaymentSettings } | { success: false; error: string }> {
  try {
    const { businessId } = await getBusinessContext()
    const validated = paymentSettingsSchema.parse(data)

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { settings: true },
    })
    const existingSettings = (business?.settings as Record<string, unknown>) ?? {}

    await prisma.business.update({
      where: { id: businessId },
      data: {
        settings: { ...existingSettings, payments: validated },
      },
    })

    revalidatePath("/settings")
    return { success: true as const, data: validated }
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Failed to save payment settings",
    }
  }
}

export async function getPaymentSettings(businessId: string): Promise<PaymentSettings> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { settings: true },
  })
  const rawSettings = (business?.settings as Record<string, unknown>)?.payments
  return paymentSettingsSchema.parse(rawSettings ?? {})
}
