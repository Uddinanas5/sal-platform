import { withV1Auth } from "@/lib/api/auth"
import { canAccessAppointment } from "@/lib/api/appointment-access"
import { apiSuccess, ERRORS } from "@/lib/api/response"
import { prisma } from "@/lib/prisma"
import { lockAppointment, isBookingContentionError } from "@/lib/db/advisory-lock"
import { z } from "zod"

class GroupFullError extends Error {}
class DuplicateParticipantError extends Error {}

const addParticipantSchema = z.object({
  clientId: z.string().uuid(),
})

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()
  const { id } = await params
  if (!(await canAccessAppointment(ctx, id))) return ERRORS.FORBIDDEN()

  let body: unknown
  try { body = await req.json() } catch { return ERRORS.BAD_REQUEST("Invalid JSON") }

  const parsed = addParticipantSchema.safeParse(body)
  if (!parsed.success) return ERRORS.BAD_REQUEST(parsed.error.issues[0]?.message ?? "Invalid input")

  const appointment = await prisma.appointment.findUnique({
    where: { id, businessId: ctx.businessId },
    select: { isGroupBooking: true, maxParticipants: true },
  })

  if (!appointment) return ERRORS.NOT_FOUND("Appointment")
  if (!appointment.isGroupBooking) return ERRORS.BAD_REQUEST("Not a group booking")

  const client = await prisma.client.findFirst({
    where: { id: parsed.data.clientId, businessId: ctx.businessId, deletedAt: null },
  })
  if (!client) return ERRORS.NOT_FOUND("Client")

  // Capacity + duplicate check + insert must be atomic: take a per-appointment
  // advisory lock, RE-COUNT under it, then create — otherwise two staff adding
  // the last seat concurrently both read count = max-1 and both insert,
  // overselling maxParticipants. Mirrors actions/recurring.ts addGroupParticipant.
  try {
    const participant = await prisma.$transaction(async (tx) => {
      await lockAppointment(tx, ctx.businessId, id)
      const existing = await tx.groupParticipant.findFirst({
        where: { appointmentId: id, clientId: parsed.data.clientId },
        select: { id: true },
      })
      if (existing) throw new DuplicateParticipantError()
      const count = await tx.groupParticipant.count({ where: { appointmentId: id } })
      if (count >= appointment.maxParticipants) throw new GroupFullError()
      return tx.groupParticipant.create({
        data: { appointmentId: id, clientId: parsed.data.clientId },
      })
    }, { timeout: 20000, maxWait: 15000 })

    return apiSuccess(participant, 201)
  } catch (e) {
    if (e instanceof GroupFullError) return ERRORS.BAD_REQUEST("Group is full")
    if (e instanceof DuplicateParticipantError) return ERRORS.BAD_REQUEST("Client is already in this group")
    if (isBookingContentionError(e)) return ERRORS.BAD_REQUEST("Someone else just joined — please try again")
    throw e
  }
}
