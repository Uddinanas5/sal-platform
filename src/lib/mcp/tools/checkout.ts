import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { type ApiContext } from "@/lib/api/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

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
        id: z.string().min(1).describe("Service or product ID"),
        quantity: z.number().int().positive().describe("Quantity"),
        price: z.number().nonnegative().describe("Price per unit"),
      })).describe("Line items in the checkout"),
      subtotal: z.number().nonnegative().describe("Subtotal before discounts and tax"),
      discount: z.number().nonnegative().describe("Discount amount"),
      tax: z.number().nonnegative().describe("Tax amount"),
      tip: z.number().nonnegative().describe("Tip amount"),
      total: z.number().nonnegative().describe("Total amount charged"),
      method: z.enum(["cash", "card", "gift_card", "other"]).describe("Payment method"),
    },
    async ({ clientId, appointmentId, items, subtotal, discount, tax, tip, total, method }) => {
      try {
        const payment = await prisma.$transaction(async (tx) => {
          const count = await tx.payment.count({ where: { businessId: ctx.businessId } })
          const paymentRef = `PAY-${String(count + 1).padStart(4, "0")}`

          const created = await tx.payment.create({
            data: {
              businessId: ctx.businessId,
              clientId: clientId ?? null,
              appointmentId: appointmentId ?? null,
              paymentReference: paymentRef,
              type: "payment",
              method,
              status: "completed",
              amount: subtotal - discount,
              tipAmount: tip,
              totalAmount: total,
              currency: "USD",
              processedAt: new Date(),
            },
          })

          if (appointmentId) {
            await tx.appointment.update({
              where: { id: appointmentId, businessId: ctx.businessId },
              data: { status: "completed", completedAt: new Date() },
            })
          }

          if (clientId) {
            await tx.client.update({
              where: { id: clientId, businessId: ctx.businessId },
              data: {
                totalSpent: { increment: total },
                totalVisits: { increment: 1 },
                lastVisitAt: new Date(),
                loyaltyPoints: { increment: Math.floor(total) },
              },
            })
          }

          // Deduct product inventory
          for (const item of items) {
            if (item.type === "product") {
              const inv = await tx.productInventory.findFirst({
                where: { productId: item.id, product: { businessId: ctx.businessId } },
              })
              if (inv) {
                await tx.productInventory.update({
                  where: { id: inv.id },
                  data: { quantity: { decrement: item.quantity } },
                })
              }
            }
          }

          return created
        })

        return ok({ receiptId: payment.id, paymentReference: payment.paymentReference, total })
      } catch (e) {
        console.error("process-checkout error:", e)
        return err("Checkout failed")
      }
    }
  )
}
