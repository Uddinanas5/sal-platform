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
}).superRefine((data, ctx) => {
  // A reversed/equal range on an OPEN day would make it silently unbookable.
  // Times are zero-padded "HH:MM", so a string compare is a valid time compare.
  const dayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
  for (const h of data.hours) {
    if (!h.isClosed && h.openTime >= h.closeTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${dayName[h.dayOfWeek] ?? `Day ${h.dayOfWeek}`}: closing time must be after opening time`,
      })
    }
  }
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

    // Update business + primary location atomically so a mid-write failure can't
    // leave the business name/timezone committed while the location lags behind.
    const primaryLocation = business.locations[0]
    await prisma.$transaction(async (tx) => {
      await tx.business.update({
        where: { id: parsed.businessId },
        data: {
          name: parsed.name.trim(),
          phone: parsed.phone.trim(),
          timezone: parsed.timezone,
        },
      })

      if (primaryLocation) {
        await tx.location.update({
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
    })

    return { success: true, data: undefined }
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    }
    console.error("updateBusinessDetails error:", e)
    return { success: false, error: "Couldn't save your business details. Please try again." }
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

    // (transactional delete+recreate below so a mid-write failure can't leave
    // the location with zero hours rows)

    // Convert "HH:MM" to a Date representing just the time. The adapter
    // serializes @db.Time with getUTCHours, so build in UTC — a local
    // new Date(1970,0,1,h,m) would store a shifted wall-clock on a non-UTC host.
    // Mirrors timeStringToUtcDate in src/lib/scheduling/zoned-time.ts.
    const timeStringToDate = (timeStr: string): Date => {
      const [hours, minutes] = timeStr.split(":").map(Number)
      return new Date(Date.UTC(1970, 0, 1, hours, minutes, 0, 0))
    }

    // Build a map of provided days so we can fill in any missing ones
    const providedMap = new Map(parsed.hours.map((h) => [h.dayOfWeek, h]))

    // Ensure all 7 days (0 = Sunday … 6 = Saturday) always have an entry.
    // Any day not supplied by the caller is treated as closed so there are
    // never "holes" that could be misinterpreted by clients.
    const allDays = Array.from({ length: 7 }, (_, i) => {
      const provided = providedMap.get(i)
      if (provided) return provided
      return { dayOfWeek: i, isClosed: true, openTime: "09:00", closeTime: "17:00" }
    })

    // Delete + recreate in ONE transaction so a failure can't leave the location
    // with no hours rows at all.
    await prisma.$transaction([
      prisma.businessHours.deleteMany({ where: { locationId } }),
      prisma.businessHours.createMany({
        data: allDays.map((h) => ({
          locationId,
          dayOfWeek: h.dayOfWeek,
          isClosed: h.isClosed,
          openTime: h.isClosed ? null : timeStringToDate(h.openTime),
          closeTime: h.isClosed ? null : timeStringToDate(h.closeTime),
        })),
      }),
    ])

    return { success: true, data: undefined }
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    }
    console.error("saveWorkingHours error:", e)
    return { success: false, error: "Couldn't save your working hours. Please try again." }
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

    // Create all services. skipDuplicates makes this both dup-safe (Service has
    // @@unique([businessId,name]), so two same-named entries or a name that
    // already exists won't throw a raw constraint error) and idempotent — if a
    // prior Finish attempt committed the services but the completeOnboarding step
    // failed, re-clicking Finish re-runs this without erroring.
    const serviceColors = ["#059669", "#f97316", "#ec4899", "#8b5cf6", "#06b6d4", "#f59e0b"]

    // De-dupe within the batch by trimmed name (first occurrence wins) so the
    // sortOrder/color indices stay stable.
    const seen = new Set<string>()
    const uniqueServices = parsed.services.filter((s) => {
      const key = s.name.trim().toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    await prisma.service.createMany({
      data: uniqueServices.map((s, i) => ({
        businessId: parsed.businessId,
        categoryId: category!.id,
        name: s.name.trim(),
        durationMinutes: s.durationMinutes,
        price: s.price,
        color: serviceColors[i % serviceColors.length],
        isActive: true,
        sortOrder: i,
      })),
      skipDuplicates: true,
    })

    return { success: true, data: undefined }
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    }
    console.error("addOnboardingServices error:", e)
    return { success: false, error: "Couldn't add your services. Please try again." }
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
    return { success: false, error: "Couldn't finish setup. Please try again." }
  }
}
