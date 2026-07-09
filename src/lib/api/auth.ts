import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveBusinessRole } from "@/lib/auth-utils"
import { decideBillingGate } from "@/lib/billing/gate"
import crypto from "crypto"

export type ApiContext = {
  userId: string
  businessId: string
  role: string
}

/**
 * A cancelled (but once-subscribed) salon is hard-gated in the dashboard; the
 * programmatic API must honor the same gate, or a cancelled owner could keep
 * operating via API keys / MCP after losing dashboard access (P2-15). Beta
 * salons never subscribed → never gated (safe default), so this is a no-op for
 * them. Returns true when the caller's business is billing-gated.
 */
async function isBillingGated(businessId: string): Promise<boolean> {
  try {
    const biz = await prisma.business.findUnique({
      where: { id: businessId },
      select: { subscriptionStatus: true, stripeSubscriptionId: true, billingExempt: true },
    })
    if (!biz) return false
    const decision = decideBillingGate({
      status: biz.subscriptionStatus,
      hasSubscription: Boolean(biz.stripeSubscriptionId),
      billingExempt: Boolean(biz.billingExempt),
    })
    return decision.kind === "gate"
  } catch {
    // A DB hiccup shouldn't lock everyone out — this is defense-in-depth, so
    // fail open on error (the request likely fails downstream anyway).
    return false
  }
}

// Deny a resolved context if its business is billing-gated (cancelled sub). This
// is the API mirror of the dashboard gate. No-op for never-subscribed beta salons.
async function gateOrNull(ctx: ApiContext): Promise<ApiContext | null> {
  if (await isBillingGated(ctx.businessId)) return null
  return ctx
}

export async function withV1Auth(req: Request): Promise<ApiContext | null> {
  // 1. Try Bearer token (API key or OAuth access token)
  const authHeader = req.headers.get("authorization")
  if (authHeader?.startsWith("Bearer ")) {
    const rawKey = authHeader.slice(7)
    const apiKeySecret = rawKey.startsWith("sal_") ? rawKey.slice(4) : rawKey
    const keyHash = crypto.createHash("sha256").update(apiKeySecret).digest("hex")
    const oauthHash = crypto.createHash("sha256").update(rawKey).digest("hex")

    try {
      // Try API key first
      const apiKey = await prisma.apiKey.findUnique({
        where: { keyHash },
        include: { business: { select: { id: true } } },
      })
      if (apiKey && !apiKey.revokedAt && (!apiKey.expiresAt || apiKey.expiresAt >= new Date())) {
        // The key acts AS its creator (ctx.userId = createdById), so it is valid only
        // while that creator is STILL an active member of the business: a suspended /
        // deactivated or removed creator's un-revoked key must stop working (L-047),
        // mirroring the OAuth + session paths. resolveBusinessRole returns null for a
        // non-active or no-longer-member user. We use it ONLY as a liveness gate and
        // still honor the key's OWN configured role (apiKey.role) — which may
        // intentionally differ from the creator's role (e.g. an admin mints a
        // read-only key) — never the resolved role.
        const creatorMembership = await resolveBusinessRole(apiKey.createdById, apiKey.businessId)
        if (!creatorMembership) return null
        // Update lastUsedAt without blocking response
        prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } }).catch(() => {})
        return gateOrNull({ userId: apiKey.createdById, businessId: apiKey.businessId, role: apiKey.role })
      }

      // Try OAuth access token
      const oauthToken = await prisma.oAuthAccessToken.findUnique({
        where: { tokenHash: oauthHash },
      })
      if (oauthToken && !oauthToken.revokedAt && oauthToken.expiresAt >= new Date()) {
        // Resolve the granting user's REAL role for this business — never assume admin.
        // The token must still correspond to an active owner/staff relationship with the
        // business, or it is no longer valid (revoked membership, stale token).
        const role = await resolveBusinessRole(oauthToken.userId, oauthToken.businessId)
        if (!role) return null
        return gateOrNull({ userId: oauthToken.userId, businessId: oauthToken.businessId, role })
      }
    } catch (error) {
      // DB error during token lookup — treat as auth failure rather than leaking 500
      console.error("[withV1Auth] token lookup failed:", error instanceof Error ? error.message : error)
    }

    return null
  }
  // 2. Try session cookie — re-validate live membership (don't trust stale JWT
  // claims): a removed staffer's 7-day cookie must not keep working, and a
  // demotion must take effect at once. Mirrors the OAuth path above.
  const session = await auth()
  if (!session?.user) return null
  const user = session.user as { id?: string; role?: string; businessId?: string }
  if (!user.id || !user.businessId) return null
  const role = await resolveBusinessRole(user.id, user.businessId)
  if (!role) return null
  return gateOrNull({ userId: user.id, businessId: user.businessId, role })
}
