"use server"

import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getBusinessContext } from "@/lib/auth-utils"
import { sendEmail } from "@/lib/email"
import { lifecycleEmail } from "@/lib/email-templates"
import { timeStringToUtcDate } from "@/lib/scheduling/zoned-time"

const addToWaitlistSchema = z.object({
  clientId: z.string().uuid(),
  serviceId: z.string().uuid().optional(),
  staffId: z.string().uuid().optional(),
  preferredDate: z.coerce.date().optional(),
  preferredTimeStart: z.string().optional(),
  preferredTimeEnd: z.string().optional(),
  notes: z.string().optional(),
})

const idSchema = z.string().uuid("Invalid ID")

export async function addToWaitlist(data: {
  clientId: string
  serviceId?: string
  staffId?: string
  preferredDate?: Date
  preferredTimeStart?: string
  preferredTimeEnd?: string
  notes?: string
}) {
  try {
    const parsed = addToWaitlistSchema.parse(data)
    const { businessId } = await getBusinessContext()

    const entry = await prisma.waitlistEntry.create({
      data: {
        businessId,
        clientId: parsed.clientId,
        serviceId: parsed.serviceId,
        staffId: parsed.staffId,
        preferredDate: parsed.preferredDate,
        preferredTimeStart: parsed.preferredTimeStart ? timeStringToUtcDate(parsed.preferredTimeStart) : undefined,
        preferredTimeEnd: parsed.preferredTimeEnd ? timeStringToUtcDate(parsed.preferredTimeEnd) : undefined,
        notes: parsed.notes,
      },
    })
    revalidatePath("/calendar")
    return entry
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    }
    throw e
  }
}

export async function removeFromWaitlist(id: string) {
  try {
    const parsedId = idSchema.parse(id)
    const { businessId } = await getBusinessContext()
    await prisma.waitlistEntry.update({
      where: { id: parsedId, businessId },
      data: { status: "cancelled_waitlist" },
    })
    revalidatePath("/calendar")
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    }
    throw e
  }
}

/**
 * Mark a waitlist entry as notified AND — when the client has an email on file
 * and has not opted out — actually email them that a slot may be available
 * (mirrors the consent gate in src/lib/automation/reminders.ts). Returns an
 * `emailed` flag so the UI can tell the operator the truth: a real email went
 * out, or the entry was only flagged because there's no consented email.
 */
export async function notifyWaitlistEntry(id: string) {
  try {
    const parsedId = idSchema.parse(id)
    const { businessId } = await getBusinessContext()

    // Tenant-scoped load. WaitlistEntry has no `client` relation (only clientId),
    // so load the client + business separately, both scoped to this business.
    const entry = await prisma.waitlistEntry.findFirst({
      where: { id: parsedId, businessId },
      select: { id: true, clientId: true, business: { select: { name: true } } },
    })
    if (!entry) return { success: false, error: "Waitlist entry not found" }

    await prisma.waitlistEntry.update({
      where: { id: parsedId, businessId },
      data: {
        status: "notified",
        notifiedAt: new Date(),
      },
    })

    // Consent-first email gate (same posture as reminders.ts): only email when
    // there is an address on file AND the client has not opted out.
    let emailed = false
    const client = await prisma.client.findFirst({
      where: { id: entry.clientId, businessId },
      select: { firstName: true, email: true, emailConsent: true },
    })
    if (client?.email && client.emailConsent) {
      const businessName = entry.business?.name || "your salon"
      const res = await sendEmail({
        to: client.email,
        subject: `A spot may have opened up at ${businessName}`,
        html: lifecycleEmail({
          title: "A spot may be available",
          body: `Hi ${client.firstName || "there"},\n\nGood news — a spot may have just opened up at ${businessName}. You're on our waitlist, so we wanted to let you know right away.\n\nReply to this email or give us a call to grab the slot before it's gone.`,
        }),
      })
      emailed = !!res?.success
    }

    revalidatePath("/calendar")
    return { success: true, data: { emailed } }
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    }
    throw e
  }
}

export async function bookFromWaitlist(id: string, appointmentId: string) {
  try {
    const parsedId = idSchema.parse(id)
    const parsedAppointmentId = idSchema.parse(appointmentId)
    const { businessId } = await getBusinessContext()
    // Confirm the appointment is THIS tenant's before linking it — no FK on the
    // column, so this is the only guard against a cross-tenant dangling ref.
    const appt = await prisma.appointment.findFirst({
      where: { id: parsedAppointmentId, businessId },
      select: { id: true },
    })
    if (!appt) return { success: false, error: "Appointment not found" }
    await prisma.waitlistEntry.update({
      where: { id: parsedId, businessId },
      data: {
        status: "booked",
        bookedAt: new Date(),
        appointmentId: parsedAppointmentId,
      },
    })
    revalidatePath("/calendar")
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    }
    throw e
  }
}
