import { withV1Auth } from "@/lib/api/auth"
import { apiSuccess, ERRORS } from "@/lib/api/response"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const timeOffSchema = z.object({
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  type: z.enum(["vacation", "sick", "personal", "other"]),
  notes: z.string().optional(),
})

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()
  const { id } = await params

  let body: unknown
  try { body = await req.json() } catch { return ERRORS.BAD_REQUEST("Invalid JSON") }

  const parsed = timeOffSchema.safeParse(body)
  if (!parsed.success) return ERRORS.BAD_REQUEST(parsed.error.issues[0]?.message ?? "Invalid input")

  const staff = await prisma.staff.findFirst({
    where: { id, primaryLocation: { businessId: ctx.businessId } },
  })
  if (!staff) return ERRORS.NOT_FOUND("Staff member")

  const timeOff = await prisma.staffTimeOff.create({
    data: {
      staffId: id,
      startDate: new Date(parsed.data.startDate),
      endDate: new Date(parsed.data.endDate),
      type: parsed.data.type,
      status: "pending",
      notes: parsed.data.notes,
    },
  })

  return apiSuccess(timeOff, 201)
}
