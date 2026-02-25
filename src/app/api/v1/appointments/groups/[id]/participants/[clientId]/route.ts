import { withV1Auth } from "@/lib/api/auth"
import { apiSuccess, ERRORS } from "@/lib/api/response"
import { prisma } from "@/lib/prisma"

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; clientId: string }> }
) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()
  const { id, clientId } = await params

  const appointment = await prisma.appointment.findUnique({
    where: { id, businessId: ctx.businessId },
  })
  if (!appointment) return ERRORS.NOT_FOUND("Appointment")

  try {
    await prisma.groupParticipant.delete({
      where: { appointmentId_clientId: { appointmentId: id, clientId } },
    })
    return apiSuccess({ removed: true })
  } catch {
    return ERRORS.NOT_FOUND("Participant")
  }
}
