"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getBusinessContext } from "@/lib/auth-utils"

type ActionResult<T = void> = { success: true; data: T } | { success: false; error: string }

export async function createResource(data: {
  name: string
  type?: string
  description?: string
  capacity?: number
  serviceIds?: string[]
}): Promise<ActionResult<{ id: string }>> {
  try {
    const { businessId } = await getBusinessContext()

    const location = await prisma.location.findFirst({ where: { businessId } })
    if (!location) return { success: false, error: "Business not configured" }

    const resource = await prisma.resource.create({
      data: {
        businessId,
        locationId: location.id,
        name: data.name,
        type: data.type || "room",
        description: data.description,
        capacity: data.capacity || 1,
        serviceIds: data.serviceIds || [],
      },
    })
    revalidatePath("/settings")
    return { success: true, data: { id: resource.id } }
  } catch (e) {
    const msg = (e as Error).message
    if (msg === "Not authenticated" || msg === "No business context") {
      return { success: false, error: msg }
    }
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
    const { businessId } = await getBusinessContext()
    await prisma.resource.update({
      where: { id, businessId },
      data,
    })
    revalidatePath("/settings")
    return { success: true, data: undefined }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function deleteResource(id: string): Promise<ActionResult> {
  try {
    const { businessId } = await getBusinessContext()
    await prisma.resource.delete({ where: { id, businessId } })
    revalidatePath("/settings")
    return { success: true, data: undefined }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
