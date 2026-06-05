import { withV1Auth } from "@/lib/api/auth"
import { parseJsonBody, requireV1Context } from "@/lib/api/route-helpers"
import { apiSuccess, ERRORS } from "@/lib/api/response"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const createServiceSchema = z.object({
  name: z.string().trim().min(1, "Service name is required"),
  description: z.string().optional(),
  duration: z.number().int().positive("Duration must be positive"),
  price: z.number().nonnegative("Price must be non-negative"),
  categoryId: z.string().uuid(),
  color: z.string().optional(),
})

export async function GET(req: Request) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()

  const services = await prisma.service.findMany({
    where: { businessId: ctx.businessId, deletedAt: null },
    include: { category: { select: { id: true, name: true } } },
    orderBy: { name: "asc" },
  })

  return apiSuccess(services)
}

export async function POST(req: Request) {
  const auth = await requireV1Context(req, "admin")
  if (!auth.ok) return auth.response

  const parsed = await parseJsonBody(req, createServiceSchema)
  if (!parsed.ok) return parsed.response

  const category = await prisma.serviceCategory.findFirst({
    where: { id: parsed.data.categoryId, businessId: auth.ctx.businessId, isActive: true },
    select: { id: true },
  })
  if (!category) return ERRORS.BAD_REQUEST("Service category does not belong to this business")

  const service = await prisma.service.create({
    data: {
      businessId: auth.ctx.businessId,
      categoryId: parsed.data.categoryId,
      name: parsed.data.name,
      description: parsed.data.description,
      durationMinutes: parsed.data.duration,
      price: parsed.data.price,
      color: parsed.data.color,
      isActive: true,
    },
  })

  return apiSuccess(service, 201)
}
