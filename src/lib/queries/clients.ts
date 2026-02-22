import { prisma } from "@/lib/prisma"

export async function getClients(search?: string, businessId?: string) {
  const where: Record<string, unknown> = { deletedAt: null }

  if (businessId) {
    where.businessId = businessId
  }

  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { phone: { contains: search, mode: "insensitive" } },
    ]
  }

  const clients = await prisma.client.findMany({
    where,
    orderBy: { createdAt: "desc" },
  })

  return clients.map((c) => ({
    id: c.id,
    name: `${c.firstName} ${c.lastName}`,
    email: c.email || "",
    phone: c.phone || "",
    avatar: undefined as string | undefined,
    totalVisits: c.totalVisits,
    totalSpent: Number(c.totalSpent),
    lastVisit: c.lastVisitAt || undefined,
    createdAt: c.createdAt,
    tags: c.tags,
    notes: c.notes || undefined,
    loyaltyPoints: c.loyaltyPoints,
    dateOfBirth: c.dateOfBirth || undefined,
    walletBalance: 0,
  }))
}

export async function getClientById(id: string) {
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      appointments: {
        include: {
          services: {
            include: {
              service: true,
              staff: { include: { user: true } },
            },
          },
        },
        orderBy: { startTime: "desc" },
        take: 20,
      },
    },
  })

  if (!client) return null

  return {
    id: client.id,
    name: `${client.firstName} ${client.lastName}`,
    email: client.email || "",
    phone: client.phone || "",
    totalVisits: client.totalVisits,
    totalSpent: Number(client.totalSpent),
    lastVisit: client.lastVisitAt || undefined,
    createdAt: client.createdAt,
    tags: client.tags,
    notes: client.notes || undefined,
    loyaltyPoints: client.loyaltyPoints,
    dateOfBirth: client.dateOfBirth || undefined,
    walletBalance: 0,
    appointments: client.appointments.map((a) => {
      const svc = a.services[0]
      return {
        id: a.id,
        clientId: a.clientId || "",
        clientName: `${client.firstName} ${client.lastName}`,
        serviceId: svc?.serviceId || "",
        serviceName: svc?.name || "",
        staffId: svc?.staffId || "",
        staffName: svc ? `${svc.staff.user.firstName} ${svc.staff.user.lastName}` : "",
        startTime: a.startTime,
        endTime: a.endTime,
        status: a.status.replace("_", "-"),
        price: Number(a.totalAmount),
      }
    }),
  }
}
