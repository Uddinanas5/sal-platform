import { withV1Auth } from "@/lib/api/auth"
import { canAccessAppointmentSeries } from "@/lib/api/appointment-access"
import { apiSuccess, ERRORS } from "@/lib/api/response"
import { prisma } from "@/lib/prisma"

export async function DELETE(req: Request, { params }: { params: Promise<{ seriesId: string }> }) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()
  const { seriesId } = await params
  if (!(await canAccessAppointmentSeries(ctx, seriesId))) return ERRORS.FORBIDDEN()

  const url = new URL(req.url)
  const cancelFrom = url.searchParams.get("cancelFrom")

  // Validate cancelFrom up front: an unparseable value becomes an Invalid Date,
  // which throws a RangeError when Prisma serializes it — crashing the request.
  let cancelFromDate: Date | null = null
  if (cancelFrom) {
    cancelFromDate = new Date(cancelFrom)
    if (Number.isNaN(cancelFromDate.getTime())) {
      return ERRORS.BAD_REQUEST("Invalid cancelFrom date")
    }
  }

  const seriesAppointment = await prisma.appointment.findFirst({
    where: { seriesId, businessId: ctx.businessId },
  })
  if (!seriesAppointment) return ERRORS.NOT_FOUND("Series")

  const where: Record<string, unknown> = {
    seriesId,
    businessId: ctx.businessId,
    status: { notIn: ["completed", "cancelled"] },
  }
  if (cancelFromDate) where.startTime = { gte: cancelFromDate }

  const result = await prisma.appointment.updateMany({
    where: where as never,
    data: { status: "cancelled", cancelledAt: new Date(), cancellationReason: "Recurring series cancelled" },
  })

  return apiSuccess({ cancelled: result.count })
}
