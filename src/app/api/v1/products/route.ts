import { withV1Auth } from "@/lib/api/auth"
import { apiSuccess, apiPaginated, ERRORS } from "@/lib/api/response"
import { hasRole } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

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

export async function GET(req: Request) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()
  if (!hasRole(ctx.role, "admin")) return ERRORS.FORBIDDEN()

  const url = new URL(req.url)
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"))
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20")))
  const categoryId = url.searchParams.get("categoryId")
  const lowStock = url.searchParams.get("lowStock") === "true"

  const where: Record<string, unknown> = { businessId: ctx.businessId, isActive: true, deletedAt: null }
  if (categoryId) where.categoryId = categoryId
  if (lowStock) {
    where.inventory = { some: { quantity: { lte: prisma.productInventory.fields.lowStockThreshold } } }
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where: where as never,
      include: {
        category: { select: { id: true, name: true } },
        inventory: { select: { quantity: true, lowStockThreshold: true } },
      },
      orderBy: { name: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.product.count({ where: where as never }),
  ])

  return apiPaginated(products, { page, limit, total })
}

export async function POST(req: Request) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()
  if (!hasRole(ctx.role, "admin")) return ERRORS.FORBIDDEN()

  let body: unknown
  try { body = await req.json() } catch { return ERRORS.BAD_REQUEST("Invalid JSON") }

  const parsed = createProductSchema.safeParse(body)
  if (!parsed.success) return ERRORS.BAD_REQUEST(parsed.error.issues[0]?.message ?? "Invalid input")

  const location = await prisma.location.findFirst({ where: { businessId: ctx.businessId } })
  if (!location) return ERRORS.BAD_REQUEST("Business not configured")

  const product = await prisma.product.create({
    data: {
      businessId: ctx.businessId,
      categoryId: parsed.data.categoryId,
      name: parsed.data.name,
      description: parsed.data.description,
      sku: parsed.data.sku,
      costPrice: parsed.data.costPrice,
      retailPrice: parsed.data.retailPrice,
      metadata: parsed.data.supplier ? { supplier: parsed.data.supplier } : {},
      isActive: true,
    },
  })

  await prisma.productInventory.create({
    data: {
      productId: product.id,
      locationId: location.id,
      quantity: parsed.data.stockLevel,
      lowStockThreshold: parsed.data.reorderLevel,
      reorderPoint: parsed.data.reorderLevel,
    },
  })

  return apiSuccess(product, 201)
}
