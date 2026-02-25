import { withV1Auth } from "@/lib/api/auth"
import { apiSuccess, ERRORS } from "@/lib/api/response"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const processPaymentSchema = z.object({
  clientId: z.string().uuid().optional(),
  appointmentId: z.string().uuid().optional(),
  items: z.array(z.object({
    type: z.enum(["service", "product"]),
    id: z.string().min(1),
    price: z.number().nonnegative(),
    quantity: z.number().int().positive(),
  })),
  subtotal: z.number().nonnegative(),
  discount: z.number().nonnegative(),
  tax: z.number().nonnegative(),
  tip: z.number().nonnegative(),
  total: z.number().nonnegative(),
  method: z.enum(["cash", "card", "gift_card", "other"]),
})

export async function POST(req: Request) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()

  let body: unknown
  try { body = await req.json() } catch { return ERRORS.BAD_REQUEST("Invalid JSON") }

  const parsed = processPaymentSchema.safeParse(body)
  if (!parsed.success) return ERRORS.BAD_REQUEST(parsed.error.issues[0]?.message ?? "Invalid input")

  const data = parsed.data

  try {
    const payment = await prisma.$transaction(async (tx) => {
      const count = await tx.payment.count({ where: { businessId: ctx.businessId } })
      const paymentRef = `PAY-${String(count + 1).padStart(4, "0")}`

      const created = await tx.payment.create({
        data: {
          businessId: ctx.businessId,
          clientId: data.clientId ?? null,
          appointmentId: data.appointmentId ?? null,
          paymentReference: paymentRef,
          type: "payment",
          method: data.method,
          status: "completed",
          amount: data.subtotal - data.discount,
          tipAmount: data.tip,
          totalAmount: data.total,
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
            totalSpent: { increment: data.total },
            totalVisits: { increment: 1 },
            lastVisitAt: new Date(),
            loyaltyPoints: { increment: Math.floor(data.total) },
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
