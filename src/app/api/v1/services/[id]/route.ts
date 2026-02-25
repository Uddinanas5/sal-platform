import { withV1Auth } from "@/lib/api/auth"
import { apiSuccess, ERRORS } from "@/lib/api/response"
import { hasRole } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const updateServiceSchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().optional(),
  duration: z.number().int().positive().optional(),
  price: z.number().nonnegative().optional(),
  color: z.string().optional(),
  isActive: z.boolean().optional(),
})

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()
  const { id } = await params

  const service = await prisma.service.findUnique({
    where: { id, businessId: ctx.businessId, deletedAt: null },
    include: { category: true },
  })
  if (!service) return ERRORS.NOT_FOUND("Service")
  return apiSuccess(service)
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()
  if (!hasRole(ctx.role, "admin")) return ERRORS.FORBIDDEN()
  const { id } = await params

  let body: unknown
  try { body = await req.json() } catch { return ERRORS.BAD_REQUEST("Invalid JSON") }

  const url = new URL(req.url)
  const action = url.searchParams.get("action")

  if (action === "toggle") {
    const service = await prisma.service.findUnique({ where: { id, businessId: ctx.businessId } })
    if (!service) return ERRORS.NOT_FOUND("Service")
    const updated = await prisma.service.update({
      where: { id, businessId: ctx.businessId },
      data: { isActive: !service.isActive },
    })
    return apiSuccess(updated)
  }

  const parsed = updateServiceSchema.safeParse(body)
  if (!parsed.success) return ERRORS.BAD_REQUEST(parsed.error.issues[0]?.message ?? "Invalid input")

  try {
    const service = await prisma.service.update({
      where: { id, businessId: ctx.businessId },
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
        durationMinutes: parsed.data.duration,
        price: parsed.data.price,
        color: parsed.data.color,
        isActive: parsed.data.isActive,
      },
    })
    return apiSuccess(service)
  } catch {
    return ERRORS.NOT_FOUND("Service")
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()
  if (!hasRole(ctx.role, "admin")) return ERRORS.FORBIDDEN()
  const { id } = await params

  try {
    await prisma.service.update({
      where: { id, businessId: ctx.businessId },
      data: { isActive: false, deletedAt: new Date() },
    })
    return apiSuccess({ deleted: true })
  } catch {
    return ERRORS.NOT_FOUND("Service")
  }
}
