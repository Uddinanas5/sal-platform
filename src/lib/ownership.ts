import { prisma } from "@/lib/prisma"
import { randomBytes } from "crypto"

export function generateBookingReference() {
  const now = new Date()
  const yyyymmdd = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}`
  // 3 bytes = 6 hex chars; total length 19 to fit booking_reference VARCHAR(20).
  const suffix = randomBytes(3).toString("hex").toUpperCase()
  return `SAL-${yyyymmdd}-${suffix}`
}

// Generic message so callers can't distinguish "exists in another tenant" from
// "doesn't exist at all" — same shape Fresha uses for cross-tenant probes.
const NOT_FOUND = "Not found"

export async function assertServicesOwned(ids: string[], businessId: string) {
  if (ids.length === 0) return
  const unique = new Set(ids)
  const owned = await prisma.service.findMany({
    where: { id: { in: Array.from(unique) }, businessId },
    select: { id: true },
  })
  if (owned.length !== unique.size) throw new Error(NOT_FOUND)
}

export async function assertClientOwned(id: string, businessId: string) {
  const owned = await prisma.client.findFirst({
    where: { id, businessId },
    select: { id: true },
  })
  if (!owned) throw new Error(NOT_FOUND)
}

export async function assertClientsOwned(ids: string[], businessId: string) {
  if (ids.length === 0) return
  const unique = new Set(ids)
  const owned = await prisma.client.findMany({
    where: { id: { in: Array.from(unique) }, businessId },
    select: { id: true },
  })
  if (owned.length !== unique.size) throw new Error(NOT_FOUND)
}

export async function assertStaffOwned(id: string, businessId: string) {
  const owned = await prisma.staff.findFirst({
    where: { id, primaryLocation: { businessId } },
    select: { id: true },
  })
  if (!owned) throw new Error(NOT_FOUND)
}
