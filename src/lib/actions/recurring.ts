"use server"

import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { addWeeks, addMonths } from "date-fns"
import { getBusinessContext } from "@/lib/auth-utils"
import { lockStaffSchedule, isBookingContentionError } from "@/lib/db/advisory-lock"
import {
  assertClientOwned,
  assertClientsOwned,
  assertStaffOwned,
  generateBookingReference,
} from "@/lib/ownership"
import {
  assertSlotAllowed,
  ERR_OUTSIDE_WORKING_HOURS,
  ERR_ON_APPROVED_TIME_OFF,
} from "@/lib/scheduling/working-hours"

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

    await assertClientOwned(parsed.clientId, businessId)
    await assertStaffOwned(parsed.staffId, businessId)

    const service = await prisma.service.findFirst({ where: { id: parsed.serviceId, businessId } })
    if (!service) return { success: false, error: "Service not found" }

    const location = await prisma.location.findFirst({ where: { businessId } })
    if (!location) return { success: false, error: "Business not configured" }

    // Salon IANA timezone anchors the @db.Time working-hours window in
    // assertSlotAllowed to the salon's clock (not the server's) on any host.
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { timezone: true },
    })
    const timezone = business?.timezone ?? "UTC"

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

    // Create the whole series atomically: either every occurrence is booked or
    // none are (no partial/orphaned series). Lock the staff schedule once and
    // conflict-check each occurrence so a recurring series can't double-book.
    const ids: string[] = await prisma.$transaction(async (tx) => {
      await lockStaffSchedule(tx, businessId, parsed.staffId)

      const createdIds: string[] = []
      let parentId: string | null = null

      for (let i = 0; i < dates.length; i++) {
        const startTime = dates[i]
        const endTime = new Date(startTime)
        endTime.setMinutes(endTime.getMinutes() + service.durationMinutes)

        // Enforce working-hours / break / approved-time-off for EVERY occurrence
        // (GAP-001). One out-of-hours date fails the whole series — consistent
        // with the all-or-nothing transaction semantics below. Salon timezone
        // anchors the @db.Time hours on any host.
        await assertSlotAllowed(tx, parsed.staffId, location.id, startTime, endTime, timezone)

        const conflicting = await tx.appointmentService.findFirst({
          where: {
            staffId: parsed.staffId,
            appointment: {
              businessId,
              status: { notIn: ["cancelled", "no_show"] },
            },
            startTime: { lt: endTime },
            endTime: { gt: startTime },
          },
        })
        if (conflicting) throw new Error("CONFLICT")

        const bookingRef = generateBookingReference()

        const appointment: { id: string } = await tx.appointment.create({
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

        createdIds.push(appointment.id)
      }

      return createdIds
    }, { timeout: 20000, maxWait: 15000 })

    revalidatePath("/calendar")
    revalidatePath("/dashboard")
    return { success: true, data: { ids, count: ids.length } }
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    }
    const msg = (e as Error).message
    if (msg === "CONFLICT") {
      return {
        success: false,
        error:
          "One or more dates in this recurring series conflict with existing appointments. No appointments were created — adjust the time and try again.",
      }
    }
    if (msg === ERR_OUTSIDE_WORKING_HOURS) {
      return {
        success: false,
        error:
          "One or more dates in this recurring series fall outside the staff member's working hours. No appointments were created — adjust the time and try again.",
      }
    }
    if (msg === ERR_ON_APPROVED_TIME_OFF) {
      return {
        success: false,
        error:
          "One or more dates in this recurring series land on the staff member's approved time off. No appointments were created — adjust the time and try again.",
      }
    }
    if (msg === "Not authenticated" || msg === "No business context") {
      return { success: false, error: msg }
    }
    // Concurrency contention behind the advisory lock (tx timeout P2028 /
    // write-conflict P2034) — surface the same clean "try again" conflict error.
    if (isBookingContentionError(e)) {
      return { success: false, error: "This time slot is no longer available, please try again" }
    }
    console.error("createRecurringAppointment error:", e)
    return { success: false, error: msg }
  }
}

/**
 * Series membership for ONE appointment, tenant-scoped. The calendar detail
 * sheet calls this when it opens an appointment so it can (a) show a
 * "Repeats … · series" badge and (b) decide whether to offer cancellation
 * scopes (this / this & following / all). Returns isSeriesMember=false for a
 * one-off appointment so the UI shows neither the badge nor the scope picker.
 */
export async function getSeriesInfo(
  appointmentId: string
): Promise<
  ActionResult<{
    isSeriesMember: boolean
    seriesId: string | null
    recurrenceRule: string | null
    startTime: string | null
  }>
> {
  try {
    const id = idSchema.parse(appointmentId)
    const { businessId } = await getBusinessContext()

    const appt = await prisma.appointment.findFirst({
      where: { id, businessId },
      select: { seriesId: true, recurrenceRule: true, startTime: true },
    })
    if (!appt) return { success: false, error: "Appointment not found" }

    return {
      success: true,
      data: {
        isSeriesMember: Boolean(appt.seriesId),
        seriesId: appt.seriesId,
        recurrenceRule: appt.recurrenceRule,
        startTime: appt.startTime ? appt.startTime.toISOString() : null,
      },
    }
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    }
    if ((e as Error).message === "Not authenticated" || (e as Error).message === "No business context") {
      return { success: false, error: (e as Error).message }
    }
    console.error("getSeriesInfo error:", e)
    return { success: false, error: (e as Error).message }
  }
}

const cancelRecurringSchema = z.object({
  appointmentId: z.string().uuid(),
  scope: z.enum(["this", "following", "all"]),
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
 * Cancel (or mark no-show) a member of a recurring series with an explicit
 * scope, mirroring the structured-reason fields of the single-appointment
 * cancelAppointment action (initiator, reason code, note, cancelledBy, and the
 * cancelledAt / noShowAt timestamps).
 *
 * Scope → WHERE resolution (all tenant-scoped by businessId):
 *   - "this"      → just this appointment id (a single occurrence; the rest of
 *                   the series is untouched). Works even for a one-off, but the
 *                   UI only surfaces the scope picker for series members.
 *   - "following" → every occurrence in the SAME series whose startTime is at or
 *                   after this one (this occurrence forward).
 *   - "all"       → every occurrence in the same series.
 *
 * Already-terminal occurrences (completed / cancelled) are left alone for the
 * batch scopes, matching cancelRecurringSeries — you can't re-cancel a finished
 * appointment. Returns how many appointments were actually cancelled.
 */
export async function cancelRecurring(input: {
  appointmentId: string
  scope: "this" | "following" | "all"
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
}): Promise<ActionResult<{ count: number }>> {
  let parsed: z.infer<typeof cancelRecurringSchema>
  try {
    parsed = cancelRecurringSchema.parse(input)
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    }
    throw e
  }

  try {
    const { businessId, userId } = await getBusinessContext()
    const now = new Date()

    // Look up the anchor appointment (tenant-scoped) to learn its series + time.
    const anchor = await prisma.appointment.findFirst({
      where: { id: parsed.appointmentId, businessId },
      select: { id: true, seriesId: true, startTime: true },
    })
    if (!anchor) return { success: false, error: "Appointment not found" }

    // "following" / "all" only make sense for a real series. Fall back to a
    // single-occurrence cancel (scope "this") if asked to batch a one-off, so we
    // never silently no-op or touch unrelated appointments.
    const effectiveScope =
      parsed.scope !== "this" && !anchor.seriesId ? "this" : parsed.scope

    const data = {
      status: parsed.status,
      cancellationInitiator: parsed.initiator,
      cancellationReasonCode: parsed.reasonCode,
      cancellationReason: parsed.note,
      cancelledBy: userId,
      cancelledAt: parsed.status === "cancelled" ? now : undefined,
      noShowAt: parsed.status === "no_show" ? now : undefined,
    }

    let count: number
    if (effectiveScope === "this") {
      // Single occurrence — scope strictly to this id + tenant.
      await prisma.appointment.update({
        where: { id: anchor.id, businessId },
        data,
      })
      count = 1
    } else {
      const where: Record<string, unknown> = {
        seriesId: anchor.seriesId,
        businessId,
        status: { notIn: ["completed", "cancelled"] },
      }
      if (effectiveScope === "following" && anchor.startTime) {
        where.startTime = { gte: anchor.startTime }
      }
      const result = await prisma.appointment.updateMany({
        where: where as never,
        data,
      })
      count = result.count
    }

    revalidatePath("/calendar")
    revalidatePath("/dashboard")
    return { success: true, data: { count } }
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    }
    if ((e as Error).message === "Not authenticated" || (e as Error).message === "No business context") {
      return { success: false, error: (e as Error).message }
    }
    console.error("cancelRecurring error:", e)
    return { success: false, error: (e as Error).message }
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

    await assertStaffOwned(parsed.staffId, businessId)
    await assertClientsOwned(parsed.clientIds, businessId)

    const service = await prisma.service.findFirst({ where: { id: parsed.serviceId, businessId } })
    if (!service) return { success: false, error: "Service not found" }

    const location = await prisma.location.findFirst({ where: { businessId } })
    if (!location) return { success: false, error: "Business not configured" }

    // Salon IANA timezone anchors the @db.Time working-hours window in
    // assertSlotAllowed to the salon's clock (not the server's) on any host.
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { timezone: true },
    })
    const timezone = business?.timezone ?? "UTC"

    const startTime = new Date(parsed.startTime)
    const endTime = new Date(startTime)
    endTime.setMinutes(endTime.getMinutes() + service.durationMinutes)

    const price = Number(service.price)
    const taxRate = service.isTaxable && service.taxRate ? Number(service.taxRate) / 100 : 0
    const tax = Math.round(price * taxRate * 100) / 100
    const bookingRef = generateBookingReference()

    // Create the group appointment + service + all participants atomically,
    // with a staff lock + conflict check so the group slot can't double-book
    // the staff and can't leave a partial booking on failure.
    const appointment = await prisma.$transaction(async (tx) => {
      await lockStaffSchedule(tx, businessId, parsed.staffId)

      // Group bookings hit the working-hours / break / approved-time-off guard
      // too (GAP-001): a group can't be slotted onto a barber's lunch or day off.
      // Salon timezone anchors the @db.Time hours on any host.
      await assertSlotAllowed(tx, parsed.staffId, location.id, startTime, endTime, timezone)

      const conflicting = await tx.appointmentService.findFirst({
        where: {
          staffId: parsed.staffId,
          appointment: {
            businessId,
            status: { notIn: ["cancelled", "no_show"] },
          },
          startTime: { lt: endTime },
          endTime: { gt: startTime },
        },
      })
      if (conflicting) throw new Error("CONFLICT")

      // primary client is first in list
      const appt = await tx.appointment.create({
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

      await tx.appointmentService.create({
        data: {
          appointmentId: appt.id,
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

      await tx.groupParticipant.createMany({
        data: parsed.clientIds.map((clientId) => ({
          appointmentId: appt.id,
          clientId,
        })),
      })

      return appt
    }, { timeout: 20000, maxWait: 15000 })

    revalidatePath("/calendar")
    revalidatePath("/dashboard")
    return { success: true, data: { id: appointment.id, participantCount: parsed.clientIds.length } }
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    }
    const msg = (e as Error).message
    if (msg === "CONFLICT") {
      return {
        success: false,
        error: "This time slot is already booked for the selected staff member.",
      }
    }
    if (msg === ERR_OUTSIDE_WORKING_HOURS) {
      return { success: false, error: "Outside the staff member's working hours." }
    }
    if (msg === ERR_ON_APPROVED_TIME_OFF) {
      return { success: false, error: "Staff member has approved time off during this slot." }
    }
    if (msg === "Not authenticated" || msg === "No business context") {
      return { success: false, error: msg }
    }
    // Concurrency contention behind the advisory lock (tx timeout P2028 /
    // write-conflict P2034) — surface the same clean "try again" conflict error.
    if (isBookingContentionError(e)) {
      return { success: false, error: "This time slot is no longer available, please try again" }
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

    await assertClientOwned(parsedClientId, businessId)

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
