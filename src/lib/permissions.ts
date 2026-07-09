// Permission primitives — no Prisma imports (used by edge middleware)

export const ROLE_HIERARCHY = ["staff", "admin", "owner"] as const
export type AppRole = (typeof ROLE_HIERARCHY)[number]

/**
 * A user account may authenticate / hold a live session only while its status is
 * "active". Suspended or deactivated accounts (UserStatus enum: active | inactive
 * | suspended) must be refused at every session/role boundary. Shared by the
 * credentials authorize() and resolveBusinessRole so the two can never disagree
 * about who is allowed in. Pure (no Prisma) so both the edge and node layers use it.
 */
export function isActiveStatus(status: string | null | undefined): boolean {
  return status === "active"
}

export function hasRole(
  userRole: string | undefined | null,
  minimum: AppRole
): boolean {
  if (!userRole) return false
  const userIdx = ROLE_HIERARCHY.indexOf(userRole as AppRole)
  const minIdx = ROLE_HIERARCHY.indexOf(minimum)
  if (userIdx === -1 || minIdx === -1) return false
  return userIdx >= minIdx
}

// Routes completely blocked to the staff role
export const STAFF_BLOCKED_ROUTES = [
  "/inventory",
  "/reports",
  "/marketing",
  "/reviews",
  "/memberships",
  "/booking",
  "/settings",
]

// Routes where staff can only access sub-routes (e.g. /staff/[id]), not the list page
export const STAFF_LIST_BLOCKED_ROUTES = [
  "/staff",
]

// Sidebar nav items with minimum role to display
export const NAV_PERMISSIONS = [
  { href: "/dashboard", minRole: "staff" as AppRole },
  { href: "/calendar", minRole: "staff" as AppRole },
  { href: "/clients", minRole: "staff" as AppRole },
  { href: "/services", minRole: "staff" as AppRole },
  { href: "/checkout", minRole: "staff" as AppRole },
  { href: "/inventory", minRole: "admin" as AppRole },
  { href: "/reports", minRole: "admin" as AppRole },
  { href: "/reports/payday", minRole: "admin" as AppRole },
  { href: "/marketing", minRole: "admin" as AppRole },
  { href: "/reviews", minRole: "admin" as AppRole },
  { href: "/memberships", minRole: "admin" as AppRole },
  { href: "/booking", minRole: "admin" as AppRole },
  { href: "/staff", minRole: "admin" as AppRole },
  { href: "/settings", minRole: "admin" as AppRole },
]
