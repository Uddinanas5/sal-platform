import { withV1Auth } from "@/lib/api/auth"
import { apiSuccess, ERRORS } from "@/lib/api/response"
import { hasRole } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const createAutomatedMessageSchema = z.object({
  name: z.string().min(1),
  trigger: z.string().min(1),
  channel: z.enum(["email", "sms", "both"]),
  subject: z.string().optional(),
  body: z.string().min(1),
  delayHours: z.number().int().nonnegative().optional(),
})

export async function GET(req: Request) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()
  if (!hasRole(ctx.role, "admin")) return ERRORS.FORBIDDEN()

  const messages = await prisma.automatedMessage.findMany({
    where: { businessId: ctx.businessId },
    orderBy: { createdAt: "desc" },
  })
  return apiSuccess(messages)
}

export async function POST(req: Request) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()
  if (!hasRole(ctx.role, "admin")) return ERRORS.FORBIDDEN()

  let body: unknown
  try { body = await req.json() } catch { return ERRORS.BAD_REQUEST("Invalid JSON") }

  const parsed = createAutomatedMessageSchema.safeParse(body)
  if (!parsed.success) return ERRORS.BAD_REQUEST(parsed.error.issues[0]?.message ?? "Invalid input")

  const msg = await prisma.automatedMessage.create({
    data: {
      businessId: ctx.businessId,
      name: parsed.data.name,
      trigger: parsed.data.trigger as never,
      channel: parsed.data.channel,
      subject: parsed.data.subject,
      body: parsed.data.body,
      delayHours: parsed.data.delayHours ?? 0,
    },
  })
  return apiSuccess(msg, 201)
}
