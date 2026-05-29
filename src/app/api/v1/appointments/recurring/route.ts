import { withV1Auth } from "@/lib/api/auth"
import { apiSuccess, ERRORS } from "@/lib/api/response"
import { prisma } from "@/lib/prisma"
import { addWeeks, addMonths } from "date-fns"
import { z } from "zod"

const createRecurringSchema = z.object({
  clientId: z.string().uuid(),
  serviceId: z.string().uuid(),
  staffId: z.string().uuid(),
  startTime: z.string().min(1),
  notes: z.string().optional(),
  recurrenceRule: z.enum(["weekly", "biweekly", "monthly"]),
  recurrenceEndDate: z.string().min(1),
})

export async function POST(req: Request) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()

  let body: unknown
  try { body = await req.json() } catch { return ERRORS.BAD_REQUEST("Invalid JSON") }

  const parsed = createRecurringSchema.safeParse(body)
  if (!parsed.success) return ERRORS.BAD_REQUEST(parsed.error.issues[0]?.message ?? "Invalid input")

  const { clientId, serviceId, staffId, startTime: startTimeStr, notes, recurrenceRule, recurrenceEndDate } = parsed.data

  const service = await prisma.service.findFirst({
    where: { id: serviceId, businessId: ctx.businessId },
  })
  if (!service) return ERRORS.NOT_FOUND("Service")

  const client = await prisma.client.findFirst({
    where: { id: clientId, businessId: ctx.businessId },
    select: { id: true },
  })
  if (!client) return ERRORS.NOT_FOUND("Client")

  const staffRecord = await prisma.staff.findFirst({
    where: {
      id: staffId,
      primaryLocation: { businessId: ctx.businessId },
      staffServices: { some: { serviceId, isActive: true } },
    },
    select: { id: true },
  })
  if (!staffRecord) return ERRORS.NOT_FOUND("Staff")

  const location = await prisma.location.findFirst({ where: { businessId: ctx.businessId } })
  if (!location) return ERRORS.BAD_REQUEST("Business not configured")

  const baseStart = new Date(startTimeStr)
  const endDate = new Date(recurrenceEndDate)
  const price = Number(service.price)
  const taxRate = service.isTaxable && service.taxRate ? Number(service.taxRate) / 100 : 0
  const tax = Math.round(price * taxRate * 100) / 100
  const seriesId = crypto.randomUUID()

  const dates: Date[] = [baseStart]
  let next = baseStart
  while (true) {
    if (recurrenceRule === "weekly") next = addWeeks(next, 1)
    else if (recurrenceRule === "biweekly") next = addWeeks(next, 2)
    else next = addMonths(next, 1)
    if (next > endDate) break
    dates.push(next)
    if (dates.length > 52) break
  }

  // Atomic series creation: any single conflict aborts the whole batch,
  // leaving no orphaned occurrences. Conflict check is tenant-scoped via
  // `appointment.businessId` so a foreign staff's calendar can't be probed.
  try {
    const created = await prisma.$transaction(async (tx) => {
      const ids: string[] = []
      let parentId: string | null = null

      for (let i = 0; i < dates.length; i++) {
        const occurrenceStart = dates[i]
        const occurrenceEnd = new Date(occurrenceStart)
        occurrenceEnd.setMinutes(occurrenceEnd.getMinutes() + service.durationMinutes)

        const conflicting = await tx.appointmentService.findFirst({
          where: {
            staffId,
            appointment: {
              businessId: ctx.businessId,
              status: { notIn: ["cancelled", "no_show"] },
            },
            startTime: { lt: occurrenceEnd },
            endTime: { gt: occurrenceStart },
          },
          select: { id: true },
        })
        if (conflicting) {
          throw new Error(`CONFLICT:${occurrenceStart.toISOString()}`)
        }

        const timestamp = Date.now().toString(36)
        const random = Math.random().toString(36).substring(2, 6)
        const bookingRef = `SAL-${timestamp}-${random}-${i}`.toUpperCase()

        const appt: { id: string } = await tx.appointment.create({
          data: {
            businessId: ctx.businessId,
            locationId: location.id,
            clientId,
            bookingReference: bookingRef,
            status: "confirmed",
            source: "pos",
            startTime: occurrenceStart,
            endTime: occurrenceEnd,
            totalDuration: service.durationMinutes,
            subtotal: price,
            taxAmount: tax,
            totalAmount: price + tax,
            notes,
            recurrenceRule,
            recurrenceEndDate: endDate,
            seriesId,
            parentAppointmentId: parentId,
          },
          select: { id: true },
        })

        if (i === 0) parentId = appt.id

        await tx.appointmentService.create({
          data: {
            appointmentId: appt.id,
            serviceId,
            staffId,
            name: service.name,
            durationMinutes: service.durationMinutes,
            price,
            finalPrice: price,
            startTime: occurrenceStart,
            endTime: occurrenceEnd,
          },
        })

        ids.push(appt.id)
      }

      return ids
    })

    return apiSuccess({ ids: created, count: created.length, seriesId }, 201)
  } catch (e) {
    const msg = (e as Error).message
    if (msg.startsWith("CONFLICT:")) {
      const when = msg.slice("CONFLICT:".length)
      return ERRORS.BAD_REQUEST(`Time slot conflict at ${when} — series not created`)
    }
    console.error("POST /api/v1/appointments/recurring error:", e)
    return ERRORS.SERVER_ERROR()
  }
}
