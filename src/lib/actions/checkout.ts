"use server"

import { z } from "zod"
import { randomBytes } from "crypto"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getBusinessContext } from "@/lib/auth-utils"
import { sendEmail } from "@/lib/email"
import { receiptEmail } from "@/lib/email-templates"

type ActionResult<T = void> = { success: true; data: T } | { success: false; error: string }

function generatePaymentReference() {
  const now = new Date()
  const yyyymmdd = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}`
  const suffix = randomBytes(4).toString("hex").toUpperCase()
  return `PAY-${yyyymmdd}-${suffix}`
}

const processPaymentSchema = z.object({
  clientId: z.string().uuid().optional(),
  appointmentId: z.string().uuid().optional(),
  items: z.array(
    z.object({
      type: z.enum(["service", "product"]),
      id: z.string().uuid(),
      quantity: z.number().int().positive(),
    })
  ).min(1, "At least one item is required"),
  discount: z.number().nonnegative().default(0),
  tax: z.number().nonnegative().default(0),
  tip: z.number().nonnegative().default(0),
  method: z.enum(["cash", "card", "gift_card", "other"]),
})

export async function processPayment(data: {
  clientId?: string
  appointmentId?: string
  items: { type: "service" | "product"; id: string; quantity: number }[]
  discount: number
  tax: number
  tip: number
  method: "cash" | "card" | "gift_card" | "other"
}): Promise<ActionResult<{ receiptId: string; paymentReference: string; subtotal: number; amount: number; total: number }>> {
  const parsed = processPaymentSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: "Invalid input: " + (parsed.error.issues[0]?.message ?? "") }
  }
  const input = parsed.data

  try {
    const { businessId } = await getBusinessContext()

    const serviceIds = Array.from(new Set(input.items.filter((i) => i.type === "service").map((i) => i.id)))
    const productIds = Array.from(new Set(input.items.filter((i) => i.type === "product").map((i) => i.id)))

    const [services, products] = await Promise.all([
      serviceIds.length
        ? prisma.service.findMany({
            where: { id: { in: serviceIds }, businessId, deletedAt: null },
            select: { id: true, price: true },
          })
        : Promise.resolve([] as { id: string; price: import("@/generated/prisma").Prisma.Decimal }[]),
      productIds.length
        ? prisma.product.findMany({
            where: { id: { in: productIds }, businessId, deletedAt: null },
            select: { id: true, retailPrice: true },
          })
        : Promise.resolve([] as { id: string; retailPrice: import("@/generated/prisma").Prisma.Decimal }[]),
    ])

    if (services.length !== serviceIds.length) return { success: false, error: "One or more services not found" }
    if (products.length !== productIds.length) return { success: false, error: "One or more products not found" }

    const priceMap = new Map<string, number>()
    for (const s of services) priceMap.set(`service:${s.id}`, Number(s.price))
    for (const p of products) priceMap.set(`product:${p.id}`, Number(p.retailPrice))

    let subtotal = 0
    for (const item of input.items) {
      const price = priceMap.get(`${item.type}:${item.id}`)
      if (price === undefined) return { success: false, error: "Invalid item" }
      subtotal += price * item.quantity
    }
    subtotal = Math.round(subtotal * 100) / 100

    if (input.discount > subtotal) return { success: false, error: "Discount cannot exceed subtotal" }

    const amount = Math.round((subtotal - input.discount) * 100) / 100
    const total = Math.round((amount + input.tax + input.tip) * 100) / 100

    let resolvedClientId: string | undefined = input.clientId
    if (input.appointmentId) {
      const appt = await prisma.appointment.findFirst({
        where: { id: input.appointmentId, businessId },
        select: { clientId: true },
      })
      if (!appt) return { success: false, error: "Appointment not found" }
      if (input.clientId && appt.clientId && appt.clientId !== input.clientId) {
        return { success: false, error: "Appointment does not belong to this client" }
      }
      if (!resolvedClientId && appt.clientId) {
        resolvedClientId = appt.clientId
      }
    }

    if (resolvedClientId) {
      const client = await prisma.client.findFirst({
        where: { id: resolvedClientId, businessId },
        select: { id: true },
      })
      if (!client) return { success: false, error: "Client not found" }
    }

    const payment = await prisma.$transaction(async (tx) => {
      const paymentRef = generatePaymentReference()

      const created = await tx.payment.create({
        data: {
          businessId,
          clientId: resolvedClientId ?? null,
          appointmentId: input.appointmentId ?? null,
          paymentReference: paymentRef,
          type: "payment",
          method: input.method,
          status: "completed",
          amount,
          tipAmount: input.tip,
          totalAmount: total,
          currency: "USD",
          processedAt: new Date(),
        },
      })

      if (input.appointmentId) {
        await tx.appointment.update({
          where: { id: input.appointmentId, businessId },
          data: { status: "completed", completedAt: new Date() },
        })
      }

      if (resolvedClientId) {
        await tx.client.update({
          where: { id: resolvedClientId, businessId },
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

    revalidatePath("/checkout")
    revalidatePath("/dashboard")
    revalidatePath("/clients")
    return {
      success: true,
      data: {
        receiptId: payment.id,
        paymentReference: payment.paymentReference,
        subtotal,
        amount,
        total,
      },
    }
  } catch (e) {
    const msg = (e as Error).message
    if (msg === "Not authenticated" || msg === "No business context") {
      return { success: false, error: msg }
    }
    console.error("processPayment error:", e)
    return { success: false, error: msg }
  }
}

const sendReceiptEmailSchema = z.object({
  clientEmail: z.string().email(),
  clientName: z.string().min(1),
  businessName: z.string().min(1),
  items: z.array(
    z.object({
      name: z.string(),
      quantity: z.number().int().positive(),
      price: z.number().nonnegative(),
    })
  ),
  subtotal: z.number().nonnegative(),
  discount: z.number().nonnegative(),
  tax: z.number().nonnegative(),
  tip: z.number().nonnegative(),
  total: z.number().nonnegative(),
  paymentMethod: z.string().min(1),
  receiptNumber: z.string().min(1),
})

export async function sendReceiptEmailAction(data: {
  clientEmail: string
  clientName: string
  businessName: string
  items: Array<{ name: string; quantity: number; price: number }>
  subtotal: number
  discount: number
  tax: number
  tip: number
  total: number
  paymentMethod: string
  receiptNumber: string
}): Promise<ActionResult<void>> {
  try {
    sendReceiptEmailSchema.parse(data)
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { success: false, error: "Invalid input: " + e.issues[0]?.message }
    }
    throw e
  }

  try {
    // Verify the caller is authenticated (business context check)
    await getBusinessContext()

    const date = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })

    const html = receiptEmail({
      clientName: data.clientName,
      businessName: data.businessName,
      services: data.items,
      subtotal: data.subtotal,
      discount: data.discount,
      tax: data.tax,
      tip: data.tip,
      total: data.total,
      paymentMethod: data.paymentMethod,
      date,
      receiptNumber: data.receiptNumber,
    })

    const result = await sendEmail({
      to: data.clientEmail,
      subject: `Your receipt from ${data.businessName} — ${data.receiptNumber}`,
      html,
    })

    if (!result.success) {
      return { success: false, error: "Failed to send receipt email" }
    }

    return { success: true, data: undefined }
  } catch (e) {
    const msg = (e as Error).message
    if (msg === "Not authenticated" || msg === "No business context") {
      return { success: false, error: msg }
    }
    console.error("sendReceiptEmailAction error:", e)
    return { success: false, error: "Failed to send receipt email" }
  }
}
