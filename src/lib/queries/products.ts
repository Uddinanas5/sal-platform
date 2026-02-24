import { prisma } from "@/lib/prisma"

export async function getProducts(businessId?: string) {
  const businessFilter = businessId ? { businessId } : {}

  const products = await prisma.product.findMany({
    where: { isActive: true, deletedAt: null, ...businessFilter },
    select: {
      id: true,
      name: true,
      description: true,
      sku: true,
      costPrice: true,
      retailPrice: true,
      isActive: true,
      metadata: true,
      category: { select: { name: true } },
      inventory: { select: { quantity: true, lowStockThreshold: true } },
    },
    orderBy: { name: "asc" },
  })

  return products.map((p) => {
    const inv = p.inventory[0]
    return {
      id: p.id,
      name: p.name,
      description: p.description || "",
      sku: p.sku || "",
      category: p.category?.name || "Uncategorized",
      costPrice: Number(p.costPrice || 0),
      retailPrice: Number(p.retailPrice),
      stockLevel: inv?.quantity || 0,
      reorderLevel: inv?.lowStockThreshold || 0,
      supplier: (p.metadata as Record<string, unknown>)?.supplier as string || "",
      isActive: p.isActive,
    }
  })
}

export async function getLowStockProducts(businessId?: string) {
  const products = await getProducts(businessId)
  return products.filter((p) => p.stockLevel <= p.reorderLevel)
}
