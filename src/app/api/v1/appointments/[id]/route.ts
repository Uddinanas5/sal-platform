import { withV1Auth } from "@/lib/api/auth"
import { apiError, apiSuccess, ERRORS } from "@/lib/api/response"
import { assertStaffOwned } from "@/lib/ownership"
import { prisma } from "@/lib/prisma"
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

  let body: unknown
  try { body = await req.json() } catch { return ERRORS.BAD_REQUEST("Invalid JSON") }

  const url = new URL(req.url)
  const action = url.searchParams.get("action")

  if (action === "reschedule") {
    const parsed = rescheduleSchema.safeParse(body)
    if (!parsed.success) return ERRORS.BAD_REQUEST(parsed.error.issues[0]?.message ?? "Invalid input")

    const appointment = await prisma.appointment.findUnique({
      where: { id, businessId: ctx.businessId },
      include: { services: true },
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
        for (const su of serviceUpdates) {
          if (!su.staffId) continue
          await assertSlotAllowed(tx, su.staffId, appointment.locationId, su.startTime, su.endTime)
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
      })
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
      return ERRORS.SERVER_ERROR()
    }
  }

  // Default: update status
  const parsed = statusSchema.safeParse(body)
  if (!parsed.success) return ERRORS.BAD_REQUEST(parsed.error.issues[0]?.message ?? "Invalid input")

  try {
    const appointment = await prisma.appointment.update({
      where: { id, businessId: ctx.businessId },
      data: {
        status: parsed.data.status as never,
        completedAt: parsed.data.status === "completed" ? new Date() : undefined,
        checkedInAt: parsed.data.status === "checked_in" ? new Date() : undefined,
        cancelledAt: parsed.data.status === "cancelled" ? new Date() : undefined,
        noShowAt: parsed.data.status === "no_show" ? new Date() : undefined,
      },
    })
    return apiSuccess(appointment)
  } catch {
    return ERRORS.NOT_FOUND("Appointment")
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()
  const { id } = await params

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
