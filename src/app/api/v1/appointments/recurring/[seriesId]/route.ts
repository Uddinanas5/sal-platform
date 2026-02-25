import { withV1Auth } from "@/lib/api/auth"
import { apiSuccess, ERRORS } from "@/lib/api/response"
import { prisma } from "@/lib/prisma"

export async function DELETE(req: Request, { params }: { params: Promise<{ seriesId: string }> }) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()
  const { seriesId } = await params

  const url = new URL(req.url)
  const cancelFrom = url.searchParams.get("cancelFrom")

  const seriesAppointment = await prisma.appointment.findFirst({
    where: { seriesId, businessId: ctx.businessId },
  })
  if (!seriesAppointment) return ERRORS.NOT_FOUND("Series")

  const where: Record<string, unknown> = {
    seriesId,
    businessId: ctx.businessId,
    status: { notIn: ["completed", "cancelled"] },
  }
  if (cancelFrom) where.startTime = { gte: new Date(cancelFrom) }

  const result = await prisma.appointment.updateMany({
    where: where as never,
    data: { status: "cancelled", cancelledAt: new Date(), cancellationReason: "Recurring series cancelled" },
  })

  return apiSuccess({ cancelled: result.count })
}
