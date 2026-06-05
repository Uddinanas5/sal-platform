"use server"

import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { addWeeks, addMonths } from "date-fns"
import { getBusinessContext } from "@/lib/auth-utils"
import { lockStaffSchedule } from "@/lib/db/advisory-lock"
import { generateBookingReference } from "@/lib/booking-reference"
import { hasRole } from "@/lib/permissions"
import { canAccessAppointmentSeries } from "@/lib/api/appointment-access"

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
    const { userId, businessId, role } = await getBusinessContext()

    const [service, client, staff] = await Promise.all([
      prisma.service.findFirst({
        where: { id: parsed.serviceId, businessId, deletedAt: null },
      }),
      prisma.client.findFirst({
        where: { id: parsed.clientId, businessId, deletedAt: null },
      }),
      prisma.staff.findFirst({
        where: {
          id: parsed.staffId,
          primaryLocation: { businessId },
          isActive: true,
          deletedAt: null,
        },
      }),
    ])
    if (!service) return { success: false, error: "Service not found" }
    if (!client) return { success: false, error: "Client not found" }
    if (!staff) return { success: false, error: "Staff not found" }
    if (!hasRole(role, "admin") && staff.userId !== userId) {
      return { success: false, error: "Forbidden" }
    }

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

    await prisma.$transaction(async (tx) => {
      await lockStaffSchedule(tx, businessId, parsed.staffId)

      for (let i = 0; i < dates.length; i++) {
        const startTime = dates[i]
        const endTime = new Date(startTime)
        endTime.setMinutes(endTime.getMinutes() + service.durationMinutes)

        const conflict = await tx.appointmentService.findFirst({
          where: {
            staffId: parsed.staffId,
            appointment: { status: { notIn: ["cancelled", "no_show"] } },
            startTime: { lt: endTime },
            endTime: { gt: startTime },
          },
        })
        if (conflict) throw new Error("CONFLICT")

        const appointment: { id: string } = await tx.appointment.create({
          data: {
            businessId,
            locationId: location.id,
            clientId: parsed.clientId,
            bookingReference: generateBookingReference(),
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

        await tx.appointmentService.create({
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
    })

    revalidatePath("/calendar")
    revalidatePath("/dashboard")
    return { success: true, data: { ids, count: ids.length } }
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    }
    const msg = (e as Error).message
    if (msg === "CONFLICT") {
      return { success: false, error: "One or more recurring time slots are already booked for the selected staff member" }
    }
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
    const { userId, businessId, role } = await getBusinessContext()

    // Verify the series belongs to this business
    const seriesAppointment = await prisma.appointment.findFirst({
      where: { seriesId: parsedSeriesId, businessId },
    })
    if (!seriesAppointment) {
      return { success: false, error: "Series not found" }
    }
    if (!(await canAccessAppointmentSeries({ userId, businessId, role }, parsedSeriesId))) {
      return { success: false, error: "Forbidden" }
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

    const { userId, businessId, role } = await getBusinessContext()

    if (new Set(parsed.clientIds).size !== parsed.clientIds.length) {
      return { success: false, error: "Duplicate participants are not allowed" }
    }

    const [service, staff, clientCount] = await Promise.all([
      prisma.service.findFirst({
        where: { id: parsed.serviceId, businessId, deletedAt: null },
      }),
      prisma.staff.findFirst({
        where: {
          id: parsed.staffId,
          primaryLocation: { businessId },
          isActive: true,
          deletedAt: null,
        },
      }),
      prisma.client.count({
        where: { id: { in: parsed.clientIds }, businessId, deletedAt: null },
      }),
    ])
    if (!service) return { success: false, error: "Service not found" }
    if (!staff) return { success: false, error: "Staff not found" }
    if (!hasRole(role, "admin") && staff.userId !== userId) {
      return { success: false, error: "Forbidden" }
    }
    if (clientCount !== parsed.clientIds.length) return { success: false, error: "Client not found" }

    const location = await prisma.location.findFirst({ where: { businessId } })
    if (!location) return { success: false, error: "Business not configured" }

    const startTime = new Date(parsed.startTime)
    const endTime = new Date(startTime)
    endTime.setMinutes(endTime.getMinutes() + service.durationMinutes)

    const price = Number(service.price)
    const taxRate = service.isTaxable && service.taxRate ? Number(service.taxRate) / 100 : 0
    const tax = Math.round(price * taxRate * 100) / 100
    const appointment = await prisma.$transaction(async (tx) => {
      await lockStaffSchedule(tx, businessId, parsed.staffId)

      const conflict = await tx.appointmentService.findFirst({
        where: {
          staffId: parsed.staffId,
          appointment: { status: { notIn: ["cancelled", "no_show"] } },
          startTime: { lt: endTime },
          endTime: { gt: startTime },
        },
      })
      if (conflict) throw new Error("CONFLICT")

      const created = await tx.appointment.create({
        data: {
          businessId,
          locationId: location.id,
          clientId: parsed.clientIds[0],
          bookingReference: generateBookingReference(),
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

      await tx.appointmentService.create({
        data: {
          appointmentId: created.id,
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

      for (const clientId of parsed.clientIds) {
        await tx.groupParticipant.create({
          data: {
            appointmentId: created.id,
            clientId,
          },
        })
      }

      return created
    })

    revalidatePath("/calendar")
    revalidatePath("/dashboard")
    return { success: true, data: { id: appointment.id, participantCount: parsed.clientIds.length } }
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    }
    const msg = (e as Error).message
    if (msg === "CONFLICT") {
      return { success: false, error: "This time slot is already booked for the selected staff member" }
    }
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
    const { businessId } = await getBusinessContext()

    const appointment = await prisma.appointment.findUnique({
      where: { id: parsedAppointmentId, businessId },
      include: { groupParticipants: true },
    })

    if (!appointment) return { success: false, error: "Appointment not found" }
    if (!appointment.isGroupBooking) return { success: false, error: "Not a group booking" }
    if (appointment.groupParticipants.length >= appointment.maxParticipants) {
      return { success: false, error: "Group is full" }
    }
    if (appointment.groupParticipants.some((p) => p.clientId === parsedClientId)) {
      return { success: false, error: "Client is already in this group" }
    }

    const client = await prisma.client.findFirst({
      where: { id: parsedClientId, businessId, deletedAt: null },
    })
    if (!client) return { success: false, error: "Client not found" }

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
    const { businessId } = await getBusinessContext()

    // Verify the appointment belongs to this business
    const appointment = await prisma.appointment.findUnique({
      where: { id: parsedAppointmentId, businessId },
    })
    if (!appointment) return { success: false, error: "Appointment not found" }

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
