import { withV1Auth } from "@/lib/api/auth"
import { apiSuccess, ERRORS } from "@/lib/api/response"
import { hasRole } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const updateRoleSchema = z.object({ newRole: z.enum(["staff", "admin"]) })

export async function DELETE(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()
  if (!hasRole(ctx.role, "admin")) return ERRORS.FORBIDDEN()
  const { userId } = await params

  if (userId === ctx.userId) return ERRORS.BAD_REQUEST("You cannot remove yourself")

  const targetUser = await prisma.user.findUnique({ where: { id: userId } })
  if (!targetUser) return ERRORS.NOT_FOUND("User")

  if (ctx.role === "admin" && targetUser.role !== "staff") {
    return ERRORS.FORBIDDEN()
  }

  const staffProfile = await prisma.staff.findFirst({
    where: { userId, primaryLocation: { businessId: ctx.businessId }, isActive: true },
  })
  if (!staffProfile) return ERRORS.NOT_FOUND("Team member")

  await prisma.staff.update({
    where: { id: staffProfile.id },
    data: { isActive: false, deletedAt: new Date() },
  })

  return apiSuccess({ removed: true })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()
  if (!hasRole(ctx.role, "owner")) return ERRORS.FORBIDDEN()
  const { userId } = await params

  if (userId === ctx.userId) return ERRORS.BAD_REQUEST("You cannot change your own role")

  let body: unknown
  try { body = await req.json() } catch { return ERRORS.BAD_REQUEST("Invalid JSON") }

  const parsed = updateRoleSchema.safeParse(body)
  if (!parsed.success) return ERRORS.BAD_REQUEST(parsed.error.issues[0]?.message ?? "Invalid input")

  const targetUser = await prisma.user.findUnique({ where: { id: userId } })
  if (!targetUser) return ERRORS.NOT_FOUND("User")
  if (targetUser.role === "owner") return ERRORS.BAD_REQUEST("Cannot change another owner's role")

  const staffProfile = await prisma.staff.findFirst({
    where: { userId, primaryLocation: { businessId: ctx.businessId } },
  })
  if (!staffProfile) return ERRORS.NOT_FOUND("Team member")

  await prisma.user.update({ where: { id: userId }, data: { role: parsed.data.newRole } })
  return apiSuccess({ updated: true, newRole: parsed.data.newRole })
}
