import { withV1Auth } from "@/lib/api/auth"
import { apiSuccess, ERRORS } from "@/lib/api/response"
import { prisma } from "@/lib/prisma"
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

  const service = await prisma.service.findUnique({ where: { id: serviceId } })
  if (!service) return ERRORS.NOT_FOUND("Service")

  const location = await prisma.location.findFirst({ where: { businessId: ctx.businessId } })
  if (!location) return ERRORS.BAD_REQUEST("Business not configured")

  const startTime = new Date(startTimeStr)
  const endTime = new Date(startTime)
  endTime.setMinutes(endTime.getMinutes() + service.durationMinutes)

  const price = Number(service.price)
  const taxRate = service.isTaxable && service.taxRate ? Number(service.taxRate) / 100 : 0
  const tax = Math.round(price * taxRate * 100) / 100
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 6)
  const bookingRef = `SAL-${timestamp}-${random}`.toUpperCase()

  const appointment = await prisma.appointment.create({
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

  await prisma.appointmentService.create({
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

  for (const clientId of clientIds) {
    await prisma.groupParticipant.create({
      data: { appointmentId: appointment.id, clientId },
    })
  }

  return apiSuccess({ id: appointment.id, participantCount: clientIds.length }, 201)
}
