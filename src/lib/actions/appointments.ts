"use server"

import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { sendEmail } from "@/lib/email"
import { bookingConfirmationEmail, appointmentCancelledEmail, appointmentRescheduledEmail } from "@/lib/email-templates"
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
  status: z.enum(["confirmed", "pending", "checked-in", "in-progress", "completed", "cancelled", "no-show"]),
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

    const price = Number(service.price)
    const taxRate = service.isTaxable && service.taxRate ? Number(service.taxRate) / 100 : 0
    const tax = Math.round(price * taxRate * 100) / 100

    // Transaction: conflict check + create must be atomic to prevent race conditions
    const appointment = await prisma.$transaction(async (tx) => {
      // Double-booking prevention: check for overlapping appointments for the same staff member
      const conflicting = await tx.appointmentService.findFirst({
        where: {
          staffId: data.staffId,
          appointment: {
            status: { notIn: ["cancelled", "no_show"] },
          },
          startTime: { lt: endTime },
          endTime: { gt: startTime },
        },
      })
      if (conflicting) {
        throw new Error("CONFLICT")
      }

      // Atomic booking reference via random suffix to avoid count race condition
      const timestamp = Date.now().toString(36)
      const random = Math.random().toString(36).substring(2, 6)
      const bookingRef = `SAL-${timestamp}-${random}`.toUpperCase()

      const appt = await tx.appointment.create({
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

      await tx.appointmentService.create({
        data: {
          appointmentId: appt.id,
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

      return appt
    })

    if (!appointment) {
      return { success: false, error: "Failed to create appointment" }
    }

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
          bookingRef: appointment.bookingReference,
          businessEmail: business.email || undefined,
          businessPhone: business.phone || undefined,
        }),
      }).catch(console.error) // Don't block on email failure
    }

    revalidatePath("/calendar")
    revalidatePath("/dashboard")
    return { success: true, data: { id: appointment.id } }
  } catch (e) {
    const msg = (e as Error).message
    if (msg === "CONFLICT") {
      return { success: false, error: "This time slot is already booked for the selected staff member" }
    }
    if (msg === "Not authenticated" || msg === "No business context") {
      return { success: false, error: msg }
    }
    console.error("createAppointment error:", e)
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

    const appointment = await prisma.appointment.update({
      where: { id, businessId },
      data: {
        status: dbStatus as never,
        completedAt: dbStatus === "completed" ? new Date() : undefined,
        checkedInAt: dbStatus === "checked_in" ? new Date() : undefined,
        cancelledAt: dbStatus === "cancelled" ? new Date() : undefined,
        noShowAt: dbStatus === "no_show" ? new Date() : undefined,
      },
      include: {
        client: true,
        services: true,
        business: true,
      },
    })

    // Send cancellation email when status changes to cancelled
    if (dbStatus === "cancelled" && appointment.client?.email) {
      const dateTime = new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(appointment.startTime)

      sendEmail({
        to: appointment.client.email,
        subject: `Appointment Cancelled - ${appointment.services[0]?.name || "Your appointment"}`,
        html: appointmentCancelledEmail({
          clientName: `${appointment.client.firstName} ${appointment.client.lastName}`,
          serviceName: appointment.services[0]?.name || "Service",
          dateTime,
          businessName: appointment.business.name,
          bookingRef: appointment.bookingReference,
        }),
      }).catch(console.error) // Don't block on email failure
    }

    revalidatePath("/calendar")
    revalidatePath("/dashboard")
    return { success: true, data: undefined }
  } catch (e) {
    console.error("updateAppointmentStatus error:", e)
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
      include: {
        services: {
          include: {
            staff: { include: { user: true } },
          },
        },
        client: true,
        business: true,
      },
    })
    if (!appointment) return { success: false, error: "Appointment not found" }

    const oldStartTime = appointment.startTime
    const startTime = new Date(newStart)
    const endTime = new Date(startTime)
    endTime.setMinutes(endTime.getMinutes() + appointment.totalDuration)

    // Transaction: conflict check + update must be atomic
    const effectiveStaffId = newStaffId || appointment.services[0]?.staffId

    await prisma.$transaction(async (tx) => {
      if (effectiveStaffId) {
        const conflicting = await tx.appointmentService.findFirst({
          where: {
            staffId: effectiveStaffId,
            appointmentId: { not: id },
            appointment: {
              status: { notIn: ["cancelled", "no_show"] },
            },
            startTime: { lt: endTime },
            endTime: { gt: startTime },
          },
        })
        if (conflicting) {
          throw new Error("CONFLICT")
        }
      }

      await tx.appointment.update({
        where: { id, businessId },
        data: { startTime, endTime },
      })

      if (appointment.services[0]) {
        const updateData: Record<string, unknown> = { startTime, endTime }
        if (newStaffId) updateData.staffId = newStaffId

        await tx.appointmentService.update({
          where: { id: appointment.services[0].id },
          data: updateData,
        })
      }
    })

    // Send reschedule email (non-blocking)
    if (appointment.client?.email) {
      const dateFormatOptions: Intl.DateTimeFormatOptions = {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }
      const oldDateTime = new Intl.DateTimeFormat("en-US", dateFormatOptions).format(oldStartTime)
      const newDateTime = new Intl.DateTimeFormat("en-US", dateFormatOptions).format(startTime)

      const staffUser = appointment.services[0]?.staff?.user
      const staffName = staffUser
        ? `${staffUser.firstName} ${staffUser.lastName}`
        : "Our team"

      sendEmail({
        to: appointment.client.email,
        subject: `Appointment Rescheduled - ${appointment.services[0]?.name || "Your appointment"}`,
        html: appointmentRescheduledEmail({
          clientName: `${appointment.client.firstName} ${appointment.client.lastName}`,
          serviceName: appointment.services[0]?.name || "Service",
          oldDateTime,
          newDateTime,
          staffName,
          businessName: appointment.business.name,
          bookingRef: appointment.bookingReference,
        }),
      }).catch(console.error) // Don't block on email failure
    }

    revalidatePath("/calendar")
    return { success: true, data: undefined }
  } catch (e) {
    const msg = (e as Error).message
    if (msg === "CONFLICT") {
      return { success: false, error: "This time slot is already booked for the selected staff member" }
    }
    console.error("rescheduleAppointment error:", e)
    return { success: false, error: msg }
  }
}
