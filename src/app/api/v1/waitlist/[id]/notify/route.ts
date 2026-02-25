import { withV1Auth } from "@/lib/api/auth"
import { apiSuccess, ERRORS } from "@/lib/api/response"
import { hasRole } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()
  if (!hasRole(ctx.role, "admin")) return ERRORS.FORBIDDEN()
  const { id } = await params

  try {
    const entry = await prisma.waitlistEntry.update({
      where: { id, businessId: ctx.businessId },
      data: { status: "notified", notifiedAt: new Date() },
    })
    return apiSuccess(entry)
  } catch {
    return ERRORS.NOT_FOUND("Waitlist entry")
  }
}
