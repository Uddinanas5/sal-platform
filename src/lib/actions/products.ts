"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getBusinessContext } from "@/lib/auth-utils"

type ActionResult<T = void> = { success: true; data: T } | { success: false; error: string }

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
    const { businessId } = await getBusinessContext()

    const location = await prisma.location.findFirst({ where: { businessId } })
    if (!location) return { success: false, error: "Business not configured" }

    const product = await prisma.product.create({
      data: {
        businessId,
        categoryId: data.categoryId,
        name: data.name,
        description: data.description,
        sku: data.sku,
        costPrice: data.costPrice,
        retailPrice: data.retailPrice,
        metadata: data.supplier ? { supplier: data.supplier } : {},
        isActive: true,
      },
    })

    await prisma.productInventory.create({
      data: {
        productId: product.id,
        locationId: location.id,
        quantity: data.stockLevel,
        lowStockThreshold: data.reorderLevel,
        reorderPoint: data.reorderLevel,
      },
    })

    revalidatePath("/inventory")
    return { success: true, data: { id: product.id } }
  } catch (e) {
    const msg = (e as Error).message
    if (msg === "Not authenticated" || msg === "No business context") {
      return { success: false, error: msg }
    }
    return { success: false, error: msg }
  }
}

export async function adjustStock(
  productId: string,
  adjustment: number,
  reason?: string
): Promise<ActionResult> {
  try {
    const inventory = await prisma.productInventory.findFirst({
      where: { productId },
    })
    if (!inventory) return { success: false, error: "Product inventory not found" }

    const newQty = inventory.quantity + adjustment
    if (newQty < 0) return { success: false, error: "Stock cannot go below zero" }

    await prisma.productInventory.update({
      where: { id: inventory.id },
      data: {
        quantity: newQty,
        lastRestockAt: adjustment > 0 ? new Date() : undefined,
      },
    })

    await prisma.inventoryTransaction.create({
      data: {
        productId,
        locationId: inventory.locationId,
        type: adjustment > 0 ? "restock" : "adjustment",
        quantityChange: adjustment,
        quantityAfter: newQty,
        notes: reason,
      },
    })

    revalidatePath("/inventory")
    return { success: true, data: undefined }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  try {
    const { businessId } = await getBusinessContext()

    await prisma.product.update({
      where: { id, businessId },
      data: { isActive: false, deletedAt: new Date() },
    })
    revalidatePath("/inventory")
    return { success: true, data: undefined }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
