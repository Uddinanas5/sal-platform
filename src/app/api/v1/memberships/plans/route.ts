import { withV1Auth } from "@/lib/api/auth"
import { apiSuccess, ERRORS } from "@/lib/api/response"
import { hasRole } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const billingCycleEnum = z.enum(["monthly", "quarterly", "yearly", "one_time"])

const createPlanSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().nonnegative(),
  billingCycle: billingCycleEnum,
  sessionsIncluded: z.number().int().nonnegative().optional(),
  discountPercent: z.number().nonnegative().optional(),
  serviceIds: z.array(z.string().uuid()).optional(),
  benefits: z.array(z.string()).optional(),
})

export async function GET(req: Request) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()
  if (!hasRole(ctx.role, "admin")) return ERRORS.FORBIDDEN()

  const plans = await prisma.membershipPlan.findMany({
    where: { businessId: ctx.businessId },
    orderBy: { createdAt: "desc" },
  })
  return apiSuccess(plans)
}

export async function POST(req: Request) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()
  if (!hasRole(ctx.role, "admin")) return ERRORS.FORBIDDEN()

  let body: unknown
  try { body = await req.json() } catch { return ERRORS.BAD_REQUEST("Invalid JSON") }

  const parsed = createPlanSchema.safeParse(body)
  if (!parsed.success) return ERRORS.BAD_REQUEST(parsed.error.issues[0]?.message ?? "Invalid input")

  const plan = await prisma.membershipPlan.create({
    data: {
      businessId: ctx.businessId,
      name: parsed.data.name,
      description: parsed.data.description,
      price: parsed.data.price,
      billingCycle: parsed.data.billingCycle,
      sessionsIncluded: parsed.data.sessionsIncluded,
      discountPercent: parsed.data.discountPercent,
      serviceIds: parsed.data.serviceIds ?? [],
      benefits: parsed.data.benefits ?? [],
    },
  })
  return apiSuccess(plan, 201)
}
