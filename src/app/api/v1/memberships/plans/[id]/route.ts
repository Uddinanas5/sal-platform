import { withV1Auth } from "@/lib/api/auth"
import { apiSuccess, ERRORS } from "@/lib/api/response"
import { hasRole } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const updatePlanSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  price: z.number().nonnegative().optional(),
  billingCycle: z.enum(["monthly", "quarterly", "yearly", "one_time"]).optional(),
  sessionsIncluded: z.number().int().nonnegative().nullable().optional(),
  discountPercent: z.number().nonnegative().nullable().optional(),
  benefits: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
})

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()
  if (!hasRole(ctx.role, "admin")) return ERRORS.FORBIDDEN()
  const { id } = await params

  let body: unknown
  try { body = await req.json() } catch { return ERRORS.BAD_REQUEST("Invalid JSON") }

  const parsed = updatePlanSchema.safeParse(body)
  if (!parsed.success) return ERRORS.BAD_REQUEST(parsed.error.issues[0]?.message ?? "Invalid input")

  try {
    const plan = await prisma.membershipPlan.update({
      where: { id, businessId: ctx.businessId },
      data: parsed.data,
    })
    return apiSuccess(plan)
  } catch {
    return ERRORS.NOT_FOUND("Membership plan")
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()
  if (!hasRole(ctx.role, "admin")) return ERRORS.FORBIDDEN()
  const { id } = await params

  try {
    await prisma.membershipPlan.delete({ where: { id, businessId: ctx.businessId } })
    return apiSuccess({ deleted: true })
  } catch {
    return ERRORS.NOT_FOUND("Membership plan")
  }
}
