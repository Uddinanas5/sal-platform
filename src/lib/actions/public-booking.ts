"use server"

import { prisma } from "@/lib/prisma"
import { rateLimit } from "@/lib/rate-limit"
import { sendEmail } from "@/lib/email"
import {
  bookingConfirmationEmail,
  appointmentCancelledEmail,
  appointmentRescheduledEmail,
} from "@/lib/email-templates"
import { revalidatePath } from "next/cache"
import { z, ZodError } from "zod"
import { lockStaffSchedule, isBookingContentionError } from "@/lib/db/advisory-lock"
import { generateBookingReference } from "@/lib/booking-reference"
import { isSlotAvailable } from "@/lib/availability"
import { getPublicBookingSettings } from "@/lib/actions/booking-settings"

// Mirrors the maps in the /api/availability route — kept in sync by hand (the
// values rarely change). The write path must honour the same lead-time and
// advance-window ceilings the read path advertises.
const LEAD_TIME_MINUTES: Record<string, number> = {
  none: 0, "1h": 60, "2h": 120, "4h": 240, "12h": 720, "24h": 1440, "48h": 2880,
}
const MAX_ADVANCE_DAYS: Record<string, number> = {
  "1w": 7, "2w": 14, "1m": 30, "2m": 60, "3m": 90,
}
// Cancellation window enum -> minutes before the appointment after which
// self-service cancellation/reschedule is no longer allowed. Same key set the
// booking settings schema validates (booking-settings.ts cancellationWindow).
const CANCELLATION_WINDOW_MINUTES: Record<string, number> = {
  none: 0, "1h": 60, "2h": 120, "4h": 240, "12h": 720, "24h": 1440, "48h": 2880,
}

// Render a minutes value as a friendly "24 hours" / "2 hours" / "30 minutes"
// label for client-facing cancellation-window messages.
function formatWindowLabel(minutes: number): string {
  if (minutes >= 60) {
    const hours = Math.round(minutes / 60)
    return `${hours} hour${hours === 1 ? "" : "s"}`
  }
  return `${minutes} minute${minutes === 1 ? "" : "s"}`
}
import {
  assertSlotAllowed,
  ERR_OUTSIDE_WORKING_HOURS,
  ERR_ON_APPROVED_TIME_OFF,
} from "@/lib/scheduling/working-hours"

const addToPublicWaitlistSchema = z.object({
  businessId: z.string().uuid(),
  serviceId: z.string().uuid(),
  staffId: z.string().uuid().optional(),
  preferredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  preferredTimeStart: z.string().optional(),
  preferredTimeEnd: z.string().optional(),
  clientFirstName: z.string().trim().min(1).max(100),
  clientLastName: z.string().trim().min(1).max(100),
  clientEmail: z.string().email().toLowerCase(),
  clientPhone: z.string().trim().max(30).optional(),
  notes: z.string().max(1000).optional(),
})

const createPublicBookingSchema = z.object({
  businessId: z.string().uuid(),
  serviceId: z.string().uuid(),
  staffId: z.string().uuid(),
  startTime: z.string().datetime(),
  clientFirstName: z.string().trim().min(1).max(100),
  clientLastName: z.string().trim().min(1).max(100),
  clientEmail: z.string().email().toLowerCase(),
  clientPhone: z.string().trim().min(1).max(30),
  notes: z.string().max(1000).optional(),
})

type ActionResult<T = void> = { success: true; data: T } | { success: false; error: string }

export async function createPublicBooking(data: {
  businessId: string
  serviceId: string
  staffId: string
  startTime: string
  clientFirstName: string
  clientLastName: string
  clientEmail: string
  clientPhone: string
  notes?: string
}): Promise<ActionResult<{ id: string; bookingReference: string }>> {
  try {
    // 0. Validate input
    const parsed = createPublicBookingSchema.parse(data)
    data = parsed

    // Rate limit by email: 5 bookings per hour per email
    const rl = rateLimit(`booking:${data.clientEmail}`, 5, 60 * 60 * 1000)
    if (rl.limited) {
      return { success: false, error: "Too many booking attempts. Please try again later." }
    }

    // 1. Get business & location
    const business = await prisma.business.findUnique({
      where: { id: data.businessId },
    })
    if (!business) return { success: false, error: "Business not found" }

    const location = await prisma.location.findFirst({
      where: { businessId: business.id, isActive: true },
      orderBy: { isPrimary: "desc" },
    })
    if (!location) return { success: false, error: "No active location found" }

    // 2. Get service details (verify it belongs to this business)
    const service = await prisma.service.findUnique({
      where: { id: data.serviceId, businessId: business.id },
    })
    if (!service) return { success: false, error: "Service not found" }

    // 2b. Verify staff belongs to this business via their location
    const staff = await prisma.staff.findFirst({
      where: { id: data.staffId, primaryLocation: { businessId: business.id } },
      include: { user: true },
    })
    if (!staff) return { success: false, error: "Staff not found" }

    // 2c. Verify the staff member actually performs this service (don't trust
    // the client — a crafted request could pair any staff with any service).
    const performsService = await prisma.staffService.findFirst({
      where: { staffId: data.staffId, serviceId: data.serviceId, isActive: true },
      select: { id: true },
    })
    if (!performsService) {
      return { success: false, error: "This staff member doesn't offer the selected service" }
    }

    // 2d. Full slot re-validation — never trust the client's startTime beyond the
    // subset assertSlotAllowed covers. The public UI only ever offers slots that
    // /api/availability produced; enforce the same here: not in the past, service
    // active + bookable online, and the slot is genuinely available (min lead
    // time, business hours, staff breaks, schedule, existing appointments,
    // canAcceptBookings). Done before client creation so invalid requests don't
    // leave orphaned client rows.
    const requestedStart = new Date(data.startTime)
    const bookingSettings = await getPublicBookingSettings(business.id)
    // Min lead time (covers past dates too: a 0-lead "none" still rejects < now).
    const leadMinutes = LEAD_TIME_MINUTES[bookingSettings.minLeadTime] ?? 30
    if (requestedStart.getTime() < Date.now() + leadMinutes * 60_000) {
      return { success: false, error: "That time is too soon to book. Please choose a later slot." }
    }
    // Max advance window.
    const maxDays = MAX_ADVANCE_DAYS[bookingSettings.maxAdvanceBooking] ?? 30
    const maxDate = new Date()
    maxDate.setHours(0, 0, 0, 0)
    maxDate.setDate(maxDate.getDate() + maxDays)
    if (requestedStart > maxDate) {
      return { success: false, error: `Bookings can only be made up to ${maxDays} days in advance.` }
    }
    if (!service.isActive || !service.isOnlineBooking) {
      return { success: false, error: "This service isn't available for online booking." }
    }
    const slotOk = await isSlotAvailable({
      staffId: data.staffId,
      serviceId: data.serviceId,
      startTime: requestedStart,
      locationId: location.id,
    })
    if (!slotOk) {
      return { success: false, error: "That time isn't available. Please choose another slot." }
    }

    // 3. Find or create client
    let client = await prisma.client.findFirst({
      where: {
        businessId: business.id,
        email: data.clientEmail.trim().toLowerCase(),
      },
    })

    if (!client) {
      client = await prisma.client.create({
        data: {
          businessId: business.id,
          firstName: data.clientFirstName.trim(),
          lastName: data.clientLastName.trim(),
          email: data.clientEmail.trim().toLowerCase(),
          phone: data.clientPhone.trim(),
          source: "online_booking",
        },
      })
    }

    // 4. Calculate times
    const startTime = new Date(data.startTime)
    const endTime = new Date(startTime)
    endTime.setMinutes(endTime.getMinutes() + service.durationMinutes)

    const price = Number(service.price)
    const taxRate = service.isTaxable && service.taxRate ? Number(service.taxRate) / 100 : 0
    const tax = Math.round(price * taxRate * 100) / 100

    // 5-7. Transaction: conflict check + create must be atomic
    const appointment = await prisma.$transaction(async (tx) => {
      await lockStaffSchedule(tx, business.id, data.staffId)
      // Re-validate the slot server-side (defense in depth): the public client
      // shows availability from /api/availability, but we never trust the
      // client — enforce the staff member's working hours + approved time off
      // here too, inside the lock.
      await assertSlotAllowed(tx, data.staffId, location.id, startTime, endTime)
      // Double-booking prevention
      const conflicting = await tx.appointmentService.findFirst({
        where: {
          staffId: data.staffId,
          appointment: {
            status: { notIn: ["cancelled", "no_show"] },
          },
          startTime: { lt: endTime },
          endTime: { gt: startTime },
        },
      })
      if (conflicting) {
        throw new Error("CONFLICT")
      }

      const bookingRef = generateBookingReference()

      const appt = await tx.appointment.create({
        data: {
          businessId: business.id,
          locationId: location.id,
          clientId: client.id,
          bookingReference: bookingRef,
          status: "confirmed",
          source: "online",
          startTime,
          endTime,
          totalDuration: service.durationMinutes,
          subtotal: price,
          taxAmount: tax,
          totalAmount: price + tax,
          notes: data.notes,
        },
      })

      await tx.appointmentService.create({
        data: {
          appointmentId: appt.id,
          serviceId: data.serviceId,
          staffId: data.staffId,
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

    // 8. Send booking confirmation email (non-blocking)
    if (client.email) {
      const dateTime = new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(startTime)

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
      const manageUrl = `${baseUrl}/book/manage/${appointment.bookingReference}`

      sendEmail({
        to: client.email,
        subject: `Booking Confirmed - ${service.name}`,
        html: bookingConfirmationEmail({
          clientName: `${client.firstName} ${client.lastName}`,
          serviceName: service.name,
          staffName: `${staff.user.firstName} ${staff.user.lastName}`,
          dateTime,
          businessName: business.name,
          bookingRef: appointment.bookingReference,
          manageUrl,
        }),
      }).catch(console.error) // Don't block on email failure
    }

    revalidatePath("/calendar")
    revalidatePath("/dashboard")

    return {
      success: true,
      data: { id: appointment.id, bookingReference: appointment.bookingReference },
    }
  } catch (e) {
    if (e instanceof ZodError) {
      return { success: false, error: "Invalid input" }
    }
    const msg = (e as Error).message
    if (msg === "CONFLICT") {
      return { success: false, error: "This time slot is already booked for the selected staff member" }
    }
    if (msg === ERR_OUTSIDE_WORKING_HOURS) {
      return { success: false, error: "That time is outside the staff member's working hours." }
    }
    if (msg === ERR_ON_APPROVED_TIME_OFF) {
      return { success: false, error: "That time is no longer available." }
    }
    // Concurrency contention behind the advisory lock (tx timeout P2028 /
    // write-conflict P2034) is not an integrity failure — surface the same
    // clean "try again" conflict error instead of the generic failure.
    if (isBookingContentionError(e)) {
      return { success: false, error: "This time slot is no longer available, please try again" }
    }
    console.error("createPublicBooking error:", e)
    return { success: false, error: "Failed to create booking. Please try again." }
  }
}

export async function addToPublicWaitlist(data: {
  businessId: string
  serviceId: string
  staffId?: string
  preferredDate: string
  preferredTimeStart?: string
  preferredTimeEnd?: string
  clientFirstName: string
  clientLastName: string
  clientEmail: string
  clientPhone?: string
  notes?: string
}): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = addToPublicWaitlistSchema.parse(data)

    // Rate limit: 5 waitlist entries per hour per email
    const rl = rateLimit(`waitlist:${parsed.clientEmail}`, 5, 60 * 60 * 1000)
    if (rl.limited) {
      return { success: false, error: "Too many requests. Please try again later." }
    }

    // Verify business exists
    const business = await prisma.business.findUnique({ where: { id: parsed.businessId } })
    if (!business) return { success: false, error: "Business not found" }

    // Verify service belongs to this business
    const service = await prisma.service.findUnique({
      where: { id: parsed.serviceId, businessId: business.id },
    })
    if (!service) return { success: false, error: "Service not found" }

    // Find or create client
    let client = await prisma.client.findFirst({
      where: { businessId: business.id, email: parsed.clientEmail },
    })
    if (!client) {
      client = await prisma.client.create({
        data: {
          businessId: business.id,
          firstName: parsed.clientFirstName.trim(),
          lastName: parsed.clientLastName.trim(),
          email: parsed.clientEmail,
          phone: parsed.clientPhone?.trim() ?? null,
          source: "online_booking",
        },
      })
    }

    const entry = await prisma.waitlistEntry.create({
      data: {
        businessId: business.id,
        clientId: client.id,
        serviceId: parsed.serviceId,
        staffId: parsed.staffId ?? null,
        preferredDate: new Date(parsed.preferredDate),
        preferredTimeStart: parsed.preferredTimeStart
          ? new Date(`1970-01-01T${parsed.preferredTimeStart}`)
          : null,
        preferredTimeEnd: parsed.preferredTimeEnd
          ? new Date(`1970-01-01T${parsed.preferredTimeEnd}`)
          : null,
        notes: parsed.notes ?? null,
        status: "waiting",
      },
    })

    revalidatePath("/calendar")
    return { success: true, data: { id: entry.id } }
  } catch (e) {
    if (e instanceof ZodError) {
      return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    }
    console.error("addToPublicWaitlist error:", e)
    return { success: false, error: "Failed to join waitlist. Please try again." }
  }
}

export async function cancelPublicBooking(
  bookingReference: string,
  clientEmail: string,
): Promise<ActionResult<{ status: string }>> {
  try {
    // Rate limit: 3 cancellation attempts per booking reference per 10 minutes
    const rl = rateLimit(`cancel:${bookingReference}`, 3, 10 * 60 * 1000)
    if (rl.limited) {
      return { success: false, error: "Too many cancellation attempts. Please try again later." }
    }

    const appointment = await prisma.appointment.findUnique({
      where: { bookingReference },
      include: {
        client: { select: { email: true, firstName: true, lastName: true } },
        business: { select: { name: true, email: true, settings: true } },
        services: {
          include: {
            service: { select: { name: true } },
            staff: { select: { user: { select: { firstName: true, lastName: true } } } },
          },
        },
      },
    })

    if (!appointment) return { success: false, error: "Booking not found" }

    // Verify email matches
    if (appointment.client?.email?.toLowerCase() !== clientEmail.toLowerCase()) {
      return { success: false, error: "Email does not match the booking" }
    }

    // Check if already cancelled/completed
    if (appointment.status === "cancelled") {
      return { success: false, error: "This appointment is already cancelled" }
    }
    if (["completed", "checked_in", "in_progress", "no_show"].includes(appointment.status)) {
      return { success: false, error: "This appointment cannot be cancelled" }
    }

    // Cancellation-window check: reject if we're already inside the business's
    // cancellation window (the lead time before the appointment during which
    // self-service cancellation is no longer allowed). Mirrors the lead-time
    // map the booking write path honours; "none" means cancellation is always
    // allowed up until the appointment starts.
    const cancelSettings = await getPublicBookingSettings(appointment.businessId)
    const cancelWindowMinutes = CANCELLATION_WINDOW_MINUTES[cancelSettings.cancellationWindow] ?? 0
    const cancelCutoff = appointment.startTime.getTime() - cancelWindowMinutes * 60_000
    if (Date.now() > cancelCutoff) {
      const windowLabel = formatWindowLabel(cancelWindowMinutes)
      return {
        success: false,
        error:
          cancelWindowMinutes > 0
            ? `Online cancellation closes ${windowLabel} before your appointment. Please contact ${appointment.business.name} directly.`
            : `This appointment can no longer be cancelled online. Please contact ${appointment.business.name} directly.`,
      }
    }

    // Update status
    await prisma.appointment.update({
      where: { id: appointment.id },
      data: {
        status: "cancelled",
        cancelledAt: new Date(),
      },
    })

    // Send cancellation email (non-blocking)
    try {
      if (appointment.client?.email) {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
        const manageUrl = `${baseUrl}/book/manage/${bookingReference}`

        await sendEmail({
          to: appointment.client.email,
          subject: `Appointment Cancelled - ${appointment.business.name}`,
          html: appointmentCancelledEmail({
            clientName: `${appointment.client.firstName} ${appointment.client.lastName}`,
            serviceName: appointment.services[0]?.service.name ?? "Service",
            dateTime: appointment.startTime.toLocaleString(),
            businessName: appointment.business.name,
            bookingRef: appointment.bookingReference ?? "",
            manageUrl,
          }),
        })
      }
    } catch {
      // Don't block on email failure
    }

    revalidatePath(`/book/manage/${bookingReference}`)
    revalidatePath("/calendar")
    revalidatePath("/dashboard")

    return { success: true, data: { status: "cancelled" } }
  } catch (error) {
    console.error("cancelPublicBooking error:", error)
    return { success: false, error: "Failed to cancel appointment" }
  }
}

const reschedulePublicBookingSchema = z.object({
  bookingReference: z.string().trim().min(1).max(64),
  clientEmail: z.string().email().toLowerCase(),
  newStartTime: z.string().datetime(),
})

/**
 * Client self-service reschedule from the manage link.
 *
 * Verifies the email matches the booking (same guard cancelPublicBooking uses),
 * recomputes duration from the booking's existing services (we shift every
 * service row by the same delta so multi-service appointments stay intact),
 * then runs the SAME slot-safety machinery as createPublicBooking /
 * rescheduleAppointment: lead-time + advance-window + cancellation-window
 * checks, then an advisory lock + assertSlotAllowed + conflict check inside a
 * transaction. The reschedule email is best-effort (sendEmail logs and returns
 * if Resend isn't configured — not a fake). businessId is always derived from
 * the persisted appointment row, never from client input.
 */
export async function reschedulePublicBooking(
  bookingReference: string,
  clientEmail: string,
  newStartTime: string,
): Promise<ActionResult<{ startTime: string; endTime: string }>> {
  try {
    // 0. Validate input shape (rejects malformed datetime / non-email up front).
    const parsed = reschedulePublicBookingSchema.parse({
      bookingReference,
      clientEmail,
      newStartTime,
    })
    bookingReference = parsed.bookingReference
    clientEmail = parsed.clientEmail
    newStartTime = parsed.newStartTime

    // Rate limit: 5 reschedule attempts per booking reference per 10 minutes.
    const rl = rateLimit(`reschedule:${bookingReference}`, 5, 10 * 60 * 1000)
    if (rl.limited) {
      return { success: false, error: "Too many reschedule attempts. Please try again later." }
    }

    const appointment = await prisma.appointment.findUnique({
      where: { bookingReference },
      include: {
        client: { select: { email: true, firstName: true, lastName: true } },
        business: { select: { name: true } },
        services: {
          include: {
            service: { select: { name: true } },
            staff: { select: { user: { select: { firstName: true, lastName: true } } } },
          },
        },
      },
    })

    if (!appointment) return { success: false, error: "Booking not found" }

    // Identity guard — SAME check cancelPublicBooking uses.
    if (appointment.client?.email?.toLowerCase() !== clientEmail.toLowerCase()) {
      return { success: false, error: "Email does not match the booking" }
    }

    // Only future, still-active bookings can be moved.
    if (appointment.status === "cancelled") {
      return { success: false, error: "This appointment is cancelled and can't be rescheduled" }
    }
    if (["completed", "checked_in", "in_progress", "no_show"].includes(appointment.status)) {
      return { success: false, error: "This appointment can no longer be rescheduled" }
    }

    if (appointment.services.length === 0) {
      return { success: false, error: "This appointment has no services to reschedule" }
    }

    // businessId/locationId come ONLY from the persisted row (tenant isolation).
    const businessId = appointment.businessId
    const locationId = appointment.locationId

    const settings = await getPublicBookingSettings(businessId)

    // Cancellation-window check: you can't self-reschedule once inside the
    // window either (same gate as cancel — moving a slot is a write that
    // disrupts the barber's day just like a cancel does).
    const windowMinutes = CANCELLATION_WINDOW_MINUTES[settings.cancellationWindow] ?? 0
    const cutoff = appointment.startTime.getTime() - windowMinutes * 60_000
    if (Date.now() > cutoff) {
      const windowLabel = formatWindowLabel(windowMinutes)
      return {
        success: false,
        error:
          windowMinutes > 0
            ? `Online changes close ${windowLabel} before your appointment. Please contact ${appointment.business.name} directly.`
            : `This appointment can no longer be changed online. Please contact ${appointment.business.name} directly.`,
      }
    }

    // New time window — duration recomputed from the booking's existing services
    // (totalDuration is the persisted sum). Never trust a client-supplied length.
    const oldStartTime = appointment.startTime
    const startTime = new Date(newStartTime)
    const endTime = new Date(startTime)
    endTime.setMinutes(endTime.getMinutes() + appointment.totalDuration)
    const deltaMs = startTime.getTime() - oldStartTime.getTime()

    // Lead-time floor (also rejects past times: "none" is 0 lead, still < now).
    const leadMinutes = LEAD_TIME_MINUTES[settings.minLeadTime] ?? 30
    if (startTime.getTime() < Date.now() + leadMinutes * 60_000) {
      return { success: false, error: "That time is too soon to book. Please choose a later slot." }
    }
    // Advance-window ceiling.
    const maxDays = MAX_ADVANCE_DAYS[settings.maxAdvanceBooking] ?? 30
    const maxDate = new Date()
    maxDate.setHours(0, 0, 0, 0)
    maxDate.setDate(maxDate.getDate() + maxDays)
    if (startTime > maxDate) {
      return { success: false, error: `Bookings can only be made up to ${maxDays} days in advance.` }
    }

    // Shift every service row by the same delta — preserves intra-appointment
    // ordering/gaps and keeps each service on its original staff member.
    const sortedServices = [...appointment.services].sort(
      (a, b) => a.startTime.getTime() - b.startTime.getTime(),
    )
    const serviceUpdates = sortedServices.map((s) => ({
      id: s.id,
      staffId: s.staffId,
      startTime: new Date(s.startTime.getTime() + deltaMs),
      endTime: new Date(s.endTime.getTime() + deltaMs),
    }))

    await prisma.$transaction(async (tx) => {
      // Lock every staff member involved (sorted, deduped) before any read — the
      // conflict-check / update pair must not race concurrent booking writes.
      const uniqueStaffIds = Array.from(
        new Set(serviceUpdates.map((s) => s.staffId).filter(Boolean) as string[]),
      ).sort()
      for (const staffId of uniqueStaffIds) {
        await lockStaffSchedule(tx, businessId, staffId)
      }

      for (const su of serviceUpdates) {
        if (!su.staffId) continue
        // Working hours + approved time off, inside the lock.
        await assertSlotAllowed(tx, su.staffId, locationId, su.startTime, su.endTime)
        // Double-booking prevention — exclude this appointment's own rows.
        const conflicting = await tx.appointmentService.findFirst({
          where: {
            staffId: su.staffId,
            appointmentId: { not: appointment.id },
            appointment: {
              status: { notIn: ["cancelled", "no_show"] },
            },
            startTime: { lt: su.endTime },
            endTime: { gt: su.startTime },
          },
        })
        if (conflicting) {
          throw new Error("CONFLICT")
        }
      }

      await tx.appointment.update({
        where: { id: appointment.id },
        data: { startTime, endTime },
      })

      for (const su of serviceUpdates) {
        await tx.appointmentService.update({
          where: { id: su.id },
          data: { startTime: su.startTime, endTime: su.endTime },
        })
      }
    }, { timeout: 20000, maxWait: 15000 })

    // Reschedule email — best-effort. sendEmail logs and returns when Resend
    // isn't configured; we never block or fail the reschedule on email.
    if (appointment.client?.email) {
      const dateFormatOptions: Intl.DateTimeFormatOptions = {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }
      const oldDateTime = new Intl.DateTimeFormat("en-US", dateFormatOptions).format(oldStartTime)
      const newDateTime = new Intl.DateTimeFormat("en-US", dateFormatOptions).format(startTime)

      const staffUser = appointment.services[0]?.staff?.user
      const staffName = staffUser
        ? `${staffUser.firstName} ${staffUser.lastName}`
        : "Our team"

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
      const manageUrl = `${baseUrl}/book/manage/${bookingReference}`

      sendEmail({
        to: appointment.client.email,
        subject: `Appointment Rescheduled - ${appointment.services[0]?.service.name || "Your appointment"}`,
        html: appointmentRescheduledEmail({
          clientName: `${appointment.client.firstName} ${appointment.client.lastName}`,
          serviceName: appointment.services[0]?.service.name || "Service",
          oldDateTime,
          newDateTime,
          staffName,
          businessName: appointment.business.name,
          bookingRef: appointment.bookingReference ?? "",
          manageUrl,
        }),
      }).catch(console.error) // Don't block on email failure
    }

    revalidatePath(`/book/manage/${bookingReference}`)
    revalidatePath("/calendar")
    revalidatePath("/dashboard")

    return {
      success: true,
      data: { startTime: startTime.toISOString(), endTime: endTime.toISOString() },
    }
  } catch (e) {
    if (e instanceof ZodError) {
      return { success: false, error: "Invalid input" }
    }
    const msg = (e as Error).message
    if (msg === "CONFLICT") {
      return { success: false, error: "This time slot is already booked for the selected staff member" }
    }
    if (msg === ERR_OUTSIDE_WORKING_HOURS) {
      return { success: false, error: "That time is outside the staff member's working hours." }
    }
    if (msg === ERR_ON_APPROVED_TIME_OFF) {
      return { success: false, error: "That time is no longer available." }
    }
    // Concurrency contention behind the advisory lock (tx timeout P2028 /
    // write-conflict P2034) — surface the same clean "try again" conflict error.
    if (isBookingContentionError(e)) {
      return { success: false, error: "This time slot is no longer available, please try again" }
    }
    console.error("reschedulePublicBooking error:", e)
    return { success: false, error: "Failed to reschedule appointment. Please try again." }
  }
}
