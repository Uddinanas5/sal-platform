import { withV1Auth } from "@/lib/api/auth"
import { apiSuccess, ERRORS } from "@/lib/api/response"
import { hasRole } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const channelEnum = z.enum(["email", "sms", "both"])

const createCampaignSchema = z.object({
  name: z.string().min(1),
  subject: z.string().optional(),
  body: z.string().min(1),
  channel: channelEnum,
  audienceType: z.string().optional(),
  scheduledAt: z.coerce.date().optional(),
})

export async function GET(req: Request) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()
  if (!hasRole(ctx.role, "admin")) return ERRORS.FORBIDDEN()

  const campaigns = await prisma.campaign.findMany({
    where: { businessId: ctx.businessId },
    orderBy: { createdAt: "desc" },
  })
  return apiSuccess(campaigns)
}

export async function POST(req: Request) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()
  if (!hasRole(ctx.role, "admin")) return ERRORS.FORBIDDEN()

  let body: unknown
  try { body = await req.json() } catch { return ERRORS.BAD_REQUEST("Invalid JSON") }

  const parsed = createCampaignSchema.safeParse(body)
  if (!parsed.success) return ERRORS.BAD_REQUEST(parsed.error.issues[0]?.message ?? "Invalid input")

  const campaign = await prisma.campaign.create({
    data: {
      businessId: ctx.businessId,
      name: parsed.data.name,
      subject: parsed.data.subject,
      body: parsed.data.body,
      channel: parsed.data.channel,
      audienceType: parsed.data.audienceType ?? "all",
      scheduledAt: parsed.data.scheduledAt,
      status: parsed.data.scheduledAt ? "scheduled" : "draft",
    },
  })
  return apiSuccess(campaign, 201)
}
