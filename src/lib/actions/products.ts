"use server"

import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { requireMinRole } from "@/lib/auth-utils"

type ActionResult<T = void> = { success: true; data: T } | { success: false; error: string }

// Module-private sentinel so the guarded-decrement failure inside the stock
// transaction can roll the tx back and surface a friendly message (a "use
// server" file may only EXPORT async functions, so this class stays unexported).
class RecordStockError extends Error {}

const createProductSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  sku: z.string().optional(),
  categoryId: z.string().uuid(),
  costPrice: z.number().nonnegative(),
  retailPrice: z.number().nonnegative(),
  stockLevel: z.number().int().nonnegative(),
  reorderLevel: z.number().int().nonnegative(),
  supplier: z.string().optional(),
})

const adjustStockSchema = z.object({
  productId: z.string().uuid(),
  adjustment: z.number().int(),
  reason: z.string().optional(),
})

const deleteProductSchema = z.object({
  id: z.string().uuid(),
})

export async function createProduct(data: {
  name: string
  description?: string
  sku?: string
  categoryId: string
  costPrice: number
  retailPrice: number
  stockLevel: number
  reorderLevel: number
  supplier?: string
}): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = createProductSchema.parse(data)

    const { businessId } = await requireMinRole("admin")

    const location = await prisma.location.findFirst({ where: { businessId } })
    if (!location) return { success: false, error: "Business not configured" }

    const product = await prisma.product.create({
      data: {
        businessId,
        categoryId: parsed.categoryId,
        name: parsed.name,
        description: parsed.description,
        sku: parsed.sku,
        costPrice: parsed.costPrice,
        retailPrice: parsed.retailPrice,
        metadata: parsed.supplier ? { supplier: parsed.supplier } : {},
        isActive: true,
      },
    })

    await prisma.productInventory.create({
      data: {
        productId: product.id,
        locationId: location.id,
        quantity: parsed.stockLevel,
        lowStockThreshold: parsed.reorderLevel,
        reorderPoint: parsed.reorderLevel,
      },
    })

    revalidatePath("/inventory")
    return { success: true, data: { id: product.id } }
  } catch (e) {
    if (e instanceof z.ZodError) return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    const msg = (e as Error).message
    if (msg === "Not authenticated" || msg === "No business context") {
      return { success: false, error: msg }
    }
    console.error("createProduct error:", e)
    return { success: false, error: msg }
  }
}

export async function adjustStock(
  productId: string,
  adjustment: number,
  reason?: string
): Promise<ActionResult> {
  try {
    const parsed = adjustStockSchema.parse({ productId, adjustment, reason })
    productId = parsed.productId
    adjustment = parsed.adjustment
    reason = parsed.reason

    const { businessId } = await requireMinRole("admin")

    const inventory = await prisma.productInventory.findFirst({
      where: { productId, product: { businessId } },
      select: { id: true, locationId: true },
    })
    if (!inventory) return { success: false, error: "Product inventory not found" }

    // Atomic read-modify-write in one transaction: a guarded `increment`
    // (with a `quantity: { gte: -adjustment }` floor on decrements) prevents two
    // concurrent adjustments — or a concurrent checkout decrement — from both
    // reading the same quantity and clobbering each other (lost update / negative
    // stock / ledger drift). The ledger row reads the post-write quantity inside
    // the same tx so quantityAfter always reconciles.
    try {
      const newQty = await prisma.$transaction(async (tx) => {
        const updated = await tx.productInventory.updateMany({
          where: {
            id: inventory.id,
            ...(adjustment < 0 ? { quantity: { gte: -adjustment } } : {}),
          },
          data: {
            quantity: { increment: adjustment },
            ...(adjustment > 0 ? { lastRestockAt: new Date() } : {}),
          },
        })
        if (updated.count === 0) {
          throw new RecordStockError("Stock cannot go below zero")
        }
        const after = await tx.productInventory.findUnique({
          where: { id: inventory.id },
          select: { quantity: true },
        })
        const quantityAfter = after?.quantity ?? 0
        await tx.inventoryTransaction.create({
          data: {
            productId,
            locationId: inventory.locationId,
            type: adjustment > 0 ? "restock" : "adjustment",
            quantityChange: adjustment,
            quantityAfter,
            notes: reason,
          },
        })
        return quantityAfter
      })
      void newQty
    } catch (e) {
      if (e instanceof RecordStockError) return { success: false, error: e.message }
      throw e
    }

    revalidatePath("/inventory")
    return { success: true, data: undefined }
  } catch (e) {
    if (e instanceof z.ZodError) return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    const msg = e instanceof Error ? e.message : "Failed to adjust stock"
    if (msg === "Not authenticated" || msg === "No business context" || msg.startsWith("Insufficient permissions")) {
      return { success: false, error: msg }
    }
    console.error("adjustStock error:", e)
    return { success: false, error: "Failed to adjust stock" }
  }
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  try {
    const parsed = deleteProductSchema.parse({ id })
    id = parsed.id

    const { businessId } = await requireMinRole("admin")

    await prisma.product.update({
      where: { id, businessId },
      data: { isActive: false, deletedAt: new Date() },
    })
    revalidatePath("/inventory")
    return { success: true, data: undefined }
  } catch (e) {
    if (e instanceof z.ZodError) return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    console.error("deleteProduct error:", e)
    return { success: false, error: (e as Error).message }
  }
}
