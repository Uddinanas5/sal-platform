"use server"

import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getBusinessContext } from "@/lib/auth-utils"

type ActionResult<T = void> = { success: true; data: T } | { success: false; error: string }

const createServiceSchema = z.object({
  name: z.string().trim().min(1, "Service name is required"),
  description: z.string().optional(),
  duration: z.number().int().positive("Duration must be a positive number"),
  price: z.number().nonnegative("Price must be non-negative"),
  categoryId: z.string().uuid(),
  color: z.string().optional(),
})

const updateServiceSchema = z.object({
  name: z.string().trim().min(1, "Service name is required").optional(),
  description: z.string().optional(),
  duration: z.number().int().positive("Duration must be a positive number").optional(),
  price: z.number().nonnegative("Price must be non-negative").optional(),
  color: z.string().optional(),
  isActive: z.boolean().optional(),
})

export async function createService(data: {
  name: string
  description?: string
  duration: number
  price: number
  categoryId: string
  color?: string
}): Promise<ActionResult<{ id: string }>> {
  try {
    createServiceSchema.parse(data)
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { success: false, error: "Invalid input: " + e.issues[0]?.message }
    }
    throw e
  }

  try {
    const { businessId } = await getBusinessContext()

    const service = await prisma.service.create({
      data: {
        businessId,
        categoryId: data.categoryId,
        name: data.name,
        description: data.description,
        durationMinutes: data.duration,
        price: data.price,
        color: data.color,
        isActive: true,
      },
    })

    revalidatePath("/services")
    return { success: true, data: { id: service.id } }
  } catch (e) {
    const msg = (e as Error).message
    if (msg === "Not authenticated" || msg === "No business context") {
      return { success: false, error: msg }
    }
    return { success: false, error: msg }
  }
}

export async function updateService(
  id: string,
  data: {
    name?: string
    description?: string
    duration?: number
    price?: number
    color?: string
    isActive?: boolean
  }
): Promise<ActionResult> {
  try {
    z.string().uuid().parse(id)
    updateServiceSchema.parse(data)
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { success: false, error: "Invalid input: " + e.issues[0]?.message }
    }
    throw e
  }

  try {
    const { businessId } = await getBusinessContext()

    await prisma.service.update({
      where: { id, businessId },
      data: {
        name: data.name,
        description: data.description,
        durationMinutes: data.duration,
        price: data.price,
        color: data.color,
        isActive: data.isActive,
      },
    })

    revalidatePath("/services")
    return { success: true, data: undefined }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function toggleServiceActive(id: string): Promise<ActionResult> {
  try {
    const { businessId } = await getBusinessContext()

    const service = await prisma.service.findUnique({ where: { id, businessId } })
    if (!service) return { success: false, error: "Service not found" }

    await prisma.service.update({
      where: { id, businessId },
      data: { isActive: !service.isActive },
    })

    revalidatePath("/services")
    return { success: true, data: undefined }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function deleteService(id: string): Promise<ActionResult> {
  try {
    const { businessId } = await getBusinessContext()

    await prisma.service.update({
      where: { id, businessId },
      data: { isActive: false, deletedAt: new Date() },
    })
    revalidatePath("/services")
    return { success: true, data: undefined }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
