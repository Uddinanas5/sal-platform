import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { type ApiContext } from "@/lib/api/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { recordCheckout, RecordCheckoutError } from "@/lib/checkout/record-checkout"
import {
  CommissionPeriodClosedError,
  NoPayrollPeriodError,
} from "@/lib/checkout/resolve-payroll-period"

function ok(data: unknown) { return { content: [{ type: "text" as const, text: JSON.stringify(data) }] } }
function err(message: string) { return { content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }], isError: true as const } }

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
      })).min(1, "At least one item is required").describe("Line items in the checkout"),
      // Money fields below (subtotal/total/tax) are advisory only; recordCheckout
      // recomputes subtotal/amount/total from DB prices. discount/tax/tip are the
      // only caller inputs that actually affect the recorded amounts.
      subtotal: z.number().nonnegative().optional().describe("DEPRECATED — ignored; recomputed from DB"),
      discount: z.number().nonnegative().default(0).describe("Discount amount"),
      tax: z.number().nonnegative().default(0).describe("Tax amount"),
      tip: z.number().nonnegative().default(0).describe("Tip amount"),
      total: z.number().nonnegative().optional().describe("DEPRECATED — ignored; recomputed from DB"),
      // "card"/"gift_card" are rejected — they have no real charge/redemption
      // behind them in beta (matches the dashboard action + /api/v1/checkout;
      // accepting them would record a "paid" sale that was never collected).
      method: z.enum(["cash", "online", "other"]).describe("Payment method (cash/online/other; card & gift_card are not live in beta)"),
    },
    async ({ clientId, appointmentId, items, discount, tax, tip, method }) => {
      try {
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
        // period rows. Money is recomputed from DB prices inside recordCheckout;
        // input only carries {type,id,quantity}/discount/tax/tip/method.
        const result = await prisma.$transaction((tx) =>
          recordCheckout(tx, ctx.businessId, {
            clientId,
            appointmentId,
            items: items.map((i) => ({ type: i.type, id: i.id, quantity: i.quantity })),
            discount,
            tax,
            tip,
            method,
          }),
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
        if (e instanceof RecordCheckoutError) {
          return err(e.message)
        }
        console.error("process-checkout error:", e)
        return err("Checkout failed")
      }
    }
  )
}
