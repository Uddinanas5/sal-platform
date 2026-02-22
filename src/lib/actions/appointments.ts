"use server"

import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { sendEmail } from "@/lib/email"
import { bookingConfirmationEmail } from "@/lib/email-templates"
import { getBusinessContext } from "@/lib/auth-utils"

type ActionResult<T = void> = { success: true; data: T } | { success: false; error: string }

const createAppointmentSchema = z.object({
  clientId: z.string().uuid(),
  serviceId: z.string().uuid(),
  staffId: z.string().uuid(),
  startTime: z.string().min(1),
  notes: z.string().optional(),
})

const updateAppointmentStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.string().min(1),
})

const rescheduleAppointmentSchema = z.object({
  id: z.string().uuid(),
  newStart: z.string().min(1),
  newStaffId: z.string().uuid().optional(),
})

export async function createAppointment(data: {
  clientId: string
  serviceId: string
  staffId: string
  startTime: string
  notes?: string
}): Promise<ActionResult<{ id: string }>> {
  try {
    createAppointmentSchema.parse(data)
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { success: false, error: "Invalid input: " + e.issues[0]?.message }
    }
    throw e
  }

  try {
    const { businessId } = await getBusinessContext()

    const service = await prisma.service.findUnique({ where: { id: data.serviceId } })
    if (!service) return { success: false, error: "Service not found" }

    const startTime = new Date(data.startTime)
    const endTime = new Date(startTime)
    endTime.setMinutes(endTime.getMinutes() + service.durationMinutes)

    const business = await prisma.business.findUnique({ where: { id: businessId } })
    const location = await prisma.location.findFirst({ where: { businessId } })
    if (!business || !location) return { success: false, error: "Business not configured" }

    const count = await prisma.appointment.count({ where: { businessId } })
    const bookingRef = `SAL-${String(count + 1).padStart(4, "0")}`

    const price = Number(service.price)
    const tax = Math.round(price * 0.08875 * 100) / 100

    const appointment = await prisma.appointment.create({
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
      },
    })

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

    // Send booking confirmation email (non-blocking)
    const client = await prisma.client.findUnique({ where: { id: data.clientId } })
    const staff = await prisma.staff.findUnique({
      where: { id: data.staffId },
      include: { user: true },
    })

    if (client?.email) {
      const dateTime = new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(startTime)

      sendEmail({
        to: client.email,
        subject: `Booking Confirmed - ${service.name}`,
        html: bookingConfirmationEmail({
          clientName: `${client.firstName} ${client.lastName}`,
          serviceName: service.name,
          staffName: staff ? `${staff.user.firstName} ${staff.user.lastName}` : "Our team",
          dateTime,
          businessName: business.name,
          bookingRef,
        }),
      }).catch(console.error) // Don't block on email failure
    }

    revalidatePath("/calendar")
    revalidatePath("/dashboard")
    return { success: true, data: { id: appointment.id } }
  } catch (e) {
    const msg = (e as Error).message
    if (msg === "Not authenticated" || msg === "No business context") {
      return { success: false, error: msg }
    }
    return { success: false, error: msg }
  }
}

export async function updateAppointmentStatus(
  id: string,
  status: string
): Promise<ActionResult> {
  try {
    updateAppointmentStatusSchema.parse({ id, status })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { success: false, error: "Invalid input: " + e.issues[0]?.message }
    }
    throw e
  }

  try {
    const { businessId } = await getBusinessContext()

    const statusMap: Record<string, string> = {
      confirmed: "confirmed",
      pending: "pending",
      "checked-in": "checked_in",
      "in-progress": "in_progress",
      completed: "completed",
      cancelled: "cancelled",
      "no-show": "no_show",
    }

    const dbStatus = statusMap[status] || status

    await prisma.appointment.update({
      where: { id, businessId },
      data: {
        status: dbStatus as never,
        completedAt: dbStatus === "completed" ? new Date() : undefined,
        checkedInAt: dbStatus === "checked_in" ? new Date() : undefined,
        cancelledAt: dbStatus === "cancelled" ? new Date() : undefined,
        noShowAt: dbStatus === "no_show" ? new Date() : undefined,
      },
    })

    revalidatePath("/calendar")
    revalidatePath("/dashboard")
    return { success: true, data: undefined }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function rescheduleAppointment(
  id: string,
  newStart: string,
  newStaffId?: string
): Promise<ActionResult> {
  try {
    rescheduleAppointmentSchema.parse({ id, newStart, newStaffId })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { success: false, error: "Invalid input: " + e.issues[0]?.message }
    }
    throw e
  }

  try {
    const { businessId } = await getBusinessContext()

    const appointment = await prisma.appointment.findUnique({
      where: { id, businessId },
      include: { services: true },
    })
    if (!appointment) return { success: false, error: "Appointment not found" }

    const startTime = new Date(newStart)
    const endTime = new Date(startTime)
    endTime.setMinutes(endTime.getMinutes() + appointment.totalDuration)

    await prisma.appointment.update({
      where: { id, businessId },
      data: { startTime, endTime },
    })

    if (appointment.services[0]) {
      const updateData: Record<string, unknown> = { startTime, endTime }
      if (newStaffId) updateData.staffId = newStaffId

      await prisma.appointmentService.update({
        where: { id: appointment.services[0].id },
        data: updateData,
      })
    }

    revalidatePath("/calendar")
    return { success: true, data: undefined }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
