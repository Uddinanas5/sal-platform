import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import crypto from "crypto"

export type ApiContext = {
  userId: string
  businessId: string
  role: string
}

export async function withV1Auth(req: Request): Promise<ApiContext | null> {
  // 1. Try Bearer token
  const authHeader = req.headers.get("authorization")
  if (authHeader?.startsWith("Bearer ")) {
    const rawKey = authHeader.slice(7)
    const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex")
    const apiKey = await prisma.apiKey.findUnique({
      where: { keyHash },
      include: { business: { select: { id: true } } },
    })
    if (!apiKey || apiKey.revokedAt) return null
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return null
    // Update lastUsedAt without blocking response
    prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } }).catch(() => {})
    return { userId: apiKey.createdById, businessId: apiKey.businessId, role: apiKey.role }
  }
  // 2. Try session cookie
  const session = await auth()
  if (!session?.user) return null
  const user = session.user as { id?: string; role?: string; businessId?: string }
  if (!user.id || !user.businessId) return null
  return { userId: user.id, businessId: user.businessId, role: user.role ?? "staff" }
}
