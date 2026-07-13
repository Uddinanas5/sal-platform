import { withV1Auth } from "@/lib/api/auth"
import { apiError, apiSuccess, ERRORS } from "@/lib/api/response"
import { canAccessAppointment } from "@/lib/api/appointment-access"
import { assertStaffOwned } from "@/lib/ownership"
import { prisma } from "@/lib/prisma"
import { lockStaffSchedule, isBookingContentionError } from "@/lib/db/advisory-lock"
import {
  assertSlotAllowed,
  ERR_OUTSIDE_WORKING_HOURS,
  ERR_ON_APPROVED_TIME_OFF,
} from "@/lib/scheduling/working-hours"
import { z } from "zod"

const statusSchema = z.object({
  status: z.enum(["confirmed", "pending", "checked_in", "in_progress", "completed", "cancelled", "no_show"]),
})

const rescheduleSchema = z.object({
  newStart: z.string().min(1),
  newStaffId: z.string().uuid().optional(),
})

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()
  const { id } = await params
  if (!(await canAccessAppointment(ctx, id))) return ERRORS.FORBIDDEN()

  const appointment = await prisma.appointment.findUnique({
    where: { id, businessId: ctx.businessId },
    include: {
      client: true,
      services: {
        include: {
          service: true,
          staff: { include: { user: true } },
        },
      },
      payments: true,
    },
  })

  if (!appointment) return ERRORS.NOT_FOUND("Appointment")
  return apiSuccess(appointment)
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()
  const { id } = await params
  if (!(await canAccessAppointment(ctx, id))) return ERRORS.FORBIDDEN()

  let body: unknown
  try { body = await req.json() } catch { return ERRORS.BAD_REQUEST("Invalid JSON") }

  const url = new URL(req.url)
  const action = url.searchParams.get("action")

  if (action === "reschedule") {
    const parsed = rescheduleSchema.safeParse(body)
    if (!parsed.success) return ERRORS.BAD_REQUEST(parsed.error.issues[0]?.message ?? "Invalid input")

    const appointment = await prisma.appointment.findUnique({
      where: { id, businessId: ctx.businessId },
      include: { services: true, business: { select: { timezone: true } } },
    })
    if (!appointment) return ERRORS.NOT_FOUND("Appointment")

    const startTime = new Date(parsed.data.newStart)
    const endTime = new Date(startTime)
    endTime.setMinutes(endTime.getMinutes() + appointment.totalDuration)
    const deltaMs = startTime.getTime() - appointment.startTime.getTime()

    // Block the cross-tenant oracle: if a foreign staffId is supplied, fail
    // with the same NOT_FOUND body the missing-appointment branch returns so
    // callers can't distinguish "wrong tenant" from "doesn't exist".
    if (parsed.data.newStaffId) {
      try {
        await assertStaffOwned(parsed.data.newStaffId, ctx.businessId)
      } catch {
        return ERRORS.NOT_FOUND("Appointment")
      }
    }

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
      // their original staff. The v1 contract has no per-service reassignment
      // field, so this is the implicit semantic — revisit if we ever add one.
      staffId: parsed.data.newStaffId && i === 0 ? parsed.data.newStaffId : s.staffId,
      applyStaffUpdate: Boolean(parsed.data.newStaffId && i === 0),
    }))

    try {
      await prisma.$transaction(async (tx) => {
        // Lock every involved staff member (sorted, to avoid deadlocks) before
        // the conflict checks so this reschedule serializes against concurrent
        // create/reschedule on the same staff (BOOKING-CONCURRENCY-001).
        const uniqueStaffIds = Array.from(
          new Set(serviceUpdates.map((s) => s.staffId).filter(Boolean) as string[]),
        ).sort()
        for (const sid of uniqueStaffIds) {
          await lockStaffSchedule(tx, ctx.businessId, sid)
        }

        for (const su of serviceUpdates) {
          if (!su.staffId) continue
          // Salon timezone anchors the @db.Time working-hours window on any host.
          await assertSlotAllowed(tx, su.staffId, appointment.locationId, su.startTime, su.endTime, appointment.business.timezone)
          const conflicting = await tx.appointmentService.findFirst({
            where: {
              staffId: su.staffId,
              appointmentId: { not: id },
              appointment: {
                businessId: ctx.businessId,
                status: { notIn: ["cancelled", "no_show"] },
              },
              startTime: { lt: su.endTime },
              endTime: { gt: su.startTime },
            },
          })
          if (conflicting) throw new Error("CONFLICT")
        }

        await tx.appointment.update({
          where: { id, businessId: ctx.businessId },
          data: { startTime, endTime },
        })

        for (const su of serviceUpdates) {
          const updateData: Record<string, unknown> = {
            startTime: su.startTime,
            endTime: su.endTime,
          }
          if (su.applyStaffUpdate) updateData.staffId = su.staffId
          await tx.appointmentService.update({ where: { id: su.id }, data: updateData })
        }
      }, { timeout: 20000, maxWait: 15000 })
      return apiSuccess({ rescheduled: true })
    } catch (e) {
      const msg = (e as Error).message
      if (msg === "CONFLICT") {
        return ERRORS.BAD_REQUEST("This time slot is already booked for the selected staff member")
      }
      if (msg === ERR_OUTSIDE_WORKING_HOURS) {
        return apiError("OUTSIDE_WORKING_HOURS", "Reschedule falls outside the staff member's working hours", 400)
      }
      if (msg === ERR_ON_APPROVED_TIME_OFF) {
        return apiError("ON_APPROVED_TIME_OFF", "Reschedule overlaps approved staff time off", 400)
      }
      // Concurrency contention behind the advisory lock (tx timeout P2028 /
      // write-conflict P2034) is not an integrity failure — map it to the same
      // clean conflict 400 instead of a 500.
      if (isBookingContentionError(e)) {
        return ERRORS.BAD_REQUEST("This time slot is no longer available, please try again")
      }
      return ERRORS.SERVER_ERROR()
    }
  }

  // Default: update status
  const parsed = statusSchema.safeParse(body)
  if (!parsed.success) return ERRORS.BAD_REQUEST(parsed.error.issues[0]?.message ?? "Invalid input")

  const newStatus = parsed.data.status
  const data = {
    status: newStatus as never,
    completedAt: newStatus === "completed" ? new Date() : undefined,
    checkedInAt: newStatus === "checked_in" ? new Date() : undefined,
    cancelledAt: newStatus === "cancelled" ? new Date() : undefined,
    noShowAt: newStatus === "no_show" ? new Date() : undefined,
  }
  // On reactivation (cancelled/no_show → active), clear stale cancellation fields
  // with explicit null (Prisma omits undefined) — mirrors the server action.
  const reactivationData = {
    ...data,
    cancelledAt: null,
    noShowAt: null,
    cancellationInitiator: null,
    cancellationReasonCode: null,
    cancellationReason: null,
    cancelledBy: null,
  }

  try {
    // Reactivation guard: cancelled/no_show free the slot, so reactivating must
    // re-check for conflicts under the advisory lock (mirrors the server action).
    const FREE = ["cancelled", "no_show"]
    const ACTIVE = ["confirmed", "pending", "checked_in", "in_progress", "completed"]
    const current = await prisma.appointment.findUnique({
      where: { id, businessId: ctx.businessId },
      select: { status: true, services: { select: { staffId: true, startTime: true, endTime: true } } },
    })
    if (!current) return ERRORS.NOT_FOUND("Appointment")

    let appointment
    if (FREE.includes(current.status) && ACTIVE.includes(newStatus)) {
      appointment = await prisma.$transaction(async (tx) => {
        for (const svc of current.services) {
          if (!svc.staffId) continue
          await lockStaffSchedule(tx, ctx.businessId, svc.staffId)
          const conflict = await tx.appointmentService.findFirst({
            where: {
              staffId: svc.staffId,
              appointmentId: { not: id },
              appointment: { status: { notIn: ["cancelled", "no_show"] } },
              startTime: { lt: svc.endTime },
              endTime: { gt: svc.startTime },
            },
          })
          if (conflict) throw new Error("CONFLICT")
        }
        return tx.appointment.update({ where: { id, businessId: ctx.businessId }, data: reactivationData })
      }, { timeout: 20000, maxWait: 15000 })
    } else {
      appointment = await prisma.appointment.update({ where: { id, businessId: ctx.businessId }, data })
    }
    return apiSuccess(appointment)
  } catch (e) {
    if ((e as Error).message === "CONFLICT" || isBookingContentionError(e)) {
      return ERRORS.BAD_REQUEST("That time slot is no longer free — another appointment now occupies it.")
    }
    return ERRORS.NOT_FOUND("Appointment")
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()
  const { id } = await params
  if (!(await canAccessAppointment(ctx, id))) return ERRORS.FORBIDDEN()

  try {
    await prisma.appointment.update({
      where: { id, businessId: ctx.businessId },
      data: { status: "cancelled", cancelledAt: new Date() },
    })
    return apiSuccess({ cancelled: true })
  } catch {
    return ERRORS.NOT_FOUND("Appointment")
  }
}
