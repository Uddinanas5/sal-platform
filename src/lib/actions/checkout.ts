"use server"

import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getBusinessContext } from "@/lib/auth-utils"
import { calculateCheckoutTotals } from "@/lib/checkout/pricing"
import { sendEmail } from "@/lib/email"
import { receiptEmail } from "@/lib/email-templates"

type ActionResult<T = void> = { success: true; data: T } | { success: false; error: string }

function generatePaymentReference() {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `PAY-${timestamp}-${random}`.toUpperCase()
}

const processPaymentSchema = z.object({
  clientId: z.string().uuid().optional(),
  appointmentId: z.string().uuid().optional(),
  items: z.array(
    z.object({
      type: z.enum(["service", "product", "custom"]),
      id: z.string().min(1),
      name: z.string().optional(),
      price: z.number().nonnegative().optional(),
      quantity: z.number().int().positive(),
    })
  ),
  subtotal: z.number().nonnegative(),
  discount: z.number().nonnegative(),
  tax: z.number().nonnegative(),
  tip: z.number().nonnegative(),
  total: z.number().nonnegative(),
  method: z.enum(["cash", "card", "gift_card", "other"]),
})

export async function processPayment(data: {
  clientId?: string
  appointmentId?: string
  items: { type: "service" | "product" | "custom"; id: string; name?: string; price?: number; quantity: number }[]
  subtotal: number
  discount: number
  tax: number
  tip: number
  total: number
  method: "cash" | "card" | "gift_card" | "other"
}): Promise<ActionResult<{ receiptId: string; paymentReference: string }>> {
  try {
    processPaymentSchema.parse(data)
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { success: false, error: "Invalid input: " + e.issues[0]?.message }
    }
    throw e
  }

  try {
    const { businessId } = await getBusinessContext()

    const [client, appointment] = await Promise.all([
      data.clientId
        ? prisma.client.findFirst({
            where: { id: data.clientId, businessId, deletedAt: null },
          })
        : Promise.resolve(null),
      data.appointmentId
        ? prisma.appointment.findFirst({
            where: { id: data.appointmentId, businessId },
            select: { id: true, clientId: true },
          })
        : Promise.resolve(null),
    ])

    if (data.clientId && !client) {
      return { success: false, error: "Client not found" }
    }
    if (data.appointmentId && !appointment) {
      return { success: false, error: "Appointment not found" }
    }
    if (appointment?.clientId && data.clientId && appointment.clientId !== data.clientId) {
      return { success: false, error: "Client does not match appointment" }
    }

    const payment = await prisma.$transaction(async (tx) => {
      const totals = await calculateCheckoutTotals(tx, businessId, data.items, {
        discount: data.discount,
        tip: data.tip,
      })
      const created = await tx.payment.create({
        data: {
          businessId,
          clientId: data.clientId || null,
          appointmentId: data.appointmentId || null,
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

      // Update appointment status to completed if linked
      if (data.appointmentId) {
        const appointment = await tx.appointment.update({
          where: { id: data.appointmentId, businessId },
          data: { status: "completed", completedAt: new Date() },
          include: { services: { include: { staff: true } } },
        })

        // Create commission records for each staff member on this appointment
        const now = new Date()
        const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
        const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)

        for (const svc of appointment.services) {
          if (!svc.staffId || !svc.staff) continue
          const grossAmount = Number(svc.finalPrice)
          if (grossAmount <= 0) continue

          const rate = Number(svc.staff.commissionRate ?? 0)
          const commissionAmount = (grossAmount * rate) / 100

          await tx.commission.create({
            data: {
              staffId: svc.staffId,
              appointmentId: data.appointmentId,
              type: "service",
              referenceType: "payment",
              referenceId: created.id,
              grossAmount,
              commissionRate: rate,
              commissionAmount,
              status: "pending",
              periodStart,
              periodEnd,
            },
          })
        }
      }

      // Update client totals if linked
      if (data.clientId) {
        await tx.client.update({
          where: { id: data.clientId, businessId },
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

    revalidatePath("/checkout")
    revalidatePath("/dashboard")
    revalidatePath("/clients")
    return { success: true, data: { receiptId: payment.id, paymentReference: payment.paymentReference } }
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
