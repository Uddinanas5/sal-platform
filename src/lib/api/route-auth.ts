import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveBusinessRole } from "@/lib/auth-utils"
import { isActiveStatus, isSessionWatermarkStale } from "@/lib/permissions"

export type RouteBusinessContext = {
  userId: string
  businessId: string
  role: string
}

/**
 * The getBusinessContext() equivalent for internal /api/* route handlers (L-048).
 *
 * Routes outside the (dashboard) layout that authenticate with bare auth() trust
 * the raw 7-day JWT: a demoted/removed member (L-036 class) or a session issued
 * before a password reset (L-034 class) kept reading PII and minting payment
 * intents. This helper resolves the LIVE role and enforces the session
 * watermark, exactly like getBusinessContext, but returns null instead of
 * throwing so route handlers can reply with a proper 401 JSON response.
 */
export async function getRouteBusinessContext(): Promise<RouteBusinessContext | null> {
  const session = await auth()
  const userId = session?.user?.id
  const businessId = session?.user?.businessId
  if (!userId || !businessId) return null
  const role = await resolveBusinessRole(userId, businessId, {
    sessionLoginAt: session?.loginAt ?? null,
  })
  if (!role) return null
  return { userId, businessId, role }
}

/**
 * Live-user check for session-authenticated code that runs BEFORE the user has a
 * business in their JWT (the onboarding server actions). Verifies the account is
 * still active and the session postdates the invalidation watermark — the same
 * two liveness gates resolveBusinessRole applies — without requiring a tenant.
 * Returns the userId, or null when the session must be refused.
 */
export async function getLiveUserId(): Promise<string | null> {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return null
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { status: true, sessionsValidAfter: true },
  })
  if (!user || !isActiveStatus(user.status)) return null
  if (isSessionWatermarkStale(session?.loginAt ?? null, user.sessionsValidAfter)) return null
  return userId
}
