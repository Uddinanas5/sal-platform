import { withV1Auth } from "@/lib/api/auth"
import { apiSuccess, ERRORS } from "@/lib/api/response"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { recordCheckout, RecordCheckoutError } from "@/lib/checkout/record-checkout"
import { isBookingContentionError } from "@/lib/db/advisory-lock"
import { GiftCardError } from "@/lib/checkout/gift-card-redeem"
import {
  CommissionPeriodClosedError,
  NoPayrollPeriodError,
} from "@/lib/checkout/resolve-payroll-period"

// Friendly messages for the typed gift-card failures (kept in lockstep with the
// dashboard action's wording).
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
    items: z.array(z.object({
      type: z.enum(["service", "product"]),
      id: z.string().uuid(),
      quantity: z.number().int().positive(),
    })).default([]),
    // Ad-hoc "Quick Sale" lines (operator-named/priced, no catalog row). The
    // unitPrice is authoritative for that line only and is folded into the
    // server-computed subtotal/tax/total in recordCheckout so the recorded sale
    // equals the cash collected (matches the dashboard action).
    customItems: z.array(z.object({
      type: z.literal("custom"),
      name: z.string().min(1).max(200),
      unitPrice: z.number().nonnegative(),
      quantity: z.number().int().positive(),
    })).max(100).default([]),
    discount: z.number().nonnegative().default(0),
    tax: z.number().nonnegative().default(0),
    tip: z.number().nonnegative().default(0),
    // "card" rejected server-side — no real online charge behind it in beta
    // (matches the dashboard action; defense in depth). "gift_card" is accepted
    // ONLY with a giftCardCode (enforced by the refine below).
    method: z.enum(["cash", "online", "other", "gift_card"]),
    // Loyalty points to spend as a DISCOUNT (server validates + caps the value).
    redeemPoints: z.number().int().nonnegative().optional(),
    // Gift-card code, required when method === "gift_card".
    giftCardCode: z.string().min(1).optional(),
  })
  .refine((d) => d.method !== "gift_card" || !!d.giftCardCode, {
    message: "A gift card code is required to pay by gift card",
    path: ["giftCardCode"],
  })
  .refine((d) => d.items.length + d.customItems.length > 0, {
    message: "At least one item is required",
    path: ["items"],
  })

export async function POST(req: Request) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()

  let body: unknown
  try { body = await req.json() } catch { return ERRORS.BAD_REQUEST("Invalid JSON") }

  const parsed = processPaymentSchema.safeParse(body)
  if (!parsed.success) return ERRORS.BAD_REQUEST(parsed.error.issues[0]?.message ?? "Invalid input")

  const data = parsed.data

  // Pre-transaction idempotency guard (mirrors the dashboard action): don't let
  // the same appointment be checked out twice — that would double-count revenue,
  // visits, loyalty AND commission. recordCheckout owns all money authority.
  if (data.appointmentId) {
    const appt = await prisma.appointment.findFirst({
      where: { id: data.appointmentId, businessId: ctx.businessId },
      select: { clientId: true, status: true },
    })
    if (!appt) return ERRORS.NOT_FOUND("Appointment")
    if (data.clientId && appt.clientId && appt.clientId !== data.clientId) {
      return ERRORS.BAD_REQUEST("Appointment does not belong to this client")
    }
    if (appt.status === "completed") {
      return ERRORS.BAD_REQUEST("This appointment has already been checked out.")
    }
    const alreadyPaid = await prisma.payment.findFirst({
      where: { appointmentId: data.appointmentId, businessId: ctx.businessId, type: "payment", status: "completed" },
      select: { id: true },
    })
    if (alreadyPaid) {
      return ERRORS.BAD_REQUEST("This appointment has already been paid.")
    }
  }

  try {
    // Single writer for ALL checkout side-effects, including the Commission
    // ledger + payroll-period rows. Money (subtotal/amount/tax/total) is
    // recomputed from DB prices + per-item tax config inside recordCheckout;
    // request input only carries {type,id,quantity}/discount/tip/method.
    // Caller-supplied tax is dropped.
    const result = await prisma.$transaction((tx) =>
      recordCheckout(tx, ctx.businessId, {
        clientId: data.clientId,
        appointmentId: data.appointmentId,
        items: data.items,
        customItems: data.customItems,
        discount: data.discount,
        tip: data.tip,
        method: data.method,
        redeemPoints: data.redeemPoints,
        giftCardCode: data.giftCardCode,
      }),
      { timeout: 20000, maxWait: 15000 },
    )

    return apiSuccess(
      {
        receiptId: result.payment.id,
        subtotal: result.subtotal,
        amount: result.amount,
        total: result.total,
        loyalty: result.loyalty,
      },
      201,
    )
  } catch (e) {
    if (e instanceof CommissionPeriodClosedError) {
      return ERRORS.BAD_REQUEST("The current payroll period is closed.")
    }
    if (e instanceof NoPayrollPeriodError) {
      return ERRORS.BAD_REQUEST("No payroll period is configured for today.")
    }
    if (e instanceof GiftCardError) {
      return ERRORS.BAD_REQUEST(giftCardErrorMessage(e))
    }
    if (e instanceof RecordCheckoutError) {
      return ERRORS.BAD_REQUEST(e.message)
    }
    // Concurrency contention behind the per-client / per-gift-card advisory lock
    // (tx timeout P2028 / write-conflict P2034) is not an integrity failure — no
    // payment was recorded — so surface a clean 400 "try again", not a 500.
    if (isBookingContentionError(e)) {
      return ERRORS.BAD_REQUEST("This checkout could not be completed right now, please try again")
    }
    console.error("POST /api/v1/checkout error:", e)
    return ERRORS.SERVER_ERROR()
  }
}
