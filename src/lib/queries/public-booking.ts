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
  canAcceptBookings: boolean
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
      canAcceptBookings: true,
      user: { select: { firstName: true, lastName: true, role: true } },
      // Only ACTIVE staff-service links — an inactive link means this staff
      // member no longer performs the service, so it must not advertise it.
      staffServices: { where: { isActive: true }, select: { serviceId: true } },
    },
  })

  return rows.map((s) => ({
    id: s.id,
    name: `${s.user.firstName} ${s.user.lastName}`,
    isActive: s.isActive,
    canAcceptBookings: s.canAcceptBookings,
    services: s.staffServices.map((ss) => ss.serviceId),
    color: s.color || "#059669",
    role: s.user.role === "admin" || s.user.role === "owner" ? "admin" : "staff",
  }))
}
