import { prisma } from "@/lib/prisma"

export function generateBookingReference() {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 6)
  return `SAL-${timestamp}-${random}`.toUpperCase()
}

export async function assertServicesOwned(ids: string[], businessId: string) {
  if (ids.length === 0) return
  const unique = new Set(ids)
  const owned = await prisma.service.findMany({
    where: { id: { in: Array.from(unique) }, businessId },
    select: { id: true },
  })
  if (owned.length !== unique.size) throw new Error("Invalid service ids")
}

export async function assertClientOwned(id: string, businessId: string) {
  const owned = await prisma.client.findFirst({
    where: { id, businessId },
    select: { id: true },
  })
  if (!owned) throw new Error("Invalid client id")
}

export async function assertClientsOwned(ids: string[], businessId: string) {
  if (ids.length === 0) return
  const unique = new Set(ids)
  const owned = await prisma.client.findMany({
    where: { id: { in: Array.from(unique) }, businessId },
    select: { id: true },
  })
  if (owned.length !== unique.size) throw new Error("Invalid client ids")
}

export async function assertStaffOwned(id: string, businessId: string) {
  const owned = await prisma.staff.findFirst({
    where: { id, primaryLocation: { businessId } },
    select: { id: true },
  })
  if (!owned) throw new Error("Invalid staff id")
}
