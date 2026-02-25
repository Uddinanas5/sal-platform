import { withV1Auth } from "@/lib/api/auth"
import { apiSuccess, ERRORS } from "@/lib/api/response"
import { prisma } from "@/lib/prisma"

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()
  const { id } = await params

  try {
    await prisma.waitlistEntry.update({
      where: { id, businessId: ctx.businessId },
      data: { status: "cancelled_waitlist" },
    })
    return apiSuccess({ cancelled: true })
  } catch {
    return ERRORS.NOT_FOUND("Waitlist entry")
  }
}
