"use server"

import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { requireMinRole } from "@/lib/auth-utils"

type ActionResult<T = void> = { success: true; data: T } | { success: false; error: string }

const createBundleSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  serviceIds: z.array(z.string().uuid()).min(2, "A bundle needs at least 2 services"),
  bundlePrice: z.number().positive(),
  validityDays: z.number().int().positive().optional(),
  maxRedemptions: z.number().int().positive().optional(),
})

export async function createBundle(data: {
  name: string
  description?: string
  serviceIds: string[]
  bundlePrice: number
  validityDays?: number
  maxRedemptions?: number
}): Promise<ActionResult<{ id: string }>> {
  try {
    createBundleSchema.parse(data)
  } catch (e) {
    if (e instanceof z.ZodError) return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    throw e
  }

  try {
    const { businessId } = await requireMinRole("admin")

    // Calculate original price from services
    const services = await prisma.service.findMany({
      where: { id: { in: data.serviceIds }, businessId },
      select: { price: true },
    })
    const originalPrice = services.reduce((sum, s) => sum + Number(s.price), 0)
    const discountPercent = originalPrice > 0
      ? Math.round((1 - data.bundlePrice / originalPrice) * 10000) / 100
      : 0

    const bundle = await prisma.serviceBundle.create({
      data: {
        businessId,
        name: data.name,
        description: data.description,
        serviceIds: data.serviceIds,
        originalPrice,
        bundlePrice: data.bundlePrice,
        discountPercent,
        validityDays: data.validityDays,
        maxRedemptions: data.maxRedemptions,
      },
    })

    revalidatePath("/services")
    return { success: true, data: { id: bundle.id } }
  } catch (e) {
    console.error("createBundle error:", e)
    return { success: false, error: (e as Error).message }
  }
}

export async function deleteBundle(id: string): Promise<ActionResult> {
  try {
    z.string().uuid().parse(id)
    const { businessId } = await requireMinRole("admin")

    await prisma.serviceBundle.delete({ where: { id, businessId } })
    revalidatePath("/services")
    return { success: true, data: undefined }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function getBundles(businessId: string) {
  const bundles = await prisma.serviceBundle.findMany({
    where: { businessId, isActive: true },
    orderBy: { sortOrder: "asc" },
  })

  return bundles.map((b) => ({
    id: b.id,
    name: b.name,
    description: b.description,
    serviceIds: b.serviceIds,
    originalPrice: Number(b.originalPrice),
    bundlePrice: Number(b.bundlePrice),
    discountPercent: b.discountPercent ? Number(b.discountPercent) : 0,
    validityDays: b.validityDays,
    maxRedemptions: b.maxRedemptions,
    isActive: b.isActive,
  }))
}
