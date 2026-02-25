import { withV1Auth } from "@/lib/api/auth"
import { apiSuccess, ERRORS } from "@/lib/api/response"
import { hasRole } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const createFormSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  fields: z.array(z.record(z.string(), z.unknown())),
  serviceIds: z.array(z.string().uuid()).optional(),
  isAutoSend: z.boolean().optional(),
  isRequired: z.boolean().optional(),
})

export async function GET(req: Request) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()
  if (!hasRole(ctx.role, "admin")) return ERRORS.FORBIDDEN()

  const forms = await prisma.formTemplate.findMany({
    where: { businessId: ctx.businessId, isActive: true },
    orderBy: { name: "asc" },
  })
  return apiSuccess(forms)
}

export async function POST(req: Request) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()
  if (!hasRole(ctx.role, "admin")) return ERRORS.FORBIDDEN()

  let body: unknown
  try { body = await req.json() } catch { return ERRORS.BAD_REQUEST("Invalid JSON") }

  const parsed = createFormSchema.safeParse(body)
  if (!parsed.success) return ERRORS.BAD_REQUEST(parsed.error.issues[0]?.message ?? "Invalid input")

  const form = await prisma.formTemplate.create({
    data: {
      businessId: ctx.businessId,
      name: parsed.data.name,
      description: parsed.data.description,
      fields: parsed.data.fields as never,
      serviceIds: parsed.data.serviceIds ?? [],
      isAutoSend: parsed.data.isAutoSend ?? false,
      isRequired: parsed.data.isRequired ?? false,
    },
  })
  return apiSuccess(form, 201)
}
