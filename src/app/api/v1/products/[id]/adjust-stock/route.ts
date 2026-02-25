import { withV1Auth } from "@/lib/api/auth"
import { apiSuccess, ERRORS } from "@/lib/api/response"
import { hasRole } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const adjustStockSchema = z.object({
  adjustment: z.number().int(),
  reason: z.string().optional(),
})

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()
  if (!hasRole(ctx.role, "admin")) return ERRORS.FORBIDDEN()
  const { id } = await params

  let body: unknown
  try { body = await req.json() } catch { return ERRORS.BAD_REQUEST("Invalid JSON") }

  const parsed = adjustStockSchema.safeParse(body)
  if (!parsed.success) return ERRORS.BAD_REQUEST(parsed.error.issues[0]?.message ?? "Invalid input")

  const inventory = await prisma.productInventory.findFirst({
    where: { productId: id, product: { businessId: ctx.businessId } },
  })
  if (!inventory) return ERRORS.NOT_FOUND("Product inventory")

  const newQty = inventory.quantity + parsed.data.adjustment
  if (newQty < 0) return ERRORS.BAD_REQUEST("Stock cannot go below zero")

  await prisma.productInventory.update({
    where: { id: inventory.id },
    data: { quantity: newQty, lastRestockAt: parsed.data.adjustment > 0 ? new Date() : undefined },
  })

  await prisma.inventoryTransaction.create({
    data: {
      productId: id,
      locationId: inventory.locationId,
      type: parsed.data.adjustment > 0 ? "restock" : "adjustment",
      quantityChange: parsed.data.adjustment,
      quantityAfter: newQty,
      notes: parsed.data.reason,
    },
  })

  return apiSuccess({ newQuantity: newQty })
}
