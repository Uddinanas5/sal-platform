"use server"

import { prisma } from "@/lib/prisma"
import { rateLimit } from "@/lib/rate-limit"
import { sendEmail } from "@/lib/email"
import { bookingConfirmationEmail } from "@/lib/email-templates"
import { revalidatePath } from "next/cache"
import { z, ZodError } from "zod"

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

      // Atomic booking reference via timestamp + random suffix
      const timestamp = Date.now().toString(36)
      const random = Math.random().toString(36).substring(2, 6)
      const bookingRef = `SAL-${timestamp}-${random}`.toUpperCase()

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
    })

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
    console.error("createPublicBooking error:", e)
    return { success: false, error: msg }
  }
}
