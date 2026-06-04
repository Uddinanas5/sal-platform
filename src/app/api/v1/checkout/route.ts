import { withV1Auth } from "@/lib/api/auth"
import { apiSuccess, ERRORS } from "@/lib/api/response"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { recordCheckout, RecordCheckoutError } from "@/lib/checkout/record-checkout"
import {
  CommissionPeriodClosedError,
  NoPayrollPeriodError,
} from "@/lib/checkout/resolve-payroll-period"

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
  // "card"/"gift_card" rejected server-side — no real charge/redemption behind
  // them in beta (matches the dashboard action; defense in depth).
  method: z.enum(["cash", "online", "other"]),
  // Loyalty points to spend as a DISCOUNT (server validates + caps the value).
  redeemPoints: z.number().int().nonnegative().optional(),
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
    // ledger + payroll-period rows. Money is recomputed from DB prices inside
    // recordCheckout; request input only carries {type,id,quantity}/discount/
    // tax/tip/method.
    const result = await prisma.$transaction((tx) =>
      recordCheckout(tx, ctx.businessId, {
        clientId: data.clientId,
        appointmentId: data.appointmentId,
        items: data.items,
        discount: data.discount,
        tax: data.tax,
        tip: data.tip,
        method: data.method,
        redeemPoints: data.redeemPoints,
      }),
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
    if (e instanceof RecordCheckoutError) {
      return ERRORS.BAD_REQUEST(e.message)
    }
    console.error("POST /api/v1/checkout error:", e)
    return ERRORS.SERVER_ERROR()
  }
}
