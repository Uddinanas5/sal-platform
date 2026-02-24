"use server"

import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { requireMinRole } from "@/lib/auth-utils"

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
