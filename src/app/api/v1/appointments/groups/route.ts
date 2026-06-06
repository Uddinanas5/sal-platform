import { withV1Auth } from "@/lib/api/auth"
import { apiError, apiSuccess, ERRORS } from "@/lib/api/response"
import { prisma } from "@/lib/prisma"
import { lockStaffSchedule, isBookingContentionError } from "@/lib/db/advisory-lock"
import {
  assertSlotAllowed,
  ERR_OUTSIDE_WORKING_HOURS,
  ERR_ON_APPROVED_TIME_OFF,
} from "@/lib/scheduling/working-hours"
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

  const service = await prisma.service.findFirst({
    where: { id: serviceId, businessId: ctx.businessId },
  })
  if (!service) return ERRORS.NOT_FOUND("Service")

  const staffRecord = await prisma.staff.findFirst({
    where: {
      id: staffId,
      primaryLocation: { businessId: ctx.businessId },
      staffServices: { some: { serviceId, isActive: true } },
    },
    select: { id: true },
  })
  if (!staffRecord) return ERRORS.NOT_FOUND("Staff")

  const clientsInBiz = await prisma.client.count({
    where: { id: { in: clientIds }, businessId: ctx.businessId },
  })
  if (clientsInBiz !== clientIds.length) return ERRORS.NOT_FOUND("Client")

  const [location, business] = await Promise.all([
    prisma.location.findFirst({ where: { businessId: ctx.businessId } }),
    prisma.business.findUnique({ where: { id: ctx.businessId }, select: { timezone: true } }),
  ])
  if (!location) return ERRORS.BAD_REQUEST("Business not configured")
  // Salon IANA timezone anchors assertSlotAllowed's @db.Time hours to the
  // salon's clock (not the server's) on any host.
  const timezone = business?.timezone ?? "UTC"

  const startTime = new Date(startTimeStr)
  const endTime = new Date(startTime)
  endTime.setMinutes(endTime.getMinutes() + service.durationMinutes)

  const price = Number(service.price)
  const taxRate = service.isTaxable && service.taxRate ? Number(service.taxRate) / 100 : 0
  const tax = Math.round(price * taxRate * 100) / 100
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 6)
  const bookingRef = `SAL-${timestamp}-${random}`.toUpperCase()

  try {
    const appointmentId = await prisma.$transaction(async (tx) => {
      // Serialize concurrent writes for this staff, then enforce the SAME
      // working-hours / break / approved-time-off guard the server actions use
      // (BOOKING-RESIDUAL) before the conflict check. Ordering mirrors the
      // actions: lock -> assertSlotAllowed -> conflict check.
      await lockStaffSchedule(tx, ctx.businessId, staffId)
      await assertSlotAllowed(tx, staffId, location.id, startTime, endTime, timezone)
      // Tenant-scoped conflict check on the staff slot. Without this a group
      // booking can silently double-book the stylist (and on a 12-person group
      // that's a much louder calendar collision than a single booking).
      const conflicting = await tx.appointmentService.findFirst({
        where: {
          staffId,
          appointment: {
            businessId: ctx.businessId,
            status: { notIn: ["cancelled", "no_show"] },
          },
          startTime: { lt: endTime },
          endTime: { gt: startTime },
        },
      })
      if (conflicting) throw new Error("CONFLICT")

      const appointment = await tx.appointment.create({
        data: {
          businessId: ctx.businessId,
          locationId: location.id,
          clientId: clientIds[0],
          bookingReference: bookingRef,
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
          appointmentId: appointment.id,
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

      await tx.groupParticipant.createMany({
        data: clientIds.map((clientId) => ({ appointmentId: appointment.id, clientId })),
      })

      return appointment.id
    }, { timeout: 20000, maxWait: 15000 })

    return apiSuccess({ id: appointmentId, participantCount: clientIds.length }, 201)
  } catch (e) {
    const msg = (e as Error).message
    if (msg === "CONFLICT") {
      return ERRORS.BAD_REQUEST("This time slot is already booked for the selected staff member")
    }
    if (msg === ERR_OUTSIDE_WORKING_HOURS) {
      return apiError("OUTSIDE_WORKING_HOURS", "Outside the staff member's working hours", 400)
    }
    if (msg === ERR_ON_APPROVED_TIME_OFF) {
      return apiError("ON_APPROVED_TIME_OFF", "Staff member has approved time off during this slot", 400)
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
