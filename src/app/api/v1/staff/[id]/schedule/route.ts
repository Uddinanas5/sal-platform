import { withV1Auth } from "@/lib/api/auth"
import { apiSuccess, ERRORS } from "@/lib/api/response"
import { hasRole } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const scheduleSchema = z.object({
  schedule: z.array(z.object({
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: z.string(),
    endTime: z.string(),
    isWorking: z.boolean(),
  })),
})

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()
  if (!hasRole(ctx.role, "admin")) return ERRORS.FORBIDDEN()
  const { id } = await params

  let body: unknown
  try { body = await req.json() } catch { return ERRORS.BAD_REQUEST("Invalid JSON") }

  const parsed = scheduleSchema.safeParse(body)
  if (!parsed.success) return ERRORS.BAD_REQUEST(parsed.error.issues[0]?.message ?? "Invalid input")

  const staff = await prisma.staff.findFirst({
    where: { id, primaryLocation: { businessId: ctx.businessId } },
  })
  if (!staff) return ERRORS.NOT_FOUND("Staff member")

  await prisma.staffSchedule.deleteMany({ where: { staffId: id } })

  for (const day of parsed.data.schedule) {
    if (day.isWorking) {
      await prisma.staffSchedule.create({
        data: {
          staffId: id,
          locationId: staff.locationId,
          dayOfWeek: day.dayOfWeek,
          startTime: new Date(`2000-01-01T${day.startTime}:00`),
          endTime: new Date(`2000-01-01T${day.endTime}:00`),
          isWorking: true,
        },
      })
    }
  }

  return apiSuccess({ updated: true })
}
