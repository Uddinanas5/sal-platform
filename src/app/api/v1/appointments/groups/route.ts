import { withV1Auth } from "@/lib/api/auth"
import { apiSuccess, ERRORS } from "@/lib/api/response"
import { prisma } from "@/lib/prisma"
import { lockStaffSchedule } from "@/lib/db/advisory-lock"
import { trackedTransaction } from "@/lib/db/transaction-side-effects"
import { generateBookingReference } from "@/lib/booking-reference"
import { hasRole } from "@/lib/permissions"
import { z } from "zod"

const createGroupSchema = z.object({
  serviceId: z.string().uuid(),
  staffId: z.string().uuid(),
  startTime: z.string().min(1),
  maxParticipants: z.number().int().positive(),
  clientIds: z.array(z.string().uuid()).min(1),
  notes: z.string().optional(),
})

export async function POST(req: Request) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()

  let body: unknown
  try { body = await req.json() } catch { return ERRORS.BAD_REQUEST("Invalid JSON") }

  const parsed = createGroupSchema.safeParse(body)
  if (!parsed.success) return ERRORS.BAD_REQUEST(parsed.error.issues[0]?.message ?? "Invalid input")

  const { serviceId, staffId, startTime: startTimeStr, maxParticipants, clientIds, notes } = parsed.data

  if (clientIds.length > maxParticipants) return ERRORS.BAD_REQUEST("Too many participants")
  if (new Set(clientIds).size !== clientIds.length) return ERRORS.BAD_REQUEST("Duplicate participants are not allowed")

  const [service, staff, clientCount] = await Promise.all([
    prisma.service.findFirst({ where: { id: serviceId, businessId: ctx.businessId, deletedAt: null } }),
    prisma.staff.findFirst({
      where: { id: staffId, primaryLocation: { businessId: ctx.businessId }, isActive: true, deletedAt: null },
    }),
    prisma.client.count({
      where: { id: { in: clientIds }, businessId: ctx.businessId, deletedAt: null },
    }),
  ])
  if (!service) return ERRORS.NOT_FOUND("Service")
  if (!staff) return ERRORS.NOT_FOUND("Staff")
  if (!hasRole(ctx.role, "admin") && staff.userId !== ctx.userId) {
    return ERRORS.FORBIDDEN()
  }
  if (clientCount !== new Set(clientIds).size) return ERRORS.NOT_FOUND("Client")

  const location = await prisma.location.findFirst({ where: { businessId: ctx.businessId } })
  if (!location) return ERRORS.BAD_REQUEST("Business not configured")

  const startTime = new Date(startTimeStr)
  const endTime = new Date(startTime)
  endTime.setMinutes(endTime.getMinutes() + service.durationMinutes)

  const price = Number(service.price)
  const taxRate = service.isTaxable && service.taxRate ? Number(service.taxRate) / 100 : 0
  const tax = Math.round(price * taxRate * 100) / 100
  try {
    const appointment = await trackedTransaction(prisma, async (tx) => {
      await lockStaffSchedule(tx, ctx.businessId, staffId)

      const conflicting = await tx.appointmentService.findFirst({
        where: {
          staffId,
          appointment: { status: { notIn: ["cancelled", "no_show"] } },
          startTime: { lt: endTime },
          endTime: { gt: startTime },
        },
      })
      if (conflicting) throw new Error("CONFLICT")

      const appt = await tx.appointment.create({
        data: {
          businessId: ctx.businessId,
          locationId: location.id,
          clientId: clientIds[0],
          bookingReference: generateBookingReference(),
          status: "confirmed",
          source: "pos",
          startTime,
          endTime,
          totalDuration: service.durationMinutes,
          subtotal: price * clientIds.length,
          taxAmount: tax * clientIds.length,
          totalAmount: (price + tax) * clientIds.length,
          notes,
          isGroupBooking: true,
          maxParticipants,
        },
      })

      await tx.appointmentService.create({
        data: {
          appointmentId: appt.id,
          serviceId,
          staffId,
          name: service.name,
          durationMinutes: service.durationMinutes,
          price,
          finalPrice: price,
          startTime,
          endTime,
        },
      })

      for (const clientId of clientIds) {
        await tx.groupParticipant.create({
          data: { appointmentId: appt.id, clientId },
        })
      }

      return appt
    })

    return apiSuccess({ id: appointment.id, participantCount: clientIds.length }, 201)
  } catch (e) {
    if ((e as Error).message === "CONFLICT") {
      return ERRORS.BAD_REQUEST("This time slot is already booked for the selected staff member")
    }
    console.error("POST /api/v1/appointments/groups error:", e)
    return ERRORS.SERVER_ERROR()
  }
}
