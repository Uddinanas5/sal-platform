"use server"

import { prisma } from "@/lib/prisma"
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

    // 2. Get service details
    const service = await prisma.service.findUnique({
      where: { id: data.serviceId },
    })
    if (!service) return { success: false, error: "Service not found" }

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

    // 5. Generate booking reference
    const count = await prisma.appointment.count({ where: { businessId: business.id } })
    const bookingRef = `SAL-${String(count + 1).padStart(4, "0")}`

    const price = Number(service.price)
    const tax = Math.round(price * 0.08875 * 100) / 100

    // 6. Create appointment
    const appointment = await prisma.appointment.create({
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

    // 7. Create appointment service link
    await prisma.appointmentService.create({
      data: {
        appointmentId: appointment.id,
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

    revalidatePath("/calendar")
    revalidatePath("/dashboard")

    return {
      success: true,
      data: { id: appointment.id, bookingReference: bookingRef },
    }
  } catch (e) {
    if (e instanceof ZodError) {
      return { success: false, error: "Invalid input" }
    }
    return { success: false, error: (e as Error).message }
  }
}
