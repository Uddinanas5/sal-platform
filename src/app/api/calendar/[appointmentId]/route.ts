import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

function escapeICS(text: string): string {
  return text.replace(/[\\;,]/g, "\\$&").replace(/\n/g, "\\n")
}

function formatICSDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { appointmentId: string } }
) {
  try {
    const appointment = await prisma.appointment.findUnique({
      where: { id: params.appointmentId },
      include: {
        client: { select: { firstName: true, lastName: true, email: true } },
        business: { select: { name: true, email: true } },
        services: {
          include: {
            service: { select: { name: true } },
            staff: { select: { user: { select: { firstName: true, lastName: true } } } },
          },
        },
        location: { select: { name: true, addressLine1: true, city: true, state: true, postalCode: true } },
      },
    })

    if (!appointment) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 })
    }

    const serviceNames = appointment.services.map((s) => s.service.name).join(", ")
    const staffNames = appointment.services
      .map((s) => s.staff ? `${s.staff.user.firstName} ${s.staff.user.lastName}` : "")
      .filter(Boolean)
      .join(", ")
    const clientName = appointment.client
      ? `${appointment.client.firstName} ${appointment.client.lastName}`
      : "Client"

    const location = appointment.location
      ? [appointment.location.addressLine1, appointment.location.city, appointment.location.state, appointment.location.postalCode]
          .filter(Boolean)
          .join(", ")
      : ""

    const summary = `${serviceNames} - ${clientName}`
    const description = [
      `Services: ${serviceNames}`,
      staffNames ? `Staff: ${staffNames}` : "",
      `Client: ${clientName}`,
      appointment.notes ? `Notes: ${appointment.notes}` : "",
      `Ref: ${appointment.bookingReference}`,
    ]
      .filter(Boolean)
      .join("\\n")

    const uid = `${appointment.id}@sal-platform`
    const now = formatICSDate(new Date())
    const dtStart = formatICSDate(appointment.startTime)
    const dtEnd = formatICSDate(appointment.endTime)

    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//SAL Platform//Appointments//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${escapeICS(summary)}`,
      `DESCRIPTION:${escapeICS(description)}`,
      location ? `LOCATION:${escapeICS(location)}` : "",
      `ORGANIZER;CN=${escapeICS(appointment.business.name)}:mailto:${appointment.business.email || "noreply@salplatform.com"}`,
      `STATUS:${appointment.status === "cancelled" ? "CANCELLED" : "CONFIRMED"}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ]
      .filter(Boolean)
      .join("\r\n")

    return new NextResponse(ics, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${appointment.bookingReference}.ics"`,
      },
    })
  } catch (e) {
    console.error("ICS export error:", e)
    return NextResponse.json({ error: "Failed to generate calendar file" }, { status: 500 })
  }
}
