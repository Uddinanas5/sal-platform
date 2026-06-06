import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { type ApiContext } from "@/lib/api/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { recordCheckout, RecordCheckoutError } from "@/lib/checkout/record-checkout"
import { isBookingContentionError } from "@/lib/db/advisory-lock"
import { GiftCardError } from "@/lib/checkout/gift-card-redeem"
import {
  CommissionPeriodClosedError,
  NoPayrollPeriodError,
} from "@/lib/checkout/resolve-payroll-period"

function ok(data: unknown) { return { content: [{ type: "text" as const, text: JSON.stringify(data) }] } }
function err(message: string) { return { content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }], isError: true as const } }

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

export function registerCheckoutTools(server: McpServer, ctx: ApiContext) {
  server.tool(
    "process-checkout",
    "Process a checkout/payment for services and products",
    {
      clientId: z.string().uuid().optional().describe("Client ID"),
      appointmentId: z.string().uuid().optional().describe("Associated appointment ID"),
      items: z.array(z.object({
        type: z.enum(["service", "product"]).describe("Item type"),
        id: z.string().uuid().describe("Service or product ID"),
        quantity: z.number().int().positive().describe("Quantity"),
        // NOTE: caller-supplied price is intentionally ignored. recordCheckout
        // re-fetches every price from the DB; accepting a price here would let a
        // caller dictate revenue/commission. Kept optional only so older callers
        // that still send it don't fail schema validation.
        price: z.number().nonnegative().optional().describe("DEPRECATED — ignored; price is taken from the DB"),
      })).default([]).describe("Catalog line items (services/products). At least one catalog OR custom item is required."),
      // Ad-hoc "Quick Sale" lines: operator-named/priced rows with no catalog
      // entry. UNLIKE catalog items, unitPrice IS authoritative for that line
      // only and is folded into the server-computed subtotal/tax/total in
      // recordCheckout, so the recorded sale equals the cash collected.
      customItems: z.array(z.object({
        type: z.literal("custom").describe("Always 'custom'"),
        name: z.string().min(1).max(200).describe("Line description, e.g. 'Walk-in trim'"),
        unitPrice: z.number().nonnegative().describe("Per-unit price (authoritative for this line)"),
        quantity: z.number().int().positive().describe("Quantity"),
      })).default([]).describe("Ad-hoc Quick Sale line items (no catalog entry)"),
      // Money fields below (subtotal/total/tax) are advisory only; recordCheckout
      // recomputes subtotal/amount/tax/total server-side from DB prices and
      // per-item tax config. Only discount/tip are caller inputs that actually
      // affect the recorded amounts.
      subtotal: z.number().nonnegative().optional().describe("DEPRECATED — ignored; recomputed from DB"),
      discount: z.number().nonnegative().default(0).describe("Discount amount"),
      tax: z.number().nonnegative().default(0).describe("DEPRECATED — ignored; tax is recomputed server-side from DB"),
      tip: z.number().nonnegative().default(0).describe("Tip amount"),
      total: z.number().nonnegative().optional().describe("DEPRECATED — ignored; recomputed from DB"),
      // "card" is rejected — no real online charge behind it in beta (matches the
      // dashboard action + /api/v1/checkout; accepting it would record a "paid"
      // sale that was never collected). "gift_card" IS accepted, but requires a
      // giftCardCode (validated in the handler) — balance is redeemed server-side.
      method: z.enum(["cash", "online", "other", "gift_card"]).describe("Payment method (cash/online/other/gift_card; card is not live in beta)"),
      // Gift-card code, required when method === "gift_card".
      giftCardCode: z.string().min(1).optional().describe("Gift card code (required when method is gift_card)"),
    },
    async ({ clientId, appointmentId, items, customItems, discount, tip, method, giftCardCode }) => {
      try {
        if (method === "gift_card" && !giftCardCode) {
          return err("A gift card code is required to pay by gift card")
        }

        // Default to empty arrays defensively (the zod-shape .default([]) covers
        // the normal SDK path, but the tool should never throw on a bare call).
        const catalogItems = items ?? []
        const adHocItems = customItems ?? []

        // At least one line — catalog OR custom — must be present (the per-array
        // .min(1) is replaced by .default([]) so a custom-only Quick Sale works).
        if (catalogItems.length + adHocItems.length === 0) {
          return err("At least one item is required")
        }

        // Pre-transaction idempotency guard (mirrors the dashboard action +
        // /api/v1/checkout): don't let the same appointment be checked out twice,
        // which would double-count revenue, visits, loyalty AND commission.
        if (appointmentId) {
          const appt = await prisma.appointment.findFirst({
            where: { id: appointmentId, businessId: ctx.businessId },
            select: { clientId: true, status: true },
          })
          if (!appt) return err("Appointment not found")
          if (clientId && appt.clientId && appt.clientId !== clientId) {
            return err("Appointment does not belong to this client")
          }
          if (appt.status === "completed") {
            return err("This appointment has already been checked out.")
          }
          const alreadyPaid = await prisma.payment.findFirst({
            where: { appointmentId, businessId: ctx.businessId, type: "payment", status: "completed" },
            select: { id: true },
          })
          if (alreadyPaid) {
            return err("This appointment has already been paid.")
          }
        }

        // Single writer for ALL checkout side-effects — Payment, appointment
        // flip, client totals, inventory AND the Commission ledger / payroll-
        // period rows. Money (subtotal/amount/tax/total) is recomputed from DB
        // prices + per-item tax config inside recordCheckout; input only carries
        // {type,id,quantity}/discount/tip/method. Caller-supplied tax is dropped.
        const result = await prisma.$transaction((tx) =>
          recordCheckout(tx, ctx.businessId, {
            clientId,
            appointmentId,
            items: catalogItems.map((i) => ({ type: i.type, id: i.id, quantity: i.quantity })),
            customItems: adHocItems.map((c) => ({
              type: "custom" as const,
              name: c.name,
              unitPrice: c.unitPrice,
              quantity: c.quantity,
            })),
            discount,
            tip,
            method,
            giftCardCode,
          }),
          { timeout: 20000, maxWait: 15000 },
        )

        return ok({
          receiptId: result.payment.id,
          paymentReference: result.payment.paymentReference,
          subtotal: result.subtotal,
          amount: result.amount,
          total: result.total,
        })
      } catch (e) {
        if (e instanceof CommissionPeriodClosedError) {
          return err("The current payroll period is closed.")
        }
        if (e instanceof NoPayrollPeriodError) {
          return err("No payroll period is configured for today.")
        }
        if (e instanceof GiftCardError) {
          return err(giftCardErrorMessage(e))
        }
        if (e instanceof RecordCheckoutError) {
          return err(e.message)
        }
        // Concurrency contention behind the per-client / per-gift-card advisory
        // lock (tx timeout P2028 / write-conflict P2034) — no payment was
        // recorded; return a clean "try again" message instead of a 500.
        if (isBookingContentionError(e)) {
          return err("This checkout could not be completed right now, please try again")
        }
        console.error("process-checkout error:", e)
        return err("Checkout failed")
      }
    }
  )
}
