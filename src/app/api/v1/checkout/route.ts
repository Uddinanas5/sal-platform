import { withV1Auth } from "@/lib/api/auth"
import { apiSuccess, ERRORS } from "@/lib/api/response"
import { prisma } from "@/lib/prisma"
import { randomBytes } from "crypto"
import { z } from "zod"

function generatePaymentReference() {
  const now = new Date()
  const yyyymmdd = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}`
  const suffix = randomBytes(4).toString("hex").toUpperCase()
  return `PAY-${yyyymmdd}-${suffix}`
}

const processPaymentSchema = z.object({
  clientId: z.string().uuid().optional(),
  appointmentId: z.string().uuid().optional(),
  items: z.array(z.object({
    type: z.enum(["service", "product"]),
    id: z.string().uuid(),
    quantity: z.number().int().positive(),
  })).min(1, "At least one item is required"),
  discount: z.number().nonnegative().default(0),
  tax: z.number().nonnegative().default(0),
  tip: z.number().nonnegative().default(0),
  method: z.enum(["cash", "card", "online", "gift_card", "other"]),
})

export async function POST(req: Request) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()

  let body: unknown
  try { body = await req.json() } catch { return ERRORS.BAD_REQUEST("Invalid JSON") }

  const parsed = processPaymentSchema.safeParse(body)
  if (!parsed.success) return ERRORS.BAD_REQUEST(parsed.error.issues[0]?.message ?? "Invalid input")

  const data = parsed.data

  const serviceIds = Array.from(new Set(data.items.filter(i => i.type === "service").map(i => i.id)))
  const productIds = Array.from(new Set(data.items.filter(i => i.type === "product").map(i => i.id)))

  const [services, products] = await Promise.all([
    serviceIds.length
      ? prisma.service.findMany({
          where: { id: { in: serviceIds }, businessId: ctx.businessId, deletedAt: null },
          select: { id: true, price: true },
        })
      : Promise.resolve([] as { id: string; price: import("@/generated/prisma").Prisma.Decimal }[]),
    productIds.length
      ? prisma.product.findMany({
          where: { id: { in: productIds }, businessId: ctx.businessId, deletedAt: null },
          select: { id: true, retailPrice: true },
        })
      : Promise.resolve([] as { id: string; retailPrice: import("@/generated/prisma").Prisma.Decimal }[]),
  ])

  if (services.length !== serviceIds.length) return ERRORS.BAD_REQUEST("One or more services not found")
  if (products.length !== productIds.length) return ERRORS.BAD_REQUEST("One or more products not found")

  const priceMap = new Map<string, number>()
  for (const s of services) priceMap.set(`service:${s.id}`, Number(s.price))
  for (const p of products) priceMap.set(`product:${p.id}`, Number(p.retailPrice))

  let subtotal = 0
  for (const item of data.items) {
    const price = priceMap.get(`${item.type}:${item.id}`)
    if (price === undefined) return ERRORS.BAD_REQUEST("Invalid item")
    subtotal += price * item.quantity
  }
  subtotal = Math.round(subtotal * 100) / 100

  if (data.discount > subtotal) return ERRORS.BAD_REQUEST("Discount cannot exceed subtotal")

  const amount = Math.round((subtotal - data.discount) * 100) / 100
  const total = Math.round((amount + data.tax + data.tip) * 100) / 100

  let resolvedClientId: string | undefined = data.clientId
  if (data.appointmentId) {
    const appt = await prisma.appointment.findFirst({
      where: { id: data.appointmentId, businessId: ctx.businessId },
      select: { clientId: true },
    })
    if (!appt) return ERRORS.NOT_FOUND("Appointment")
    if (data.clientId && appt.clientId && appt.clientId !== data.clientId) {
      return ERRORS.BAD_REQUEST("Appointment does not belong to this client")
    }
    if (!resolvedClientId && appt.clientId) {
      resolvedClientId = appt.clientId
    }
  }

  try {
    const payment = await prisma.$transaction(async (tx) => {
      const paymentRef = generatePaymentReference()

      const created = await tx.payment.create({
        data: {
          businessId: ctx.businessId,
          clientId: resolvedClientId ?? null,
          appointmentId: data.appointmentId ?? null,
          paymentReference: paymentRef,
          type: "payment",
          method: data.method,
          status: "completed",
          amount,
          tipAmount: data.tip,
          totalAmount: total,
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

      if (resolvedClientId) {
        await tx.client.update({
          where: { id: resolvedClientId, businessId: ctx.businessId },
          data: {
            totalSpent: { increment: amount },
            totalVisits: { increment: 1 },
            lastVisitAt: new Date(),
            loyaltyPoints: { increment: Math.floor(amount) },
          },
        })
      }

      return created
    })

    return apiSuccess({ receiptId: payment.id, subtotal, amount, total }, 201)
  } catch (e) {
    console.error("POST /api/v1/checkout error:", e)
    return ERRORS.SERVER_ERROR()
  }
}
