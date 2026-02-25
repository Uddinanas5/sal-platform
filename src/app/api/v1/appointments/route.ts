import { withV1Auth } from "@/lib/api/auth"
import { apiSuccess, apiPaginated, ERRORS } from "@/lib/api/response"
import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"
import { bookingConfirmationEmail } from "@/lib/email-templates"
import { z } from "zod"

const createAppointmentSchema = z.object({
  clientId: z.string().uuid(),
  serviceId: z.string().uuid(),
  staffId: z.string().uuid(),
  startTime: z.string().min(1),
  notes: z.string().optional(),
})

export async function GET(req: Request) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()

  const url = new URL(req.url)
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"))
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20")))
  const staffId = url.searchParams.get("staffId")
  const clientId = url.searchParams.get("clientId")
  const status = url.searchParams.get("status")
  const dateFrom = url.searchParams.get("dateFrom")
  const dateTo = url.searchParams.get("dateTo")

  // Staff role: only their own appointments
  const effectiveStaffId = ctx.role === "staff" ? staffId ?? undefined : staffId ?? undefined

  const where: Record<string, unknown> = { businessId: ctx.businessId }
  if (clientId) where.clientId = clientId
  if (status) where.status = status
  if (dateFrom || dateTo) {
    where.startTime = {
      ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
      ...(dateTo ? { lte: new Date(dateTo) } : {}),
    }
  }
  if (effectiveStaffId) {
    where.services = { some: { staffId: effectiveStaffId } }
  } else if (ctx.role === "staff") {
    // Staff can only see their own appointments; find their staffId
    const staffProfile = await prisma.staff.findFirst({
      where: { userId: ctx.userId, isActive: true },
    })
    if (staffProfile) {
      where.services = { some: { staffId: staffProfile.id } }
    }
  }

  const [appointments, total] = await Promise.all([
    prisma.appointment.findMany({
      where: where as never,
      include: {
        client: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        services: {
          include: {
            service: { select: { id: true, name: true, color: true } },
            staff: { include: { user: { select: { firstName: true, lastName: true } } } },
          },
        },
      },
      orderBy: { startTime: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.appointment.count({ where: where as never }),
  ])

  return apiPaginated(appointments, { page, limit, total })
}

export async function POST(req: Request) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()

  let body: unknown
  try { body = await req.json() } catch { return ERRORS.BAD_REQUEST("Invalid JSON") }

  const parsed = createAppointmentSchema.safeParse(body)
  if (!parsed.success) return ERRORS.BAD_REQUEST(parsed.error.issues[0]?.message ?? "Invalid input")

  const { clientId, serviceId, staffId, startTime: startTimeStr, notes } = parsed.data

  const service = await prisma.service.findUnique({ where: { id: serviceId } })
  if (!service) return ERRORS.NOT_FOUND("Service")

  const [business, location] = await Promise.all([
    prisma.business.findUnique({ where: { id: ctx.businessId } }),
    prisma.location.findFirst({ where: { businessId: ctx.businessId } }),
  ])
  if (!business || !location) return ERRORS.BAD_REQUEST("Business not configured")

  const startTime = new Date(startTimeStr)
  const endTime = new Date(startTime)
  endTime.setMinutes(endTime.getMinutes() + service.durationMinutes)

  const price = Number(service.price)
  const taxRate = service.isTaxable && service.taxRate ? Number(service.taxRate) / 100 : 0
  const tax = Math.round(price * taxRate * 100) / 100

  try {
    const appointment = await prisma.$transaction(async (tx) => {
      const conflicting = await tx.appointmentService.findFirst({
        where: {
          staffId,
          appointment: { status: { notIn: ["cancelled", "no_show"] } },
          startTime: { lt: endTime },
          endTime: { gt: startTime },
        },
      })
      if (conflicting) throw new Error("CONFLICT")

      const timestamp = Date.now().toString(36)
      const random = Math.random().toString(36).substring(2, 6)
      const bookingRef = `SAL-${timestamp}-${random}`.toUpperCase()

      const appt = await tx.appointment.create({
        data: {
          businessId: ctx.businessId,
          locationId: location.id,
          clientId,
          bookingReference: bookingRef,
          status: "confirmed",
          source: "pos",
          startTime,
          endTime,
          totalDuration: service.durationMinutes,
          subtotal: price,
          taxAmount: tax,
          totalAmount: price + tax,
          notes,
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

      return appt
    })

    // Send confirmation email (non-blocking)
    const [client, staff] = await Promise.all([
      prisma.client.findUnique({ where: { id: clientId } }),
      prisma.staff.findUnique({ where: { id: staffId }, include: { user: true } }),
    ])
    if (client?.email) {
      const dateTime = new Intl.DateTimeFormat("en-US", {
        weekday: "long", month: "long", day: "numeric", year: "numeric",
        hour: "numeric", minute: "2-digit", hour12: true,
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
          businessEmail: business.email ?? undefined,
          businessPhone: business.phone ?? undefined,
        }),
      }).catch(console.error)
    }

    return apiSuccess(appointment, 201)
  } catch (e) {
    if ((e as Error).message === "CONFLICT") {
      return ERRORS.BAD_REQUEST("This time slot is already booked for the selected staff member")
    }
    console.error("POST /api/v1/appointments error:", e)
    return ERRORS.SERVER_ERROR()
  }
}
