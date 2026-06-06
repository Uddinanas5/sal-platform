"use server"

import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getBusinessContext } from "@/lib/auth-utils"
import { sendEmail } from "@/lib/email"
import { receiptEmail } from "@/lib/email-templates"
import { recordCheckout, RecordCheckoutError } from "@/lib/checkout/record-checkout"
import { GiftCardError } from "@/lib/checkout/gift-card-redeem"
import {
  CommissionPeriodClosedError,
  NoPayrollPeriodError,
} from "@/lib/checkout/resolve-payroll-period"

type ActionResult<T = void> = { success: true; data: T } | { success: false; error: string }

// Friendly, user-facing messages for the typed gift-card failures recordCheckout
// can throw. Shared by every entry point so the wording stays consistent.
function giftCardErrorMessage(e: GiftCardError): string {
  switch (e.code) {
    case "GIFT_CARD_NOT_FOUND":
      return "That gift card code was not found or is no longer active."
    case "GIFT_CARD_EXPIRED":
      return "That gift card has expired."
    case "GIFT_CARD_INSUFFICIENT":
      return "That gift card does not have enough balance to cover the full total. Please use cash instead."
  }
}

const processPaymentSchema = z
  .object({
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
    // Beta records cash/other manual payments, Stripe-driven "online", and
    // gift-card redemption. "card" stays rejected server-side: online card
    // charging via SAL Payments is not enabled until Stripe activation, so
    // accepting it would record a "paid" sale that was never collected (defense
    // in depth, not just the client-side disable).
    method: z.enum(["cash", "online", "other", "gift_card"]),
    // Loyalty points the client elects to spend as a DISCOUNT. The actual dollar
    // value + cap is computed server-side in recordCheckout; this is only the
    // requested point count.
    redeemPoints: z.number().int().nonnegative().optional(),
    // Gift-card code, REQUIRED when method === "gift_card" (enforced in the
    // refine below). Balance is read + decremented server-side in recordCheckout.
    giftCardCode: z.string().min(1).optional(),
  })
  .refine((d) => d.method !== "gift_card" || !!d.giftCardCode, {
    message: "A gift card code is required to pay by gift card",
    path: ["giftCardCode"],
  })

export async function processPayment(data: {
  clientId?: string
  appointmentId?: string
  items: { type: "service" | "product"; id: string; quantity: number }[]
  discount: number
  tax: number
  tip: number
  // Type stays broad so existing callers compile; the zod schema above REJECTS
  // "card" at runtime (no real charge behind it in beta). "gift_card" is now
  // accepted, but ONLY with a giftCardCode (enforced by the schema refine).
  method: "cash" | "card" | "online" | "gift_card" | "other"
  redeemPoints?: number
  giftCardCode?: string
}): Promise<ActionResult<{
  receiptId: string
  paymentReference: string
  subtotal: number
  amount: number
  total: number
  loyalty: { redeemedPoints: number; redeemedAmount: number; earnedPoints: number }
}>> {
  const parsed = processPaymentSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: "Invalid input: " + (parsed.error.issues[0]?.message ?? "") }
  }
  const input = parsed.data

  try {
    const { businessId } = await getBusinessContext()

    // Pre-transaction idempotency guard: don't let the same appointment be
    // checked out twice (which would double-count revenue, visits, loyalty AND
    // commission). recordCheckout owns price/commission authority below.
    if (input.appointmentId) {
      const appt = await prisma.appointment.findFirst({
        where: { id: input.appointmentId, businessId },
        select: { clientId: true, status: true },
      })
      if (!appt) return { success: false, error: "Appointment not found" }
      if (input.clientId && appt.clientId && appt.clientId !== input.clientId) {
        return { success: false, error: "Appointment does not belong to this client" }
      }
      if (appt.status === "completed") {
        return { success: false, error: "This appointment has already been checked out." }
      }
      const alreadyPaid = await prisma.payment.findFirst({
        where: { appointmentId: input.appointmentId, businessId, type: "payment", status: "completed" },
        select: { id: true },
      })
      if (alreadyPaid) {
        return { success: false, error: "This appointment has already been paid." }
      }
    }

    // Single writer for ALL checkout side-effects — Payment, appointment flip,
    // client totals, inventory AND the Commission ledger / payroll-period rows.
    // All money (subtotal/amount/tax/total) is recomputed from DB prices +
    // per-item tax config inside recordCheckout; request input only supplies
    // {type,id,quantity}, discount, tip and method. Caller-supplied tax is dropped.
    const result = await prisma.$transaction((tx) =>
      recordCheckout(tx, businessId, {
        clientId: input.clientId,
        appointmentId: input.appointmentId,
        items: input.items,
        discount: input.discount,
        tip: input.tip,
        method: input.method,
        redeemPoints: input.redeemPoints,
        giftCardCode: input.giftCardCode,
      }),
    )

    revalidatePath("/checkout")
    revalidatePath("/dashboard")
    revalidatePath("/clients")
    return {
      success: true,
      data: {
        receiptId: result.payment.id,
        paymentReference: result.payment.paymentReference,
        subtotal: result.subtotal,
        amount: result.amount,
        total: result.total,
        loyalty: result.loyalty,
      },
    }
  } catch (e) {
    const msg = (e as Error).message
    if (msg === "Not authenticated" || msg === "No business context") {
      return { success: false, error: msg }
    }
    // A manually closed/paid payroll period blocks new commissions by design.
    if (e instanceof CommissionPeriodClosedError) {
      return { success: false, error: "The current payroll period is closed. Reopen it to record this checkout." }
    }
    if (e instanceof NoPayrollPeriodError) {
      return { success: false, error: "No payroll period is configured for today." }
    }
    if (e instanceof GiftCardError) {
      return { success: false, error: giftCardErrorMessage(e) }
    }
    if (e instanceof RecordCheckoutError) {
      return { success: false, error: e.message }
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
