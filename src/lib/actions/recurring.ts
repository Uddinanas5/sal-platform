"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { addWeeks, addMonths } from "date-fns"
import { getBusinessContext } from "@/lib/auth-utils"

type ActionResult<T = void> = { success: true; data: T } | { success: false; error: string }

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
    const { businessId } = await getBusinessContext()

    const service = await prisma.service.findUnique({ where: { id: data.serviceId } })
    if (!service) return { success: false, error: "Service not found" }

    const location = await prisma.location.findFirst({ where: { businessId } })
    if (!location) return { success: false, error: "Business not configured" }

    const baseStart = new Date(data.startTime)
    const endDate = new Date(data.recurrenceEndDate)
    const price = Number(service.price)
    const tax = Math.round(price * 0.08875 * 100) / 100
    const seriesId = crypto.randomUUID()

    // Generate all occurrence dates
    const dates: Date[] = [baseStart]
    let next = baseStart
    while (true) {
      switch (data.recurrenceRule) {
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
          clientId: data.clientId,
          bookingReference: bookingRef,
          status: "confirmed",
          source: "pos",
          startTime,
          endTime,
          totalDuration: service.durationMinutes,
          subtotal: price,
          taxAmount: tax,
          totalAmount: price + tax,
          notes: data.notes,
          recurrenceRule: data.recurrenceRule,
          recurrenceEndDate: endDate,
          seriesId,
          parentAppointmentId: parentId,
        },
      })

      if (i === 0) parentId = appointment.id

      await prisma.appointmentService.create({
        data: {
          appointmentId: appointment.id,
          serviceId: data.serviceId,
          staffId: data.staffId,
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
    const msg = (e as Error).message
    if (msg === "Not authenticated" || msg === "No business context") {
      return { success: false, error: msg }
    }
    return { success: false, error: msg }
  }
}

export async function cancelRecurringSeries(
  seriesId: string,
  cancelFrom?: string
): Promise<ActionResult<{ count: number }>> {
  try {
    const { businessId } = await getBusinessContext()

    // Verify the series belongs to this business
    const seriesAppointment = await prisma.appointment.findFirst({
      where: { seriesId, businessId },
    })
    if (!seriesAppointment) {
      return { success: false, error: "Series not found" }
    }

    const where: Record<string, unknown> = {
      seriesId,
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
    if (data.clientIds.length === 0) {
      return { success: false, error: "At least one participant required" }
    }
    if (data.clientIds.length > data.maxParticipants) {
      return { success: false, error: "Too many participants" }
    }

    const { businessId } = await getBusinessContext()

    const service = await prisma.service.findUnique({ where: { id: data.serviceId } })
    if (!service) return { success: false, error: "Service not found" }

    const location = await prisma.location.findFirst({ where: { businessId } })
    if (!location) return { success: false, error: "Business not configured" }

    const startTime = new Date(data.startTime)
    const endTime = new Date(startTime)
    endTime.setMinutes(endTime.getMinutes() + service.durationMinutes)

    const price = Number(service.price)
    const tax = Math.round(price * 0.08875 * 100) / 100
    const count = await prisma.appointment.count({ where: { businessId } })
    const bookingRef = `SAL-${String(count + 1).padStart(4, "0")}`

    // Create the group appointment (primary client is first in list)
    const appointment = await prisma.appointment.create({
      data: {
        businessId,
        locationId: location.id,
        clientId: data.clientIds[0],
        bookingReference: bookingRef,
        status: "confirmed",
        source: "pos",
        startTime,
        endTime,
        totalDuration: service.durationMinutes,
        subtotal: price * data.clientIds.length,
        taxAmount: tax * data.clientIds.length,
        totalAmount: (price + tax) * data.clientIds.length,
        notes: data.notes,
        isGroupBooking: true,
        maxParticipants: data.maxParticipants,
      },
    })

    // Create appointment service
    await prisma.appointmentService.create({
      data: {
        appointmentId: appointment.id,
        serviceId: data.serviceId,
        staffId: data.staffId,
        name: service.name,
        durationMinutes: service.durationMinutes,
        price,
        finalPrice: price,
        startTime,
        endTime,
      },
    })

    // Add all participants
    for (const clientId of data.clientIds) {
      await prisma.groupParticipant.create({
        data: {
          appointmentId: appointment.id,
          clientId,
        },
      })
    }

    revalidatePath("/calendar")
    revalidatePath("/dashboard")
    return { success: true, data: { id: appointment.id, participantCount: data.clientIds.length } }
  } catch (e) {
    const msg = (e as Error).message
    if (msg === "Not authenticated" || msg === "No business context") {
      return { success: false, error: msg }
    }
    return { success: false, error: msg }
  }
}

export async function addGroupParticipant(
  appointmentId: string,
  clientId: string
): Promise<ActionResult> {
  try {
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { groupParticipants: true },
    })

    if (!appointment) return { success: false, error: "Appointment not found" }
    if (!appointment.isGroupBooking) return { success: false, error: "Not a group booking" }
    if (appointment.groupParticipants.length >= appointment.maxParticipants) {
      return { success: false, error: "Group is full" }
    }

    await prisma.groupParticipant.create({
      data: { appointmentId, clientId },
    })

    revalidatePath("/calendar")
    return { success: true, data: undefined }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function removeGroupParticipant(
  appointmentId: string,
  clientId: string
): Promise<ActionResult> {
  try {
    await prisma.groupParticipant.delete({
      where: { appointmentId_clientId: { appointmentId, clientId } },
    })

    revalidatePath("/calendar")
    return { success: true, data: undefined }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
