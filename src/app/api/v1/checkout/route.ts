import { withV1Auth } from "@/lib/api/auth"
import { apiSuccess, ERRORS } from "@/lib/api/response"
import { calculateCheckoutTotals } from "@/lib/checkout/pricing"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const processPaymentSchema = z.object({
  clientId: z.string().uuid().optional(),
  appointmentId: z.string().uuid().optional(),
  items: z.array(z.object({
    type: z.enum(["service", "product", "custom"]),
    id: z.string().min(1),
    name: z.string().optional(),
    price: z.number().nonnegative().optional(),
    quantity: z.number().int().positive(),
  })),
  subtotal: z.number().nonnegative(),
  discount: z.number().nonnegative(),
  tax: z.number().nonnegative(),
  tip: z.number().nonnegative(),
  total: z.number().nonnegative(),
  method: z.enum(["cash", "card", "gift_card", "other"]),
})

function generatePaymentReference() {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `PAY-${timestamp}-${random}`.toUpperCase()
}

export async function POST(req: Request) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()

  let body: unknown
  try { body = await req.json() } catch { return ERRORS.BAD_REQUEST("Invalid JSON") }

  const parsed = processPaymentSchema.safeParse(body)
  if (!parsed.success) return ERRORS.BAD_REQUEST(parsed.error.issues[0]?.message ?? "Invalid input")

  const data = parsed.data

  try {
    const [client, appointment] = await Promise.all([
      data.clientId
        ? prisma.client.findFirst({
            where: { id: data.clientId, businessId: ctx.businessId, deletedAt: null },
            select: { id: true },
          })
        : Promise.resolve(null),
      data.appointmentId
        ? prisma.appointment.findFirst({
            where: { id: data.appointmentId, businessId: ctx.businessId },
            select: { id: true, clientId: true },
          })
        : Promise.resolve(null),
    ])

    if (data.clientId && !client) return ERRORS.NOT_FOUND("Client")
    if (data.appointmentId && !appointment) return ERRORS.NOT_FOUND("Appointment")
    if (appointment?.clientId && data.clientId && appointment.clientId !== data.clientId) {
      return ERRORS.BAD_REQUEST("Client does not match appointment")
    }

    const payment = await prisma.$transaction(async (tx) => {
      const totals = await calculateCheckoutTotals(tx, ctx.businessId, data.items, {
        discount: data.discount,
        tip: data.tip,
      })
      const created = await tx.payment.create({
        data: {
          businessId: ctx.businessId,
          clientId: data.clientId ?? null,
          appointmentId: data.appointmentId ?? null,
          paymentReference: generatePaymentReference(),
          type: "payment",
          method: data.method,
          status: "completed",
          amount: totals.subtotal - totals.discount,
          tipAmount: totals.tip,
          totalAmount: totals.total,
          currency: "USD",
          processedAt: new Date(),
        },
      })

      if (data.appointmentId) {
        await tx.appointment.update({
          where: { id: data.appointmentId, businessId: ctx.businessId },
          data: { status: "completed", completedAt: new Date() },
        })
      }

      if (data.clientId) {
        await tx.client.update({
          where: { id: data.clientId, businessId: ctx.businessId },
          data: {
            totalSpent: { increment: totals.total },
            totalVisits: { increment: 1 },
            lastVisitAt: new Date(),
            loyaltyPoints: { increment: Math.floor(totals.total) },
          },
        })
      }

      return created
    })

    return apiSuccess({ receiptId: payment.id }, 201)
  } catch (e) {
    console.error("POST /api/v1/checkout error:", e)
    return ERRORS.SERVER_ERROR()
  }
}
