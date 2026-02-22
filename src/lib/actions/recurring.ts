"use server"

import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { addWeeks, addMonths } from "date-fns"
import { getBusinessContext } from "@/lib/auth-utils"

type ActionResult<T = void> = { success: true; data: T } | { success: false; error: string }

const idSchema = z.string().uuid("Invalid ID")

const createRecurringSchema = z.object({
  clientId: z.string().uuid(),
  serviceId: z.string().uuid(),
  staffId: z.string().uuid(),
  startTime: z.string().min(1, "Start time is required"),
  notes: z.string().optional(),
  recurrenceRule: z.enum(["weekly", "biweekly", "monthly"]),
  recurrenceEndDate: z.string().min(1, "End date is required"),
})

const createGroupBookingSchema = z.object({
  serviceId: z.string().uuid(),
  staffId: z.string().uuid(),
  startTime: z.string().min(1, "Start time is required"),
  maxParticipants: z.number().int().positive(),
  clientIds: z.array(z.string().uuid()).min(1, "At least one participant required"),
  notes: z.string().optional(),
})

export async function createRecurringAppointment(data: {
  clientId: string
  serviceId: string
  staffId: string
  startTime: string
  notes?: string
  recurrenceRule: "weekly" | "biweekly" | "monthly"
  recurrenceEndDate: string
}): Promise<ActionResult<{ ids: string[]; count: number }>> {
  try {
    const parsed = createRecurringSchema.parse(data)
    const { businessId } = await getBusinessContext()

    const service = await prisma.service.findUnique({ where: { id: parsed.serviceId } })
    if (!service) return { success: false, error: "Service not found" }

    const location = await prisma.location.findFirst({ where: { businessId } })
    if (!location) return { success: false, error: "Business not configured" }

    const baseStart = new Date(parsed.startTime)
    const endDate = new Date(parsed.recurrenceEndDate)
    const price = Number(service.price)
    const taxRate = service.isTaxable && service.taxRate ? Number(service.taxRate) / 100 : 0
    const tax = Math.round(price * taxRate * 100) / 100
    const seriesId = crypto.randomUUID()

    // Generate all occurrence dates
    const dates: Date[] = [baseStart]
    let next = baseStart
    while (true) {
      switch (parsed.recurrenceRule) {
        case "weekly":
          next = addWeeks(next, 1)
          break
        case "biweekly":
          next = addWeeks(next, 2)
          break
        case "monthly":
          next = addMonths(next, 1)
          break
      }
      if (next > endDate) break
      dates.push(next)
      if (dates.length > 52) break // Safety limit: max 1 year of weekly
    }

    const ids: string[] = []
    let parentId: string | null = null

    for (let i = 0; i < dates.length; i++) {
      const startTime = dates[i]
      const endTime = new Date(startTime)
      endTime.setMinutes(endTime.getMinutes() + service.durationMinutes)

      const count = await prisma.appointment.count({ where: { businessId } })
      const bookingRef = `SAL-${String(count + 1).padStart(4, "0")}`

      const appointment: { id: string } = await prisma.appointment.create({
        data: {
          businessId,
          locationId: location.id,
          clientId: parsed.clientId,
          bookingReference: bookingRef,
          status: "confirmed",
          source: "pos",
          startTime,
          endTime,
          totalDuration: service.durationMinutes,
          subtotal: price,
          taxAmount: tax,
          totalAmount: price + tax,
          notes: parsed.notes,
          recurrenceRule: parsed.recurrenceRule,
          recurrenceEndDate: endDate,
          seriesId,
          parentAppointmentId: parentId,
        },
      })

      if (i === 0) parentId = appointment.id

      await prisma.appointmentService.create({
        data: {
          appointmentId: appointment.id,
          serviceId: parsed.serviceId,
          staffId: parsed.staffId,
          name: service.name,
          durationMinutes: service.durationMinutes,
          price,
          finalPrice: price,
          startTime,
          endTime,
        },
      })

      ids.push(appointment.id)
    }

    revalidatePath("/calendar")
    revalidatePath("/dashboard")
    return { success: true, data: { ids, count: ids.length } }
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    }
    const msg = (e as Error).message
    if (msg === "Not authenticated" || msg === "No business context") {
      return { success: false, error: msg }
    }
    console.error("createRecurringAppointment error:", e)
    return { success: false, error: msg }
  }
}

export async function cancelRecurringSeries(
  seriesId: string,
  cancelFrom?: string
): Promise<ActionResult<{ count: number }>> {
  try {
    const parsedSeriesId = idSchema.parse(seriesId)
    const { businessId } = await getBusinessContext()

    // Verify the series belongs to this business
    const seriesAppointment = await prisma.appointment.findFirst({
      where: { seriesId: parsedSeriesId, businessId },
    })
    if (!seriesAppointment) {
      return { success: false, error: "Series not found" }
    }

    const where: Record<string, unknown> = {
      seriesId: parsedSeriesId,
      businessId,
      status: { notIn: ["completed", "cancelled"] },
    }

    if (cancelFrom) {
      where.startTime = { gte: new Date(cancelFrom) }
    }

    const result = await prisma.appointment.updateMany({
      where: where as never,
      data: {
        status: "cancelled",
        cancelledAt: new Date(),
        cancellationReason: "Recurring series cancelled",
      },
    })

    revalidatePath("/calendar")
    return { success: true, data: { count: result.count } }
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    }
    console.error("cancelRecurringSeries error:", e)
    return { success: false, error: (e as Error).message }
  }
}

export async function createGroupBooking(data: {
  serviceId: string
  staffId: string
  startTime: string
  maxParticipants: number
  clientIds: string[]
  notes?: string
}): Promise<ActionResult<{ id: string; participantCount: number }>> {
  try {
    const parsed = createGroupBookingSchema.parse(data)

    if (parsed.clientIds.length > parsed.maxParticipants) {
      return { success: false, error: "Too many participants" }
    }

    const { businessId } = await getBusinessContext()

    const service = await prisma.service.findUnique({ where: { id: parsed.serviceId } })
    if (!service) return { success: false, error: "Service not found" }

    const location = await prisma.location.findFirst({ where: { businessId } })
    if (!location) return { success: false, error: "Business not configured" }

    const startTime = new Date(parsed.startTime)
    const endTime = new Date(startTime)
    endTime.setMinutes(endTime.getMinutes() + service.durationMinutes)

    const price = Number(service.price)
    const taxRate = service.isTaxable && service.taxRate ? Number(service.taxRate) / 100 : 0
    const tax = Math.round(price * taxRate * 100) / 100
    const count = await prisma.appointment.count({ where: { businessId } })
    const bookingRef = `SAL-${String(count + 1).padStart(4, "0")}`

    // Create the group appointment (primary client is first in list)
    const appointment = await prisma.appointment.create({
      data: {
        businessId,
        locationId: location.id,
        clientId: parsed.clientIds[0],
        bookingReference: bookingRef,
        status: "confirmed",
        source: "pos",
        startTime,
        endTime,
        totalDuration: service.durationMinutes,
        subtotal: price * parsed.clientIds.length,
        taxAmount: tax * parsed.clientIds.length,
        totalAmount: (price + tax) * parsed.clientIds.length,
        notes: parsed.notes,
        isGroupBooking: true,
        maxParticipants: parsed.maxParticipants,
      },
    })

    // Create appointment service
    await prisma.appointmentService.create({
      data: {
        appointmentId: appointment.id,
        serviceId: parsed.serviceId,
        staffId: parsed.staffId,
        name: service.name,
        durationMinutes: service.durationMinutes,
        price,
        finalPrice: price,
        startTime,
        endTime,
      },
    })

    // Add all participants
    for (const clientId of parsed.clientIds) {
      await prisma.groupParticipant.create({
        data: {
          appointmentId: appointment.id,
          clientId,
        },
      })
    }

    revalidatePath("/calendar")
    revalidatePath("/dashboard")
    return { success: true, data: { id: appointment.id, participantCount: parsed.clientIds.length } }
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    }
    const msg = (e as Error).message
    if (msg === "Not authenticated" || msg === "No business context") {
      return { success: false, error: msg }
    }
    console.error("createGroupBooking error:", e)
    return { success: false, error: msg }
  }
}

export async function addGroupParticipant(
  appointmentId: string,
  clientId: string
): Promise<ActionResult> {
  try {
    const parsedAppointmentId = idSchema.parse(appointmentId)
    const parsedClientId = idSchema.parse(clientId)

    const appointment = await prisma.appointment.findUnique({
      where: { id: parsedAppointmentId },
      include: { groupParticipants: true },
    })

    if (!appointment) return { success: false, error: "Appointment not found" }
    if (!appointment.isGroupBooking) return { success: false, error: "Not a group booking" }
    if (appointment.groupParticipants.length >= appointment.maxParticipants) {
      return { success: false, error: "Group is full" }
    }

    await prisma.groupParticipant.create({
      data: { appointmentId: parsedAppointmentId, clientId: parsedClientId },
    })

    revalidatePath("/calendar")
    return { success: true, data: undefined }
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    }
    console.error("addGroupParticipant error:", e)
    return { success: false, error: (e as Error).message }
  }
}

export async function removeGroupParticipant(
  appointmentId: string,
  clientId: string
): Promise<ActionResult> {
  try {
    const parsedAppointmentId = idSchema.parse(appointmentId)
    const parsedClientId = idSchema.parse(clientId)

    await prisma.groupParticipant.delete({
      where: { appointmentId_clientId: { appointmentId: parsedAppointmentId, clientId: parsedClientId } },
    })

    revalidatePath("/calendar")
    return { success: true, data: undefined }
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    }
    console.error("removeGroupParticipant error:", e)
    return { success: false, error: (e as Error).message }
  }
}
