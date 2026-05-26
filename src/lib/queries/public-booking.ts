import { prisma } from "@/lib/prisma"

/**
 * Wire-safe shape for staff rendered in the public booking flow.
 * Only fields the unauthenticated client actually consumes are present;
 * everything else (email, phone, avatar, commissionRate, schedules) is
 * deliberately omitted to prevent exfil via the RSC payload.
 *
 * See docs/PUBLIC_PROJECTIONS.md before adding a field here.
 */
export interface PublicBookingStaff {
  id: string
  name: string
  isActive: boolean
  services: string[]
  color: string
  role: "admin" | "staff"
}

export async function getPublicBookingStaff(
  businessId: string
): Promise<PublicBookingStaff[]> {
  const rows = await prisma.staff.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      primaryLocation: { businessId },
    },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      color: true,
      isActive: true,
      user: { select: { firstName: true, lastName: true, role: true } },
      staffServices: { select: { serviceId: true } },
    },
  })

  return rows.map((s) => ({
    id: s.id,
    name: `${s.user.firstName} ${s.user.lastName}`,
    isActive: s.isActive,
    services: s.staffServices.map((ss) => ss.serviceId),
    color: s.color || "#059669",
    role: s.user.role === "admin" || s.user.role === "owner" ? "admin" : "staff",
  }))
}
