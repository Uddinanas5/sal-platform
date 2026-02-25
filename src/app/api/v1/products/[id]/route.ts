import { withV1Auth } from "@/lib/api/auth"
import { apiSuccess, ERRORS } from "@/lib/api/response"
import { hasRole } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()
  if (!hasRole(ctx.role, "admin")) return ERRORS.FORBIDDEN()
  const { id } = await params

  const product = await prisma.product.findUnique({
    where: { id, businessId: ctx.businessId },
    include: {
      category: true,
      inventory: true,
    },
  })
  if (!product) return ERRORS.NOT_FOUND("Product")
  return apiSuccess(product)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()
  if (!hasRole(ctx.role, "admin")) return ERRORS.FORBIDDEN()
  const { id } = await params

  try {
    await prisma.product.update({
      where: { id, businessId: ctx.businessId },
      data: { isActive: false, deletedAt: new Date() },
    })
    return apiSuccess({ deleted: true })
  } catch {
    return ERRORS.NOT_FOUND("Product")
  }
}
