import { withV1Auth } from "@/lib/api/auth"
import { apiSuccess, ERRORS } from "@/lib/api/response"
import { hasRole } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const createMembershipSchema = z.object({
  clientId: z.string().uuid(),
  planId: z.string().uuid(),
  startDate: z.coerce.date(),
})

export async function GET(req: Request) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()
  if (!hasRole(ctx.role, "admin")) return ERRORS.FORBIDDEN()

  const memberships = await prisma.membership.findMany({
    where: { plan: { businessId: ctx.businessId } },
    include: {
      plan: { select: { id: true, name: true, billingCycle: true } },
      client: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  })
  return apiSuccess(memberships)
}

export async function POST(req: Request) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()

  let body: unknown
  try { body = await req.json() } catch { return ERRORS.BAD_REQUEST("Invalid JSON") }

  const parsed = createMembershipSchema.safeParse(body)
  if (!parsed.success) return ERRORS.BAD_REQUEST(parsed.error.issues[0]?.message ?? "Invalid input")

  const plan = await prisma.membershipPlan.findFirst({
    where: { id: parsed.data.planId, businessId: ctx.businessId },
  })
  if (!plan) return ERRORS.NOT_FOUND("Membership plan")

  const membership = await prisma.membership.create({
    data: {
      clientId: parsed.data.clientId,
      planId: parsed.data.planId,
      startDate: parsed.data.startDate,
      sessionsRemaining: plan.sessionsIncluded,
      nextBillingDate: plan.billingCycle === "one_time" ? null : parsed.data.startDate,
    },
  })
  return apiSuccess(membership, 201)
}
