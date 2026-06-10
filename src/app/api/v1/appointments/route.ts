import { withV1Auth } from "@/lib/api/auth"
import { apiError, apiSuccess, apiPaginated, ERRORS } from "@/lib/api/response"
import { prisma } from "@/lib/prisma"
import { lockStaffSchedule, isBookingContentionError } from "@/lib/db/advisory-lock"
import {
  assertSlotAllowed,
  ERR_OUTSIDE_WORKING_HOURS,
  ERR_ON_APPROVED_TIME_OFF,
} from "@/lib/scheduling/working-hours"
import { sendEmail } from "@/lib/email"
import { bookingConfirmationEmail } from "@/lib/email-templates"
import { formatInZone, combineDateWithTimeZoned } from "@/lib/scheduling/zoned-time"
import { parseYmd } from "@/lib/date-utils"

// Canonical UTC-midnight @db.Time value, combined with a civil day to derive
// salon-local day boundaries.
const ZERO_TIME = new Date(Date.UTC(1970, 0, 1, 0, 0, 0, 0))
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

  const where: Record<string, unknown> = { businessId: ctx.businessId }
  if (clientId) where.clientId = clientId
  if (status) where.status = status
  if (dateFrom || dateTo) {
    // Strict YYYY-MM-DD parse — `new Date('2026-06-31')` silently rolls to
    // July 1, so we reject impossible dates with a 400 instead. Day boundaries
    // are computed in the SALON's timezone (not the server's), so a date filter
    // selects the salon's calendar day rather than a UTC-shifted window.
    const biz = await prisma.business.findUnique({
      where: { id: ctx.businessId },
      select: { timezone: true },
    })
    const tz = biz?.timezone || "UTC"
    let gte: Date | undefined
    let lte: Date | undefined
    if (dateFrom) {
      const from = parseYmd(dateFrom)
      if (!from) return ERRORS.BAD_REQUEST("Invalid dateFrom. Use YYYY-MM-DD")
      gte = combineDateWithTimeZoned(from, ZERO_TIME, tz)
    }
    if (dateTo) {
      const to = parseYmd(dateTo)
      if (!to) return ERRORS.BAD_REQUEST("Invalid dateTo. Use YYYY-MM-DD")
      const nextDay = new Date(to.getFullYear(), to.getMonth(), to.getDate() + 1)
      lte = new Date(combineDateWithTimeZoned(nextDay, ZERO_TIME, tz).getTime() - 1)
    }
    where.startTime = {
      ...(gte ? { gte } : {}),
      ...(lte ? { lte } : {}),
    }
  }
  // Staff role: ALWAYS scope to the caller's own appointments, ignoring any
  // client-supplied `staffId` (a staff user must not read a colleague's
  // appointments + client PII via ?staffId=<colleagueId>). Admin/owner may
  // filter by an arbitrary staffId.
  if (ctx.role === "staff") {
    const staffProfile = await prisma.staff.findFirst({
      where: { userId: ctx.userId, isActive: true },
      select: { id: true },
    })
    // No active staff profile => deny access to all (empty result) rather than
    // falling through unfiltered and returning every tenant appointment.
    where.services = { some: { staffId: staffProfile?.id ?? "__none__" } }
  } else if (staffId) {
    where.services = { some: { staffId } }
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

  // Scope every entity lookup by caller's business — prevents cross-tenant
  // booking creation and frankenstein-mix (e.g. biz-A service + biz-B staff).
  const service = await prisma.service.findFirst({
    where: { id: serviceId, businessId: ctx.businessId, deletedAt: null },
  })
  if (!service) return ERRORS.NOT_FOUND("Service")

  const client = await prisma.client.findFirst({
    where: { id: clientId, businessId: ctx.businessId },
    select: { id: true },
  })
  if (!client) return ERRORS.NOT_FOUND("Client")

  // Staff has no direct businessId — route through primaryLocation.
  // Also verify staffServices link: this staff must be allowed to do this service.
  const staffRecord = await prisma.staff.findFirst({
    where: {
      id: staffId,
      primaryLocation: { businessId: ctx.businessId },
      staffServices: { some: { serviceId, isActive: true } },
    },
    select: { id: true },
  })
  if (!staffRecord) return ERRORS.NOT_FOUND("Staff")

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
      // Serialize concurrent writes for this staff member so the conflict
      // check + create below cannot race a parallel booking (BOOKING-CONCURRENCY-001).
      await lockStaffSchedule(tx, ctx.businessId, staffId)
      // Enforce the SAME working-hours / break / approved-time-off guard the
      // server actions use (BOOKING-RESIDUAL). Without this, a crafted startTime
      // via the API can book a client onto a barber's lunch, day off, after
      // close, or approved time-off. Ordering mirrors the actions: lock ->
      // assertSlotAllowed -> conflict check. The salon timezone anchors the
      // @db.Time hours to the salon's clock (not the server's) on any host.
      await assertSlotAllowed(tx, staffId, location.id, startTime, endTime, business.timezone)
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
    }, { timeout: 20000, maxWait: 15000 })

    // Send confirmation email (non-blocking). Re-fetch is tenant-scoped as
    // defense-in-depth: upstream gates already prove these IDs belong to
    // ctx.businessId, but scoping here prevents a future refactor from
    // silently leaking foreign rows into the email body.
    const [emailClient, emailStaff] = await Promise.all([
      prisma.client.findFirst({ where: { id: clientId, businessId: ctx.businessId } }),
      prisma.staff.findFirst({
        where: { id: staffId, primaryLocation: { businessId: ctx.businessId } },
        include: { user: true },
      }),
    ])
    if (emailClient?.email) {
      // Render the appointment time in the SALON's timezone so a 9am-ET booking
      // never emails as "1:00 PM" on a UTC host.
      const dateTime = formatInZone(startTime, business.timezone, {
        weekday: "long", month: "long", day: "numeric", year: "numeric",
        hour: "numeric", minute: "2-digit", hour12: true,
      })
      sendEmail({
        to: emailClient.email,
        subject: `Booking Confirmed - ${service.name}`,
        html: bookingConfirmationEmail({
          clientName: `${emailClient.firstName} ${emailClient.lastName}`,
          serviceName: service.name,
          staffName: emailStaff ? `${emailStaff.user.firstName} ${emailStaff.user.lastName}` : "Our team",
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
    // Under heavy concurrent contention the advisory-lock serialization can push
    // a queued request past the interactive-transaction timeout (P2028) or trip
    // a write-conflict/deadlock retry (P2034). Integrity is intact — one booking
    // still won — so surface the same clean conflict 400, not a 500.
    if (isBookingContentionError(e)) {
      return ERRORS.BAD_REQUEST("This time slot is no longer available, please try again")
    }
    console.error("POST /api/v1/appointments error:", e)
    return ERRORS.SERVER_ERROR()
  }
}
