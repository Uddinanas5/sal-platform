import { withV1Auth } from "@/lib/api/auth"
import { apiSuccess, ERRORS } from "@/lib/api/response"
import { hasRole } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const updateClientSchema = z.object({
  firstName: z.string().trim().min(1).optional(),
  lastName: z.string().trim().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
})

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()

  const { id } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return ERRORS.BAD_REQUEST("Invalid JSON")
  }

  const parsed = updateClientSchema.safeParse(body)
  if (!parsed.success) return ERRORS.BAD_REQUEST(parsed.error.issues[0]?.message ?? "Invalid input")

  if (parsed.data.email) {
    const normalizedEmail = parsed.data.email.trim().toLowerCase()
    const existing = await prisma.client.findFirst({
      where: { businessId: ctx.businessId, email: normalizedEmail, id: { not: id } },
    })
    if (existing) return ERRORS.BAD_REQUEST("A client with this email already exists")
    parsed.data.email = normalizedEmail
  }

  try {
    const client = await prisma.client.update({
      where: { id, businessId: ctx.businessId },
      data: parsed.data,
    })
    return apiSuccess(client)
  } catch {
    return ERRORS.NOT_FOUND("Client")
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()
  if (!hasRole(ctx.role, "admin")) return ERRORS.FORBIDDEN()

  const { id } = await params

  try {
    await prisma.client.update({
      where: { id, businessId: ctx.businessId },
      data: { deletedAt: new Date() },
    })
    return apiSuccess({ deleted: true })
  } catch {
    return ERRORS.NOT_FOUND("Client")
  }
}
