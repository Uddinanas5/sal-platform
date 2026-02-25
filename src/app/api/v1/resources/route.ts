import { withV1Auth } from "@/lib/api/auth"
import { apiSuccess, ERRORS } from "@/lib/api/response"
import { hasRole } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const createResourceSchema = z.object({
  name: z.string().min(1),
  type: z.string().optional(),
  description: z.string().optional(),
  capacity: z.number().int().positive().optional(),
  serviceIds: z.array(z.string().uuid()).optional(),
})

export async function GET(req: Request) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()
  if (!hasRole(ctx.role, "admin")) return ERRORS.FORBIDDEN()

  const resources = await prisma.resource.findMany({
    where: { businessId: ctx.businessId, isActive: true },
    orderBy: { name: "asc" },
  })
  return apiSuccess(resources)
}

export async function POST(req: Request) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()
  if (!hasRole(ctx.role, "admin")) return ERRORS.FORBIDDEN()

  let body: unknown
  try { body = await req.json() } catch { return ERRORS.BAD_REQUEST("Invalid JSON") }

  const parsed = createResourceSchema.safeParse(body)
  if (!parsed.success) return ERRORS.BAD_REQUEST(parsed.error.issues[0]?.message ?? "Invalid input")

  const location = await prisma.location.findFirst({ where: { businessId: ctx.businessId } })
  if (!location) return ERRORS.BAD_REQUEST("Business not configured")

  const resource = await prisma.resource.create({
    data: {
      businessId: ctx.businessId,
      locationId: location.id,
      name: parsed.data.name,
      type: parsed.data.type ?? "room",
      description: parsed.data.description,
      capacity: parsed.data.capacity ?? 1,
      serviceIds: parsed.data.serviceIds ?? [],
    },
  })
  return apiSuccess(resource, 201)
}
