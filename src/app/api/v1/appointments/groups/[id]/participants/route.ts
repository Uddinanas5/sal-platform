import { withV1Auth } from "@/lib/api/auth"
import { apiSuccess, ERRORS } from "@/lib/api/response"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const addParticipantSchema = z.object({
  clientId: z.string().uuid(),
})

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()
  const { id } = await params

  let body: unknown
  try { body = await req.json() } catch { return ERRORS.BAD_REQUEST("Invalid JSON") }

  const parsed = addParticipantSchema.safeParse(body)
  if (!parsed.success) return ERRORS.BAD_REQUEST(parsed.error.issues[0]?.message ?? "Invalid input")

  const appointment = await prisma.appointment.findUnique({
    where: { id, businessId: ctx.businessId },
    include: { groupParticipants: true },
  })

  if (!appointment) return ERRORS.NOT_FOUND("Appointment")
  if (!appointment.isGroupBooking) return ERRORS.BAD_REQUEST("Not a group booking")
  if (appointment.groupParticipants.length >= appointment.maxParticipants) {
    return ERRORS.BAD_REQUEST("Group is full")
  }

  const participant = await prisma.groupParticipant.create({
    data: { appointmentId: id, clientId: parsed.data.clientId },
  })

  return apiSuccess(participant, 201)
}
