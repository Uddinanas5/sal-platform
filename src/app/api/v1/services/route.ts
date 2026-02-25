import { withV1Auth } from "@/lib/api/auth"
import { apiSuccess, ERRORS } from "@/lib/api/response"
import { hasRole } from "@/lib/permissions"
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
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()
  if (!hasRole(ctx.role, "admin")) return ERRORS.FORBIDDEN()

  let body: unknown
  try { body = await req.json() } catch { return ERRORS.BAD_REQUEST("Invalid JSON") }

  const parsed = createServiceSchema.safeParse(body)
  if (!parsed.success) return ERRORS.BAD_REQUEST(parsed.error.issues[0]?.message ?? "Invalid input")

  const service = await prisma.service.create({
    data: {
      businessId: ctx.businessId,
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
