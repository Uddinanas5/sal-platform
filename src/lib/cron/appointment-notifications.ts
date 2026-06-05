import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"
import { lifecycleEmail } from "@/lib/email-templates"
import { getNotificationSettings } from "@/lib/actions/settings"
import { renderNotificationTemplate } from "@/lib/notifications/render-template"
import { createReviewToken } from "@/lib/reviews/review-token"

type SendCounts = {
  remindersSent: number
  followUpsSent: number
  skipped: number
}

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000)
}

function getAppUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`.replace(/\/$/, "")
  return "http://localhost:3000"
}

function formatDateParts(date: Date, timezone: string) {
  return {
    date: new Intl.DateTimeFormat("en", {
      timeZone: timezone,
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date),
    time: new Intl.DateTimeFormat("en", {
      timeZone: timezone,
      hour: "numeric",
      minute: "2-digit",
    }).format(date),
  }
}

function metadataObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function buildVars({
  appointment,
  reviewUrl,
}: {
  appointment: Awaited<ReturnType<typeof loadAppointmentNotificationCandidates>>["reminders"][number]
  reviewUrl?: string
}) {
  const primaryService = appointment.services[0]
  const staffUser = primaryService?.staff.user
  const clientName = [appointment.client?.firstName, appointment.client?.lastName].filter(Boolean).join(" ")
  const staffName = [staffUser?.firstName, staffUser?.lastName].filter(Boolean).join(" ")
  const { date, time } = formatDateParts(appointment.startTime, appointment.business.timezone || "UTC")

  return {
    client_name: clientName || "there",
    service_name:
      appointment.services.map((service: { name: string }) => service.name).join(", ") ||
      "your service",
    staff_name: staffName || "your provider",
    salon_name: appointment.business.name,
    date,
    time,
    booking_reference: appointment.bookingReference,
    review_url: reviewUrl,
  }
}

async function loadAppointmentNotificationCandidates(now: Date) {
  const reminders = await prisma.appointment.findMany({
    where: {
      status: "confirmed",
      reminderSentAt: null,
      startTime: {
        gte: addHours(now, 20),
        lte: addHours(now, 44),
      },
      client: {
        isBlocked: false,
        email: { not: null },
      },
    },
    include: {
      business: { select: { id: true, name: true, email: true, timezone: true } },
      client: { select: { firstName: true, lastName: true, email: true } },
      services: {
        select: {
          name: true,
          staff: { select: { user: { select: { firstName: true, lastName: true } } } },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
    take: 100,
  })

  const followUps = await prisma.appointment.findMany({
    where: {
      status: "completed",
      completedAt: {
        gte: addHours(now, -24 * 14),
        lte: addHours(now, -1),
      },
      client: {
        isBlocked: false,
        email: { not: null },
      },
    },
    include: {
      business: { select: { id: true, name: true, email: true, timezone: true } },
      client: { select: { firstName: true, lastName: true, email: true } },
      services: {
        select: {
          name: true,
          staff: { select: { user: { select: { firstName: true, lastName: true } } } },
        },
        orderBy: { sortOrder: "asc" },
      },
      reviews: { select: { id: true }, take: 1 },
    },
    take: 100,
  })

  return { reminders, followUps }
}

export async function sendAppointmentNotifications(now = new Date()): Promise<SendCounts> {
  const counts: SendCounts = { remindersSent: 0, followUpsSent: 0, skipped: 0 }
  const { reminders, followUps } = await loadAppointmentNotificationCandidates(now)

  for (const appointment of reminders) {
    if (!appointment.client?.email) {
      counts.skipped += 1
      continue
    }

    const settings = await getNotificationSettings(appointment.business.id)
    const body = renderNotificationTemplate(
      settings.emailTemplates.appointmentReminder,
      buildVars({ appointment })
    )
    const result = await sendEmail({
      to: appointment.client.email,
      subject: `Reminder: ${buildVars({ appointment }).service_name} at ${appointment.business.name}`,
      html: lifecycleEmail({ title: "Appointment Reminder", body }),
      replyTo: appointment.business.email || undefined,
    })

    if (result.success) {
      await prisma.appointment.update({
        where: { id: appointment.id },
        data: { reminderSentAt: now },
      })
      counts.remindersSent += 1
    } else {
      counts.skipped += 1
    }
  }

  for (const appointment of followUps) {
    const metadata = metadataObject(appointment.metadata)
    if (metadata.followUpSentAt || appointment.reviews.length > 0 || !appointment.client?.email) {
      counts.skipped += 1
      continue
    }

    const reviewToken = createReviewToken(appointment.id)
    const reviewUrl = `${getAppUrl()}/review/${reviewToken}`
    const settings = await getNotificationSettings(appointment.business.id)
    const body = renderNotificationTemplate(
      settings.emailTemplates.followUp,
      buildVars({ appointment, reviewUrl })
    )

    const result = await sendEmail({
      to: appointment.client.email,
      subject: `How was your visit to ${appointment.business.name}?`,
      html: lifecycleEmail({
        title: "Thank You for Visiting",
        body,
        cta: { href: reviewUrl, label: "Leave a review" },
      }),
      replyTo: appointment.business.email || undefined,
    })

    if (result.success) {
      await prisma.appointment.update({
        where: { id: appointment.id },
        data: {
          metadata: {
            ...metadata,
            followUpSentAt: now.toISOString(),
          },
        },
      })
      counts.followUpsSent += 1
    } else {
      counts.skipped += 1
    }
  }

  return counts
}
