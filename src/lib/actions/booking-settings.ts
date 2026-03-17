"use server"

import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { getBusinessContext } from "@/lib/auth-utils"
import { revalidatePath } from "next/cache"

const bookingSettingsSchema = z.object({
  minLeadTime: z.enum(["none", "1h", "2h", "4h", "12h", "24h", "48h"]).default("none"),
  maxAdvanceBooking: z.enum(["1w", "2w", "1m", "2m", "3m"]).default("1m"),
  cancellationWindow: z.enum(["none", "1h", "2h", "4h", "12h", "24h", "48h"]).default("24h"),
  autoConfirm: z.boolean().default(true),
  allowDoubleBooking: z.boolean().default(false),
  requireDeposit: z.boolean().default(false),
  depositType: z.enum(["percentage", "fixed"]).default("percentage"),
  depositAmount: z.number().min(0).default(0),
  depositApplyOverAmount: z.number().min(0).default(0),
  requiredFields: z
    .object({
      phone: z.boolean().default(true),
      email: z.boolean().default(true),
      address: z.boolean().default(false),
      notes: z.boolean().default(false),
    })
    .default({ phone: true, email: true, address: false, notes: false }),
  customQuestions: z.array(z.string()).default([]),
})

export type BookingSettings = z.infer<typeof bookingSettingsSchema>

export async function updateBookingSettings(
  data: BookingSettings
): Promise<{ success: true; data: BookingSettings } | { success: false; error: string }> {
  try {
    const { businessId } = await getBusinessContext()
    const validated = bookingSettingsSchema.parse(data)

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { settings: true },
    })
    const existingSettings = (business?.settings as Record<string, unknown>) ?? {}

    await prisma.business.update({
      where: { id: businessId },
      data: {
        settings: { ...existingSettings, booking: validated },
      },
    })

    revalidatePath("/settings")
    return { success: true as const, data: validated }
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Failed to save booking settings",
    }
  }
}

export async function getBookingSettings(businessId: string): Promise<BookingSettings> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { settings: true },
  })
  const rawSettings = (business?.settings as Record<string, unknown>)?.booking
  return bookingSettingsSchema.parse(rawSettings ?? {})
}

export async function getPublicBookingSettings(businessId: string): Promise<BookingSettings> {
  return getBookingSettings(businessId)
}
