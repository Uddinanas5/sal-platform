import { auth } from "./auth"
import { prisma } from "./prisma"
import { hasRole, isActiveStatus, type AppRole } from "./permissions"

export type BusinessContext = {
  userId: string
  businessId: string
  role: string
}

/**
 * Resolve a user's effective role for a business, verifying they are STILL a live
 * member (active owner or active staff) right now — not merely that their session
 * cookie once said so. Returns the fresh role, or null if the user has no current
 * relationship with the business (removed staff, deactivated user, transferred out).
 *
 * This is the single source of truth for "is this user allowed to act on this
 * tenant". JWT sessions bake businessId/role in at login and last 7 days, so
 * without a per-request check a removed staffer keeps full access until the cookie
 * expires. Both the session path here and the OAuth/API path in src/lib/api/auth.ts
 * gate on this.
 */
export async function resolveBusinessRole(
  userId: string,
  businessId: string
): Promise<string | null> {
  const [user, ownedBusiness, staffProfile] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { role: true, status: true } }),
    prisma.business.findFirst({ where: { id: businessId, ownerId: userId }, select: { id: true } }),
    prisma.staff.findFirst({
      where: { userId, isActive: true, deletedAt: null, primaryLocation: { businessId } },
      select: { id: true },
    }),
  ])
  if (!user || !isActiveStatus(user.status)) return null
  if (ownedBusiness) return user.role === "owner" ? "owner" : "admin"
  if (staffProfile) return user.role // honor the user's real role (staff/admin)
  return null // no live membership in this business
}

export async function getBusinessContext(): Promise<BusinessContext> {
  const session = await auth()
  if (!session?.user) throw new Error("Not authenticated")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const businessId = (session.user as any).businessId
  if (!businessId) throw new Error("No business context")
  // Re-validate membership on every call: a removed/deactivated user must lose
  // access immediately, not when their 7-day JWT expires. Also yields the fresh
  // role, so a demotion takes effect at once instead of persisting in the cookie.
  const role = await resolveBusinessRole(session.user.id, businessId)
  if (!role) throw new Error("No business context")
  return { userId: session.user.id, businessId, role }
}

export async function requireMinRole(minimum: AppRole): Promise<BusinessContext> {
  const ctx = await getBusinessContext()
  if (!hasRole(ctx.role, minimum)) {
    throw new Error(`Insufficient permissions: requires ${minimum} role`)
  }
  return ctx
}
