"use server"

import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { revalidatePath } from "next/cache"

type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string }

const updateBusinessDetailsSchema = z.object({
  businessId: z.string().uuid(),
  name: z.string().min(1, "Business name is required"),
  phone: z.string().min(1, "Phone is required"),
  timezone: z.string().min(1, "Timezone is required"),
  addressLine1: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  postalCode: z.string().min(1, "Postal code is required"),
  country: z.string().min(1, "Country is required"),
})

const saveWorkingHoursSchema = z.object({
  businessId: z.string().uuid(),
  hours: z.array(z.object({
    dayOfWeek: z.number().int().min(0).max(6),
    isClosed: z.boolean(),
    openTime: z.string(),
    closeTime: z.string(),
  })),
})

const addOnboardingServicesSchema = z.object({
  businessId: z.string().uuid(),
  services: z.array(z.object({
    name: z.string().min(1, "Service name is required"),
    durationMinutes: z.number().int().positive(),
    price: z.number().min(0),
  })).min(1, "At least one service is required"),
})

const completeOnboardingSchema = z.object({
  businessId: z.string().uuid(),
})

// ---------------------------------------------------------------------------
// Step 1 - Update business details + location address
// ---------------------------------------------------------------------------

export async function updateBusinessDetails(data: {
  businessId: string
  name: string
  phone: string
  timezone: string
  addressLine1: string
  city: string
  state: string
  postalCode: string
  country: string
}): Promise<ActionResult> {
  try {
    const parsed = updateBusinessDetailsSchema.parse(data)
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: "Not authenticated" }

    // Verify ownership
    const business = await prisma.business.findFirst({
      where: { id: parsed.businessId, ownerId: session.user.id },
      include: { locations: { where: { isPrimary: true } } },
    })
    if (!business) return { success: false, error: "Business not found" }

    // Update business
    await prisma.business.update({
      where: { id: parsed.businessId },
      data: {
        name: parsed.name.trim(),
        phone: parsed.phone.trim(),
        timezone: parsed.timezone,
      },
    })

    // Update primary location
    const primaryLocation = business.locations[0]
    if (primaryLocation) {
      await prisma.location.update({
        where: { id: primaryLocation.id },
        data: {
          name: parsed.name.trim(),
          addressLine1: parsed.addressLine1.trim(),
          city: parsed.city.trim(),
          state: parsed.state.trim(),
          postalCode: parsed.postalCode.trim(),
          country: parsed.country,
        },
      })
    }

    return { success: true, data: undefined }
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    }
    console.error("updateBusinessDetails error:", e)
    return { success: false, error: (e as Error).message }
  }
}

// ---------------------------------------------------------------------------
// Step 2 - Save working hours
// ---------------------------------------------------------------------------

export async function saveWorkingHours(data: {
  businessId: string
  hours: Array<{
    dayOfWeek: number
    isClosed: boolean
    openTime: string // "HH:MM" 24h format
    closeTime: string // "HH:MM" 24h format
  }>
}): Promise<ActionResult> {
  try {
    const parsed = saveWorkingHoursSchema.parse(data)
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: "Not authenticated" }

    const business = await prisma.business.findFirst({
      where: { id: parsed.businessId, ownerId: session.user.id },
      include: { locations: { where: { isPrimary: true } } },
    })
    if (!business) return { success: false, error: "Business not found" }

    const locationId = business.locations[0]?.id
    if (!locationId) return { success: false, error: "No primary location found" }

    // Delete any existing hours for this location, then recreate
    await prisma.businessHours.deleteMany({
      where: { locationId },
    })

    // Convert "HH:MM" to a Date representing just the time
    const timeStringToDate = (timeStr: string): Date => {
      const [hours, minutes] = timeStr.split(":").map(Number)
      // Prisma Time columns accept a Date; only the time portion matters
      return new Date(1970, 0, 1, hours, minutes, 0, 0)
    }

    // Create hours for each day
    await prisma.businessHours.createMany({
      data: parsed.hours.map((h) => ({
        locationId,
        dayOfWeek: h.dayOfWeek,
        isClosed: h.isClosed,
        openTime: h.isClosed ? null : timeStringToDate(h.openTime),
        closeTime: h.isClosed ? null : timeStringToDate(h.closeTime),
      })),
    })

    return { success: true, data: undefined }
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    }
    console.error("saveWorkingHours error:", e)
    return { success: false, error: (e as Error).message }
  }
}

// ---------------------------------------------------------------------------
// Step 3 - Add services during onboarding
// ---------------------------------------------------------------------------

export async function addOnboardingServices(data: {
  businessId: string
  services: Array<{
    name: string
    durationMinutes: number
    price: number
  }>
}): Promise<ActionResult> {
  try {
    const parsed = addOnboardingServicesSchema.parse(data)
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: "Not authenticated" }

    const business = await prisma.business.findFirst({
      where: { id: parsed.businessId, ownerId: session.user.id },
    })
    if (!business) return { success: false, error: "Business not found" }

    // Create a "General" category if one doesn't exist
    let category = await prisma.serviceCategory.findFirst({
      where: { businessId: parsed.businessId, name: "General" },
    })

    if (!category) {
      category = await prisma.serviceCategory.create({
        data: {
          businessId: parsed.businessId,
          name: "General",
          color: "#059669",
          sortOrder: 0,
          isActive: true,
        },
      })
    }

    // Create all services
    const serviceColors = ["#059669", "#f97316", "#ec4899", "#8b5cf6", "#06b6d4", "#f59e0b"]

    await prisma.service.createMany({
      data: parsed.services.map((s, i) => ({
        businessId: parsed.businessId,
        categoryId: category!.id,
        name: s.name.trim(),
        durationMinutes: s.durationMinutes,
        price: s.price,
        color: serviceColors[i % serviceColors.length],
        isActive: true,
        sortOrder: i,
      })),
    })

    return { success: true, data: undefined }
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    }
    console.error("addOnboardingServices error:", e)
    return { success: false, error: (e as Error).message }
  }
}

// ---------------------------------------------------------------------------
// Step 4 - Mark onboarding complete
// ---------------------------------------------------------------------------

export async function completeOnboarding(data: {
  businessId: string
}): Promise<ActionResult> {
  try {
    const parsed = completeOnboardingSchema.parse(data)
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: "Not authenticated" }

    const business = await prisma.business.findFirst({
      where: { id: parsed.businessId, ownerId: session.user.id },
    })
    if (!business) return { success: false, error: "Business not found" }

    // Mark business as set up by updating settings with onboarding flag
    await prisma.business.update({
      where: { id: parsed.businessId },
      data: {
        settings: {
          ...(typeof business.settings === "object" && business.settings !== null
            ? (business.settings as Record<string, unknown>)
            : {}),
          isOnboarded: true,
        },
      },
    })

    revalidatePath("/dashboard")
    return { success: true, data: undefined }
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    }
    console.error("completeOnboarding error:", e)
    return { success: false, error: (e as Error).message }
  }
}
