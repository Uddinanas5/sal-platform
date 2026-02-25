import { withV1Auth } from "@/lib/api/auth"
import { apiSuccess, ERRORS } from "@/lib/api/response"
import { hasRole } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const createDealSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  discountType: z.enum(["percentage", "fixed", "free_service"]),
  discountValue: z.number().nonnegative(),
  code: z.string().optional(),
  validFrom: z.coerce.date(),
  validUntil: z.coerce.date(),
  appliesTo: z.enum(["all", "services", "products", "specific"]).optional(),
  serviceIds: z.array(z.string().uuid()).optional(),
  usageLimit: z.number().int().nonnegative().optional(),
})

export async function GET(req: Request) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()
  if (!hasRole(ctx.role, "admin")) return ERRORS.FORBIDDEN()

  const deals = await prisma.deal.findMany({
    where: { businessId: ctx.businessId },
    orderBy: { createdAt: "desc" },
  })
  return apiSuccess(deals)
}

export async function POST(req: Request) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()
  if (!hasRole(ctx.role, "admin")) return ERRORS.FORBIDDEN()

  let body: unknown
  try { body = await req.json() } catch { return ERRORS.BAD_REQUEST("Invalid JSON") }

  const parsed = createDealSchema.safeParse(body)
  if (!parsed.success) return ERRORS.BAD_REQUEST(parsed.error.issues[0]?.message ?? "Invalid input")

  const deal = await prisma.deal.create({
    data: {
      businessId: ctx.businessId,
      name: parsed.data.name,
      description: parsed.data.description,
      discountType: parsed.data.discountType,
      discountValue: parsed.data.discountValue,
      code: parsed.data.code,
      validFrom: parsed.data.validFrom,
      validUntil: parsed.data.validUntil,
      appliesTo: parsed.data.appliesTo ?? "all",
      serviceIds: parsed.data.serviceIds ?? [],
      usageLimit: parsed.data.usageLimit,
    },
  })
  return apiSuccess(deal, 201)
}
