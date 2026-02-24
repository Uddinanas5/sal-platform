"use server"

import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getBusinessContext, requireMinRole } from "@/lib/auth-utils"

type ActionResult<T = void> = { success: true; data: T } | { success: false; error: string }

const updateStaffScheduleSchema = z.object({
  staffId: z.string().uuid(),
  schedule: z.array(z.object({
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: z.string(),
    endTime: z.string(),
    isWorking: z.boolean(),
  })),
})

const requestTimeOffSchema = z.object({
  staffId: z.string().uuid(),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  type: z.enum(["vacation", "sick", "personal", "other"]),
  notes: z.string().optional(),
})

const createStaffSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  role: z.string().min(1),
  serviceIds: z.array(z.string().uuid()).optional(),
})

const deleteStaffSchema = z.object({
  id: z.string().uuid(),
})

export async function updateStaffSchedule(
  staffId: string,
  schedule: { dayOfWeek: number; startTime: string; endTime: string; isWorking: boolean }[]
): Promise<ActionResult> {
  try {
    const parsed = updateStaffScheduleSchema.parse({ staffId, schedule })
    staffId = parsed.staffId
    schedule = parsed.schedule

    const { businessId } = await getBusinessContext()

    const staff = await prisma.staff.findFirst({
      where: { id: staffId, primaryLocation: { businessId } },
    })
    if (!staff) return { success: false, error: "Staff not found" }

    // Delete existing schedules and recreate
    await prisma.staffSchedule.deleteMany({ where: { staffId } })

    for (const day of schedule) {
      if (day.isWorking) {
        await prisma.staffSchedule.create({
          data: {
            staffId,
            locationId: staff.locationId,
            dayOfWeek: day.dayOfWeek,
            startTime: new Date(`2000-01-01T${day.startTime}:00`),
            endTime: new Date(`2000-01-01T${day.endTime}:00`),
            isWorking: true,
          },
        })
      }
    }

    revalidatePath("/staff")
    revalidatePath(`/staff/${staffId}`)
    revalidatePath("/calendar")
    return { success: true, data: undefined }
  } catch (e) {
    if (e instanceof z.ZodError) return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    console.error("updateStaffSchedule error:", e)
    return { success: false, error: (e as Error).message }
  }
}

export async function requestTimeOff(data: {
  staffId: string
  startDate: string
  endDate: string
  type: "vacation" | "sick" | "personal" | "other"
  notes?: string
}): Promise<ActionResult> {
  try {
    const parsed = requestTimeOffSchema.parse(data)
    const { businessId } = await getBusinessContext()

    // Verify the staff belongs to this business
    const staff = await prisma.staff.findFirst({
      where: { id: parsed.staffId, primaryLocation: { businessId } },
    })
    if (!staff) return { success: false, error: "Staff not found" }

    await prisma.staffTimeOff.create({
      data: {
        staffId: parsed.staffId,
        startDate: new Date(parsed.startDate),
        endDate: new Date(parsed.endDate),
        type: parsed.type,
        status: "pending",
        notes: parsed.notes,
      },
    })

    revalidatePath(`/staff/${parsed.staffId}`)
    return { success: true, data: undefined }
  } catch (e) {
    if (e instanceof z.ZodError) return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    console.error("requestTimeOff error:", e)
    return { success: false, error: (e as Error).message }
  }
}

export async function createStaff(data: {
  firstName: string
  lastName: string
  email: string
  phone?: string
  role: string
  serviceIds?: string[]
}): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = createStaffSchema.parse(data)

    const { businessId } = await requireMinRole("admin")

    const location = await prisma.location.findFirst({ where: { businessId } })
    if (!location) return { success: false, error: "Business not configured" }

    const existingUser = await prisma.user.findUnique({ where: { email: parsed.email } })
    if (existingUser) return { success: false, error: "A user with this email already exists" }

    const user = await prisma.user.create({
      data: {
        email: parsed.email,
        firstName: parsed.firstName,
        lastName: parsed.lastName,
        phone: parsed.phone,
        role: "staff",
      },
    })

    const staff = await prisma.staff.create({
      data: {
        userId: user.id,
        locationId: location.id,
        title: parsed.role,
        isActive: true,
      },
    })

    if (parsed.serviceIds?.length) {
      for (const serviceId of parsed.serviceIds) {
        await prisma.staffService.create({
          data: { staffId: staff.id, serviceId },
        })
      }
    }

    revalidatePath("/staff")
    revalidatePath("/calendar")
    return { success: true, data: { id: staff.id } }
  } catch (e) {
    if (e instanceof z.ZodError) return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    const msg = (e as Error).message
    if (msg === "Not authenticated" || msg === "No business context") {
      return { success: false, error: msg }
    }
    console.error("createStaff error:", e)
    return { success: false, error: msg }
  }
}

export async function deleteStaff(id: string): Promise<ActionResult> {
  try {
    const parsed = deleteStaffSchema.parse({ id })
    id = parsed.id

    const { businessId } = await requireMinRole("admin")

    // Verify staff belongs to this business before updating
    const staff = await prisma.staff.findFirst({
      where: { id, primaryLocation: { businessId } },
    })
    if (!staff) return { success: false, error: "Staff not found" }

    await prisma.staff.update({
      where: { id },
      data: { isActive: false, deletedAt: new Date() },
    })
    revalidatePath("/staff")
    revalidatePath("/calendar")
    return { success: true, data: undefined }
  } catch (e) {
    if (e instanceof z.ZodError) return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    console.error("deleteStaff error:", e)
    return { success: false, error: (e as Error).message }
  }
}
