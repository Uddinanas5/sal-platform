import { withV1Auth } from "@/lib/api/auth"
import { apiSuccess, ERRORS } from "@/lib/api/response"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const bookSchema = z.object({ appointmentId: z.string().uuid() })

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()
  const { id } = await params

  let body: unknown
  try { body = await req.json() } catch { return ERRORS.BAD_REQUEST("Invalid JSON") }

  const parsed = bookSchema.safeParse(body)
  if (!parsed.success) return ERRORS.BAD_REQUEST(parsed.error.issues[0]?.message ?? "Invalid input")

  // Verify the appointment belongs to THIS business before linking it — the
  // column has no FK, so without this a caller could pin their waitlist entry to
  // another tenant's appointmentId (cross-tenant dangling reference).
  const appt = await prisma.appointment.findFirst({
    where: { id: parsed.data.appointmentId, businessId: ctx.businessId },
    select: { id: true },
  })
  if (!appt) return ERRORS.NOT_FOUND("Appointment")

  try {
    const entry = await prisma.waitlistEntry.update({
      where: { id, businessId: ctx.businessId },
      data: { status: "booked", bookedAt: new Date(), appointmentId: parsed.data.appointmentId },
    })
    return apiSuccess(entry)
  } catch {
    return ERRORS.NOT_FOUND("Waitlist entry")
  }
}
