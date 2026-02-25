import { withV1Auth } from "@/lib/api/auth"
import { apiSuccess, ERRORS } from "@/lib/api/response"
import { hasRole } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const createStaffSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  role: z.string().min(1),
  serviceIds: z.array(z.string().uuid()).optional(),
})

export async function GET(req: Request) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()

  const staff = await prisma.staff.findMany({
    where: { primaryLocation: { businessId: ctx.businessId }, isActive: true, deletedAt: null },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, avatarUrl: true, role: true } },
      staffServices: { include: { service: { select: { id: true, name: true } } } },
    },
    orderBy: { user: { firstName: "asc" } },
  })

  return apiSuccess(staff)
}

export async function POST(req: Request) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()
  if (!hasRole(ctx.role, "admin")) return ERRORS.FORBIDDEN()

  let body: unknown
  try { body = await req.json() } catch { return ERRORS.BAD_REQUEST("Invalid JSON") }

  const parsed = createStaffSchema.safeParse(body)
  if (!parsed.success) return ERRORS.BAD_REQUEST(parsed.error.issues[0]?.message ?? "Invalid input")

  const location = await prisma.location.findFirst({ where: { businessId: ctx.businessId } })
  if (!location) return ERRORS.BAD_REQUEST("Business not configured")

  const existingUser = await prisma.user.findUnique({ where: { email: parsed.data.email } })
  if (existingUser) return ERRORS.BAD_REQUEST("A user with this email already exists")

  const user = await prisma.user.create({
    data: {
      email: parsed.data.email,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      phone: parsed.data.phone,
      role: "staff",
    },
  })

  const staff = await prisma.staff.create({
    data: { userId: user.id, locationId: location.id, title: parsed.data.role, isActive: true },
  })

  if (parsed.data.serviceIds?.length) {
    for (const serviceId of parsed.data.serviceIds) {
      await prisma.staffService.create({ data: { staffId: staff.id, serviceId } })
    }
  }

  return apiSuccess({ id: staff.id, userId: user.id }, 201)
}
