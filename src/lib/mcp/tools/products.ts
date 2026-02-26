import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { type ApiContext } from "@/lib/api/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

function isAdmin(ctx: ApiContext): boolean {
  return ["admin", "owner"].includes(ctx.role)
}
function ok(data: unknown) { return { content: [{ type: "text" as const, text: JSON.stringify(data) }] } }
function err(message: string) { return { content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }], isError: true as const } }

export function registerProductTools(server: McpServer, ctx: ApiContext) {
  server.tool(
    "list-products",
    "List products/inventory items with optional filters",
    {
      categoryId: z.string().uuid().optional().describe("Filter by category ID"),
      lowStock: z.boolean().optional().describe("Only show low stock items"),
      page: z.number().int().positive().optional().describe("Page number (default 1)"),
      limit: z.number().int().positive().max(100).optional().describe("Results per page (default 20)"),
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async ({ categoryId, lowStock, page = 1, limit = 20 }) => {
      if (!isAdmin(ctx)) return err("Insufficient permissions: admin or owner required")

      const where: Record<string, unknown> = { businessId: ctx.businessId, isActive: true, deletedAt: null }
      if (categoryId) where.categoryId = categoryId

      const [products, total] = await Promise.all([
        prisma.product.findMany({
          where: where as never,
          skip: (page - 1) * limit,
          take: limit,
          include: {
            category: { select: { id: true, name: true } },
            inventory: { select: { quantity: true, lowStockThreshold: true } },
          },
          orderBy: { name: "asc" },
        }),
        prisma.product.count({ where: where as never }),
      ])
      return ok({ products, total, page, limit })
    }
  )

  server.tool(
    "create-product",
    "Create a new product/inventory item (admin or owner required)",
    {
      name: z.string().min(1).describe("Product name"),
      description: z.string().optional().describe("Product description"),
      sku: z.string().optional().describe("Stock keeping unit code"),
      categoryId: z.string().uuid().describe("Product category ID"),
      costPrice: z.number().nonnegative().describe("Cost price"),
      retailPrice: z.number().nonnegative().describe("Retail price"),
      stockLevel: z.number().int().nonnegative().describe("Current stock quantity"),
      reorderLevel: z.number().int().nonnegative().optional().describe("Reorder threshold"),
      supplier: z.string().optional().describe("Supplier name"),
    },
    async ({ name, description, sku, categoryId, costPrice, retailPrice, stockLevel, reorderLevel, supplier }) => {
      if (!isAdmin(ctx)) return err("Insufficient permissions: admin or owner required")

      const location = await prisma.location.findFirst({ where: { businessId: ctx.businessId } })
      if (!location) return err("Business not configured")

      const product = await prisma.product.create({
        data: {
          businessId: ctx.businessId,
          categoryId,
          name,
          description,
          sku,
          costPrice,
          retailPrice,
          metadata: supplier ? { supplier } : {},
          isActive: true,
        },
      })

      await prisma.productInventory.create({
        data: {
          productId: product.id,
          locationId: location.id,
          quantity: stockLevel,
          lowStockThreshold: reorderLevel ?? 0,
          reorderPoint: reorderLevel ?? 0,
        },
      })

      return ok(product)
    }
  )

  server.tool(
    "delete-product",
    "Delete a product (admin or owner required)",
    { id: z.string().uuid().describe("Product ID") },
    async ({ id }) => {
      if (!isAdmin(ctx)) return err("Insufficient permissions: admin or owner required")
      const existing = await prisma.product.findFirst({ where: { id, businessId: ctx.businessId } })
      if (!existing) return err("Product not found")
      await prisma.product.update({ where: { id }, data: { isActive: false, deletedAt: new Date() } })
      return ok({ deleted: true })
    }
  )

  server.tool(
    "adjust-stock",
    "Adjust stock level for a product (admin or owner required)",
    {
      id: z.string().uuid().describe("Product ID"),
      adjustment: z.number().int().describe("Amount to adjust (positive to add, negative to remove)"),
      reason: z.string().optional().describe("Reason for adjustment"),
    },
    async ({ id, adjustment, reason }) => {
      if (!isAdmin(ctx)) return err("Insufficient permissions: admin or owner required")

      const inventory = await prisma.productInventory.findFirst({
        where: { productId: id, product: { businessId: ctx.businessId } },
      })
      if (!inventory) return err("Product inventory not found")

      const newQty = inventory.quantity + adjustment
      if (newQty < 0) return err("Adjustment would result in negative stock")

      await prisma.productInventory.update({
        where: { id: inventory.id },
        data: {
          quantity: newQty,
          ...(adjustment > 0 ? { lastRestockAt: new Date() } : {}),
        },
      })

      await prisma.inventoryTransaction.create({
        data: {
          productId: id,
          locationId: inventory.locationId,
          type: adjustment > 0 ? "restock" : "adjustment",
          quantityChange: adjustment,
          quantityAfter: newQty,
          notes: reason,
        },
      })

      return ok({ productId: id, previousQuantity: inventory.quantity, newQuantity: newQty })
    }
  )
}
