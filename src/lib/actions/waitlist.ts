"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getBusinessContext } from "@/lib/auth-utils"

export async function addToWaitlist(data: {
  clientId: string
  serviceId?: string
  staffId?: string
  preferredDate?: Date
  preferredTimeStart?: string
  preferredTimeEnd?: string
  notes?: string
}) {
  const { businessId } = await getBusinessContext()

  const entry = await prisma.waitlistEntry.create({
    data: {
      businessId,
      clientId: data.clientId,
      serviceId: data.serviceId,
      staffId: data.staffId,
      preferredDate: data.preferredDate,
      preferredTimeStart: data.preferredTimeStart ? new Date(`1970-01-01T${data.preferredTimeStart}`) : undefined,
      preferredTimeEnd: data.preferredTimeEnd ? new Date(`1970-01-01T${data.preferredTimeEnd}`) : undefined,
      notes: data.notes,
    },
  })
  revalidatePath("/calendar")
  return entry
}

export async function removeFromWaitlist(id: string) {
  const { businessId } = await getBusinessContext()
  await prisma.waitlistEntry.update({
    where: { id, businessId },
    data: { status: "cancelled_waitlist" },
  })
  revalidatePath("/calendar")
}

export async function notifyWaitlistEntry(id: string) {
  const { businessId } = await getBusinessContext()
  await prisma.waitlistEntry.update({
    where: { id, businessId },
    data: {
      status: "notified",
      notifiedAt: new Date(),
    },
  })
  revalidatePath("/calendar")
}

export async function bookFromWaitlist(id: string, appointmentId: string) {
  const { businessId } = await getBusinessContext()
  await prisma.waitlistEntry.update({
    where: { id, businessId },
    data: {
      status: "booked",
      bookedAt: new Date(),
      appointmentId,
    },
  })
  revalidatePath("/calendar")
}
