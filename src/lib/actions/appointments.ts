"use server"

import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { sendEmail } from "@/lib/email"
import { bookingConfirmationEmail, appointmentCancelledEmail, appointmentRescheduledEmail } from "@/lib/email-templates"
import { getBusinessContext } from "@/lib/auth-utils"
import { lockStaffSchedule } from "@/lib/db/advisory-lock"
import { assertClientOwned, assertStaffOwned, generateBookingReference } from "@/lib/ownership"
import {
  assertSlotAllowed,
  ERR_OUTSIDE_WORKING_HOURS,
  ERR_ON_APPROVED_TIME_OFF,
} from "@/lib/scheduling/working-hours"

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

const resizeAppointmentSchema = z.object({
  id: z.string().uuid(),
  newDurationMinutes: z.number().int().min(5).max(720),
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

    await assertClientOwned(data.clientId, businessId)
    await assertStaffOwned(data.staffId, businessId)

    const service = await prisma.service.findFirst({ where: { id: data.serviceId, businessId } })
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
      await lockStaffSchedule(tx, businessId, data.staffId)
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

      const bookingRef = generateBookingReference()

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

const cancelAppointmentSchema = z.object({
  id: z.string().uuid(),
  // "no_show" is a cancellation variant — keep them in one structured flow.
  status: z.enum(["cancelled", "no_show"]),
  initiator: z.enum(["client", "business", "staff", "system"]),
  reasonCode: z.enum([
    "client_request",
    "illness",
    "scheduling_conflict",
    "staff_unavailable",
    "no_show",
    "payment_issue",
    "other",
  ]),
  note: z.string().max(500).optional(),
})

/**
 * Cancel (or mark no-show) an appointment WITH a structured reason:
 * who initiated it, a reason code, and an optional free-text note. Powers
 * cancellation reporting and (later) no-show fees. Tenant-scoped.
 */
export async function cancelAppointment(input: {
  id: string
  status: "cancelled" | "no_show"
  initiator: "client" | "business" | "staff" | "system"
  reasonCode:
    | "client_request"
    | "illness"
    | "scheduling_conflict"
    | "staff_unavailable"
    | "no_show"
    | "payment_issue"
    | "other"
  note?: string
}): Promise<ActionResult> {
  let parsed: z.infer<typeof cancelAppointmentSchema>
  try {
    parsed = cancelAppointmentSchema.parse(input)
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { success: false, error: "Invalid input: " + e.issues[0]?.message }
    }
    throw e
  }

  try {
    const { businessId, userId } = await getBusinessContext()
    const now = new Date()

    const appointment = await prisma.appointment.update({
      where: { id: parsed.id, businessId },
      data: {
        status: parsed.status,
        cancellationInitiator: parsed.initiator,
        cancellationReasonCode: parsed.reasonCode,
        cancellationReason: parsed.note,
        cancelledBy: userId,
        cancelledAt: parsed.status === "cancelled" ? now : undefined,
        noShowAt: parsed.status === "no_show" ? now : undefined,
      },
      include: { client: true, services: true, business: true },
    })

    // Notify the client when a (non-no-show) cancellation happens.
    if (parsed.status === "cancelled" && appointment.client?.email) {
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
      }).catch(console.error)
    }

    revalidatePath("/calendar")
    revalidatePath("/dashboard")
    return { success: true, data: undefined }
  } catch (e) {
    console.error("cancelAppointment error:", e)
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
    const deltaMs = startTime.getTime() - oldStartTime.getTime()

    // Shift every service row by the same delta. Preserves intra-appointment
    // ordering/gaps and avoids leaving services 2..N at the old slot.
    const sortedServices = [...appointment.services].sort(
      (a, b) => a.startTime.getTime() - b.startTime.getTime(),
    )
    const serviceUpdates = sortedServices.map((s, i) => ({
      id: s.id,
      startTime: new Date(s.startTime.getTime() + deltaMs),
      endTime: new Date(s.endTime.getTime() + deltaMs),
      // `newStaffId` reassigns the lead service only; services[1..N] keep
      // their original staff. The API has no per-service reassignment field,
      // so this is the implicit contract — revisit if the UI ever surfaces
      // per-service staff picking on reschedule.
      staffId: newStaffId && i === 0 ? newStaffId : s.staffId,
      applyStaffUpdate: Boolean(newStaffId && i === 0),
    }))

    await prisma.$transaction(async (tx) => {
      const uniqueStaffIds = Array.from(
        new Set(serviceUpdates.map((s) => s.staffId).filter(Boolean) as string[]),
      ).sort()
      for (const staffId of uniqueStaffIds) {
        await lockStaffSchedule(tx, businessId, staffId)
      }

      for (const su of serviceUpdates) {
        if (!su.staffId) continue
        await assertSlotAllowed(tx, su.staffId, appointment.locationId, su.startTime, su.endTime)
        const conflicting = await tx.appointmentService.findFirst({
          where: {
            staffId: su.staffId,
            appointmentId: { not: id },
            appointment: {
              status: { notIn: ["cancelled", "no_show"] },
            },
            startTime: { lt: su.endTime },
            endTime: { gt: su.startTime },
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

      for (const su of serviceUpdates) {
        const updateData: Record<string, unknown> = {
          startTime: su.startTime,
          endTime: su.endTime,
        }
        if (su.applyStaffUpdate) updateData.staffId = su.staffId
        await tx.appointmentService.update({
          where: { id: su.id },
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
    if (msg === ERR_OUTSIDE_WORKING_HOURS) {
      return { success: false, error: "Outside the staff member's working hours" }
    }
    if (msg === ERR_ON_APPROVED_TIME_OFF) {
      return { success: false, error: "Staff member has approved time off during this slot" }
    }
    console.error("rescheduleAppointment error:", e)
    return { success: false, error: msg }
  }
}

export async function resizeAppointment(
  id: string,
  newDurationMinutes: number
): Promise<ActionResult> {
  try {
    resizeAppointmentSchema.parse({ id, newDurationMinutes })
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

    const startTime = appointment.startTime
    const newEndTime = new Date(startTime)
    newEndTime.setMinutes(newEndTime.getMinutes() + newDurationMinutes)

    const staffId = appointment.services[0]?.staffId

    await prisma.$transaction(async (tx) => {
      if (staffId) {
        await lockStaffSchedule(tx, businessId, staffId)
        await assertSlotAllowed(tx, staffId, appointment.locationId, startTime, newEndTime)
        const conflicting = await tx.appointmentService.findFirst({
          where: {
            staffId,
            appointmentId: { not: id },
            appointment: {
              status: { notIn: ["cancelled", "no_show"] },
            },
            startTime: { lt: newEndTime },
            endTime: { gt: startTime },
          },
        })
        if (conflicting) {
          throw new Error("CONFLICT")
        }
      }

      await tx.appointment.update({
        where: { id, businessId },
        data: { endTime: newEndTime, totalDuration: newDurationMinutes },
      })

      if (appointment.services[0]) {
        await tx.appointmentService.update({
          where: { id: appointment.services[0].id },
          data: {
            endTime: newEndTime,
            durationMinutes: newDurationMinutes,
          },
        })
      }
    })

    revalidatePath("/calendar")
    return { success: true, data: undefined }
  } catch (e) {
    const msg = (e as Error).message
    if (msg === "CONFLICT") {
      return { success: false, error: "Resizing would overlap another booking" }
    }
    if (msg === ERR_OUTSIDE_WORKING_HOURS) {
      return { success: false, error: "Resized end time falls outside the staff member's working hours" }
    }
    if (msg === ERR_ON_APPROVED_TIME_OFF) {
      return { success: false, error: "Resized end time overlaps approved staff time off" }
    }
    console.error("resizeAppointment error:", e)
    return { success: false, error: msg }
  }
}
