import { prisma } from "@/lib/prisma"

export async function getWaitlistEntries(businessId?: string) {
  const businessFilter = businessId ? { businessId } : {}

  const entries = await prisma.waitlistEntry.findMany({
    where: {
      ...businessFilter,
      status: { in: ["waiting", "notified"] },
    },
    orderBy: { createdAt: "asc" },
  })

  return entries.map((e) => ({
    id: e.id,
    clientId: e.clientId,
    serviceId: e.serviceId,
    staffId: e.staffId,
    preferredDate: e.preferredDate,
    preferredTimeStart: e.preferredTimeStart,
    preferredTimeEnd: e.preferredTimeEnd,
    status: e.status,
    notes: e.notes,
    notifiedAt: e.notifiedAt,
    createdAt: e.createdAt,
  }))
}

export async function getWaitlistCount(businessId?: string) {
  const businessFilter = businessId ? { businessId } : {}

  return prisma.waitlistEntry.count({
    where: {
      ...businessFilter,
      status: "waiting",
    },
  })
}
