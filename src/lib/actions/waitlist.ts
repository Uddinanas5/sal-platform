"use server"

import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getBusinessContext } from "@/lib/auth-utils"

const addToWaitlistSchema = z.object({
  clientId: z.string().uuid(),
  serviceId: z.string().uuid().optional(),
  staffId: z.string().uuid().optional(),
  preferredDate: z.coerce.date().optional(),
  preferredTimeStart: z.string().optional(),
  preferredTimeEnd: z.string().optional(),
  notes: z.string().optional(),
})

const idSchema = z.string().uuid("Invalid ID")

export async function addToWaitlist(data: {
  clientId: string
  serviceId?: string
  staffId?: string
  preferredDate?: Date
  preferredTimeStart?: string
  preferredTimeEnd?: string
  notes?: string
}) {
  try {
    const parsed = addToWaitlistSchema.parse(data)
    const { businessId } = await getBusinessContext()

    const entry = await prisma.waitlistEntry.create({
      data: {
        businessId,
        clientId: parsed.clientId,
        serviceId: parsed.serviceId,
        staffId: parsed.staffId,
        preferredDate: parsed.preferredDate,
        preferredTimeStart: parsed.preferredTimeStart ? new Date(`1970-01-01T${parsed.preferredTimeStart}`) : undefined,
        preferredTimeEnd: parsed.preferredTimeEnd ? new Date(`1970-01-01T${parsed.preferredTimeEnd}`) : undefined,
        notes: parsed.notes,
      },
    })
    revalidatePath("/calendar")
    return entry
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    }
    throw e
  }
}

export async function removeFromWaitlist(id: string) {
  try {
    const parsedId = idSchema.parse(id)
    const { businessId } = await getBusinessContext()
    await prisma.waitlistEntry.update({
      where: { id: parsedId, businessId },
      data: { status: "cancelled_waitlist" },
    })
    revalidatePath("/calendar")
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    }
    throw e
  }
}

export async function notifyWaitlistEntry(id: string) {
  try {
    const parsedId = idSchema.parse(id)
    const { businessId } = await getBusinessContext()
    await prisma.waitlistEntry.update({
      where: { id: parsedId, businessId },
      data: {
        status: "notified",
        notifiedAt: new Date(),
      },
    })
    revalidatePath("/calendar")
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    }
    throw e
  }
}

export async function bookFromWaitlist(id: string, appointmentId: string) {
  try {
    const parsedId = idSchema.parse(id)
    const parsedAppointmentId = idSchema.parse(appointmentId)
    const { businessId } = await getBusinessContext()
    await prisma.waitlistEntry.update({
      where: { id: parsedId, businessId },
      data: {
        status: "booked",
        bookedAt: new Date(),
        appointmentId: parsedAppointmentId,
      },
    })
    revalidatePath("/calendar")
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    }
    throw e
  }
}
