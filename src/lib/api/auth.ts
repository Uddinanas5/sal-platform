import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveBusinessRole } from "@/lib/auth-utils"
import crypto from "crypto"

export type ApiContext = {
  userId: string
  businessId: string
  role: string
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
        // Update lastUsedAt without blocking response
        prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } }).catch(() => {})
        return { userId: apiKey.createdById, businessId: apiKey.businessId, role: apiKey.role }
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
        return { userId: oauthToken.userId, businessId: oauthToken.businessId, role }
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
  return { userId: user.id, businessId: user.businessId, role }
}
