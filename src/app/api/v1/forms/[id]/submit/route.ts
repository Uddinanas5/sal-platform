import { withV1Auth } from "@/lib/api/auth"
import { assertOwnedRefs } from "@/lib/api/ownership"
import { apiSuccess, ERRORS } from "@/lib/api/response"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const submitSchema = z.object({
  clientId: z.string().uuid(),
  appointmentId: z.string().uuid().optional(),
  data: z.record(z.string(), z.unknown()),
})

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()
  const { id } = await params

  let body: unknown
  try { body = await req.json() } catch { return ERRORS.BAD_REQUEST("Invalid JSON") }

  const parsed = submitSchema.safeParse(body)
  if (!parsed.success) return ERRORS.BAD_REQUEST(parsed.error.issues[0]?.message ?? "Invalid input")

  const template = await prisma.formTemplate.findUnique({ where: { id } })
  if (!template || template.businessId !== ctx.businessId) return ERRORS.NOT_FOUND("Form template")

  // The client/appointment a submission is bound to must belong to this business.
  const unowned = await assertOwnedRefs(ctx, {
    client: parsed.data.clientId,
    appointment: parsed.data.appointmentId,
  })
  if (unowned) return ERRORS.NOT_FOUND(unowned)

  const submission = await prisma.formSubmission.create({
    data: {
      templateId: id,
      clientId: parsed.data.clientId,
      appointmentId: parsed.data.appointmentId,
      data: parsed.data.data as never,
      submittedAt: new Date(),
    },
  })
  return apiSuccess(submission, 201)
}
