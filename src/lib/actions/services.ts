"use server"

import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { requireMinRole } from "@/lib/auth-utils"

type ActionResult<T = void> = { success: true; data: T } | { success: false; error: string }

const createServiceSchema = z.object({
  name: z.string().trim().min(1, "Service name is required"),
  description: z.string().optional(),
  duration: z.number().int().positive("Duration must be a positive number"),
  price: z.number().nonnegative("Price must be non-negative"),
  categoryId: z.string().trim().min(1, "Category is required"),
  color: z.string().optional(),
  assignedStaff: z.array(z.string().uuid()).optional(),
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
  assignedStaff?: string[]
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
    const { businessId } = await requireMinRole("admin")

    const service = await prisma.$transaction(async (tx) => {
      const category = await tx.serviceCategory.upsert({
        where: {
          businessId_name: {
            businessId,
            name: data.categoryId,
          },
        },
        update: {
          isActive: true,
          deletedAt: null,
        },
        create: {
          businessId,
          name: data.categoryId,
          color: data.color,
          isActive: true,
        },
      })

      const createdService = await tx.service.create({
        data: {
          businessId,
          categoryId: category.id,
          name: data.name,
          description: data.description,
          durationMinutes: data.duration,
          price: data.price,
          color: data.color,
          isActive: true,
        },
      })

      const staffIds = Array.from(new Set(data.assignedStaff ?? []))
      if (staffIds.length > 0) {
        const staffCount = await tx.staff.count({
          where: {
            id: { in: staffIds },
            primaryLocation: { businessId },
            deletedAt: null,
          },
        })
        if (staffCount !== staffIds.length) {
          throw new Error("One or more staff members were not found")
        }

        await tx.staffService.createMany({
          data: staffIds.map((staffId) => ({
            staffId,
            serviceId: createdService.id,
            isActive: true,
          })),
          skipDuplicates: true,
        })
      }

      return createdService
    })

    revalidatePath("/services")
    return { success: true, data: { id: service.id } }
  } catch (e) {
    const msg = (e as Error).message
    if (msg === "Not authenticated" || msg === "No business context") {
      return { success: false, error: msg }
    }
    console.error("createService error:", e)
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
    const { businessId } = await requireMinRole("admin")

    await prisma.service.update({
      where: { id, businessId, deletedAt: null },
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
    console.error("updateService error:", e)
    return { success: false, error: (e as Error).message }
  }
}

export async function toggleServiceActive(id: string): Promise<ActionResult> {
  try {
    const { businessId } = await requireMinRole("admin")

    // deletedAt:null so the toggle can never resurrect a soft-deleted service.
    const service = await prisma.service.findUnique({
      where: { id, businessId, deletedAt: null },
    })
    if (!service) return { success: false, error: "Service not found" }

    await prisma.service.update({
      where: { id, businessId, deletedAt: null },
      data: { isActive: !service.isActive },
    })

    revalidatePath("/services")
    return { success: true, data: undefined }
  } catch (e) {
    console.error("toggleServiceActive error:", e)
    return { success: false, error: (e as Error).message }
  }
}

export async function deleteService(id: string): Promise<ActionResult> {
  try {
    const { businessId } = await requireMinRole("admin")

    await prisma.service.update({
      where: { id, businessId },
      data: { isActive: false, deletedAt: new Date() },
    })
    revalidatePath("/services")
    return { success: true, data: undefined }
  } catch (e) {
    console.error("deleteService error:", e)
    return { success: false, error: (e as Error).message }
  }
}
