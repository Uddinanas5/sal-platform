import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { ManageBookingClient } from "./client"

export default async function ManageBookingPage({
  params,
}: {
  params: Promise<{ bookingReference: string }>
}) {
  const { bookingReference } = await params

  const appointment = await prisma.appointment.findUnique({
    where: { bookingReference },
    include: {
      business: {
        select: {
          name: true,
          slug: true,
          phone: true,
          email: true,
          settings: true,
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
            select: { name: true, durationMinutes: true, price: true },
          },
          staff: {
            select: { user: { select: { firstName: true, lastName: true } } },
          },
        },
      },
      location: {
        select: {
          name: true,
          addressLine1: true,
          city: true,
          state: true,
        },
      },
    },
  })

  if (!appointment) notFound()

  const bookingData = {
    id: appointment.id,
    bookingReference: appointment.bookingReference,
    status: appointment.status,
    startTime: appointment.startTime.toISOString(),
    endTime: appointment.endTime.toISOString(),
    totalAmount: Number(appointment.totalAmount),
    notes: appointment.notes,
    businessName: appointment.business.name,
    businessSlug: appointment.business.slug,
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
