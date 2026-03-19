"use server"

import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getBusinessContext } from "@/lib/auth-utils"
import { sendEmail } from "@/lib/email"
import { receiptEmail } from "@/lib/email-templates"

type ActionResult<T = void> = { success: true; data: T } | { success: false; error: string }

const processPaymentSchema = z.object({
  clientId: z.string().uuid().optional(),
  appointmentId: z.string().uuid().optional(),
  items: z.array(
    z.object({
      type: z.enum(["service", "product"]),
      id: z.string().min(1),
      price: z.number().nonnegative(),
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
  items: { type: "service" | "product"; id: string; price: number; quantity: number }[]
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

    const payment = await prisma.$transaction(async (tx) => {
      const count = await tx.payment.count({ where: { businessId } })
      const paymentRef = `PAY-${String(count + 1).padStart(4, "0")}`

      const created = await tx.payment.create({
        data: {
          businessId,
          clientId: data.clientId || null,
          appointmentId: data.appointmentId || null,
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

      // Update appointment status to completed if linked
      if (data.appointmentId) {
        await tx.appointment.update({
          where: { id: data.appointmentId, businessId },
          data: { status: "completed", completedAt: new Date() },
        })
      }

      // Update client totals if linked
      if (data.clientId) {
        await tx.client.update({
          where: { id: data.clientId, businessId },
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
