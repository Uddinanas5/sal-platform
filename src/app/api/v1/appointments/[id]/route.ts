import { withV1Auth } from "@/lib/api/auth"
import { apiSuccess, ERRORS } from "@/lib/api/response"
import { prisma } from "@/lib/prisma"
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
    const effectiveStaffId = parsed.data.newStaffId ?? appointment.services[0]?.staffId

    try {
      await prisma.$transaction(async (tx) => {
        if (effectiveStaffId) {
          const conflicting = await tx.appointmentService.findFirst({
            where: {
              staffId: effectiveStaffId,
              appointmentId: { not: id },
              appointment: { status: { notIn: ["cancelled", "no_show"] } },
              startTime: { lt: endTime },
              endTime: { gt: startTime },
            },
          })
          if (conflicting) throw new Error("CONFLICT")
        }

        await tx.appointment.update({
          where: { id, businessId: ctx.businessId },
          data: { startTime, endTime },
        })

        if (appointment.services[0]) {
          const updateData: Record<string, unknown> = { startTime, endTime }
          if (parsed.data.newStaffId) updateData.staffId = parsed.data.newStaffId
          await tx.appointmentService.update({ where: { id: appointment.services[0].id }, data: updateData })
        }
      })
      return apiSuccess({ rescheduled: true })
    } catch (e) {
      if ((e as Error).message === "CONFLICT") {
        return ERRORS.BAD_REQUEST("This time slot is already booked for the selected staff member")
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
