import { withV1Auth } from "@/lib/api/auth"
import { apiSuccess, ERRORS } from "@/lib/api/response"
import { hasRole } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()
  if (!hasRole(ctx.role, "admin")) return ERRORS.FORBIDDEN()
  const { id } = await params

  const url = new URL(req.url)
  const action = url.searchParams.get("action")

  const membership = await prisma.membership.findFirst({
    where: { id, plan: { businessId: ctx.businessId } },
  })
  if (!membership) return ERRORS.NOT_FOUND("Membership")

  let updateData: Record<string, unknown> = {}

  if (action === "cancel") {
    updateData = { status: "cancelled_membership", cancelledAt: new Date() }
  } else if (action === "pause") {
    updateData = { status: "paused_membership", pausedAt: new Date() }
  } else if (action === "resume") {
    updateData = { status: "active_membership", pausedAt: null }
  } else {
    return ERRORS.BAD_REQUEST("Invalid action. Use ?action=cancel|pause|resume")
  }

  const updated = await prisma.membership.update({ where: { id }, data: updateData })
  return apiSuccess(updated)
}
