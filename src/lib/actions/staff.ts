"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getBusinessContext } from "@/lib/auth-utils"

type ActionResult<T = void> = { success: true; data: T } | { success: false; error: string }

export async function updateStaffSchedule(
  staffId: string,
  schedule: { dayOfWeek: number; startTime: string; endTime: string; isWorking: boolean }[]
): Promise<ActionResult> {
  try {
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
    await prisma.staffTimeOff.create({
      data: {
        staffId: data.staffId,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        type: data.type,
        status: "pending",
        notes: data.notes,
      },
    })

    revalidatePath(`/staff/${data.staffId}`)
    return { success: true, data: undefined }
  } catch (e) {
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
    const { businessId } = await getBusinessContext()

    const location = await prisma.location.findFirst({ where: { businessId } })
    if (!location) return { success: false, error: "Business not configured" }

    const existingUser = await prisma.user.findUnique({ where: { email: data.email } })
    if (existingUser) return { success: false, error: "A user with this email already exists" }

    const user = await prisma.user.create({
      data: {
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        role: "staff",
      },
    })

    const staff = await prisma.staff.create({
      data: {
        userId: user.id,
        locationId: location.id,
        title: data.role,
        isActive: true,
      },
    })

    if (data.serviceIds?.length) {
      for (const serviceId of data.serviceIds) {
        await prisma.staffService.create({
          data: { staffId: staff.id, serviceId },
        })
      }
    }

    revalidatePath("/staff")
    revalidatePath("/calendar")
    return { success: true, data: { id: staff.id } }
  } catch (e) {
    const msg = (e as Error).message
    if (msg === "Not authenticated" || msg === "No business context") {
      return { success: false, error: msg }
    }
    return { success: false, error: msg }
  }
}

export async function deleteStaff(id: string): Promise<ActionResult> {
  try {
    const { businessId } = await getBusinessContext()

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
    return { success: false, error: (e as Error).message }
  }
}
