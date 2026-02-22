"use server"

import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getBusinessContext } from "@/lib/auth-utils"

type ActionResult<T = void> = { success: true; data: T } | { success: false; error: string }

const createResourceSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.string().optional(),
  description: z.string().optional(),
  capacity: z.number().int().positive().optional(),
  serviceIds: z.array(z.string().uuid()).optional(),
})

const updateResourceSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.string().optional(),
  description: z.string().optional(),
  capacity: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
  serviceIds: z.array(z.string().uuid()).optional(),
})

const idSchema = z.string().uuid("Invalid ID")

export async function createResource(data: {
  name: string
  type?: string
  description?: string
  capacity?: number
  serviceIds?: string[]
}): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = createResourceSchema.parse(data)
    const { businessId } = await getBusinessContext()

    const location = await prisma.location.findFirst({ where: { businessId } })
    if (!location) return { success: false, error: "Business not configured" }

    const resource = await prisma.resource.create({
      data: {
        businessId,
        locationId: location.id,
        name: parsed.name,
        type: parsed.type || "room",
        description: parsed.description,
        capacity: parsed.capacity || 1,
        serviceIds: parsed.serviceIds || [],
      },
    })
    revalidatePath("/settings")
    return { success: true, data: { id: resource.id } }
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    }
    const msg = (e as Error).message
    if (msg === "Not authenticated" || msg === "No business context") {
      return { success: false, error: msg }
    }
    console.error("createResource error:", e)
    return { success: false, error: msg }
  }
}

export async function updateResource(
  id: string,
  data: {
    name?: string
    type?: string
    description?: string
    capacity?: number
    isActive?: boolean
    serviceIds?: string[]
  }
): Promise<ActionResult> {
  try {
    const parsedId = idSchema.parse(id)
    const parsed = updateResourceSchema.parse(data)
    const { businessId } = await getBusinessContext()
    await prisma.resource.update({
      where: { id: parsedId, businessId },
      data: parsed,
    })
    revalidatePath("/settings")
    return { success: true, data: undefined }
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    }
    console.error("updateResource error:", e)
    return { success: false, error: (e as Error).message }
  }
}

export async function deleteResource(id: string): Promise<ActionResult> {
  try {
    const parsedId = idSchema.parse(id)
    const { businessId } = await getBusinessContext()
    await prisma.resource.delete({ where: { id: parsedId, businessId } })
    revalidatePath("/settings")
    return { success: true, data: undefined }
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    }
    console.error("deleteResource error:", e)
    return { success: false, error: (e as Error).message }
  }
}
