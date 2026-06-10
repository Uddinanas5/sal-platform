import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { ManageBookingClient } from "./client"

export const dynamic = "force-dynamic"

function isConnectionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const code = (error as { code?: string }).code
  const causeCode = (error as { cause?: { code?: string } }).cause?.code
  // findUnique returns null for "no row found", so a thrown PrismaClient*Error
  // here is virtually always infra (DB down, pool exhausted, socket dropped) —
  // surface those as 503 instead of leaking a raw 500.
  return (
    error.name === "PrismaClientInitializationError" ||
    error.name === "PrismaClientKnownRequestError" ||
    error.name === "PrismaClientRustPanicError" ||
    code === "P1001" ||
    code === "P1002" ||
    code === "P1008" ||
    code === "P1017" ||
    code === "P2024" ||
    code === "ECONNREFUSED" ||
    causeCode === "ECONNREFUSED"
  )
}

class ServiceUnavailableError extends Error {
  constructor(message = "Database unreachable") {
    super(message)
    this.name = "ServiceUnavailableError"
  }
}

export default async function ManageBookingPage({
  params,
}: {
  params: Promise<{ bookingReference: string }>
}) {
  const { bookingReference } = await params

  let appointment
  try {
    appointment = await prisma.appointment.findUnique({
      where: { bookingReference },
      include: {
        business: {
          select: {
            name: true,
            slug: true,
            phone: true,
            email: true,
            settings: true,
            timezone: true,
          },
        },
        client: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        services: {
          include: {
            service: {
              select: { id: true, name: true, durationMinutes: true, price: true },
            },
            staff: {
              select: { id: true, user: { select: { firstName: true, lastName: true } } },
            },
          },
        },
        location: {
          select: {
            id: true,
            name: true,
            addressLine1: true,
            city: true,
            state: true,
          },
        },
      },
    })
  } catch (error) {
    if (isConnectionError(error)) {
      throw new ServiceUnavailableError()
    }
    throw error
  }

  if (!appointment) notFound()

  // Lead service drives the reschedule availability fetch — /api/availability is
  // keyed on a single serviceId (+ optional staffId). The reschedule action
  // shifts every service row by the same delta, so picking one slot is enough.
  const leadService = appointment.services[0]

  const bookingData = {
    id: appointment.id,
    bookingReference: appointment.bookingReference,
    status: appointment.status,
    startTime: appointment.startTime.toISOString(),
    endTime: appointment.endTime.toISOString(),
    totalAmount: Number(appointment.totalAmount),
    notes: appointment.notes,
    // Reschedule picker inputs (server-derived; never trusted from the client).
    locationId: appointment.location?.id ?? "",
    serviceId: leadService?.service.id ?? "",
    staffId: leadService?.staff?.id ?? null,
    businessName: appointment.business.name,
    businessSlug: appointment.business.slug,
    businessTimezone: appointment.business.timezone || "UTC",
    businessPhone: appointment.business.phone,
    businessEmail: appointment.business.email,
    clientName: `${appointment.client?.firstName ?? ""} ${appointment.client?.lastName ?? ""}`.trim(),
    clientEmail: appointment.client?.email ?? "",
    locationName: appointment.location?.name ?? "",
    locationAddress: appointment.location?.addressLine1 ?? "",
    locationCity: appointment.location?.city ?? "",
    locationState: appointment.location?.state ?? "",
    services: appointment.services.map((as) => ({
      name: as.service.name,
      duration: as.service.durationMinutes,
      price: Number(as.service.price),
      staffName: as.staff?.user
        ? `${as.staff.user.firstName} ${as.staff.user.lastName}`.trim()
        : "Any Available",
    })),
  }

  return <ManageBookingClient booking={bookingData} />
}
