"use server"

import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getBusinessContext } from "@/lib/auth-utils"

type ActionResult<T = void> = { success: true; data: T } | { success: false; error: string }

const createClientSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
})

const updateClientSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").optional(),
  lastName: z.string().trim().min(1, "Last name is required").optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
})

export async function createClient(data: {
  firstName: string
  lastName: string
  email?: string
  phone?: string
  notes?: string
  tags?: string[]
}): Promise<ActionResult<{ id: string }>> {
  try {
    createClientSchema.parse(data)
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { success: false, error: "Invalid input: " + e.issues[0]?.message }
    }
    throw e
  }

  try {
    const { businessId } = await getBusinessContext()

    const normalizedEmail = data.email?.trim().toLowerCase() || null

    if (normalizedEmail) {
      const existing = await prisma.client.findFirst({
        where: { businessId, email: normalizedEmail },
      })
      if (existing) return { success: false, error: "A client with this email already exists" }
    }

    const client = await prisma.client.create({
      data: {
        businessId,
        firstName: data.firstName,
        lastName: data.lastName,
        email: normalizedEmail,
        phone: data.phone || null,
        notes: data.notes || null,
        tags: data.tags || [],
      },
    })

    revalidatePath("/clients")
    revalidatePath("/dashboard")
    return { success: true, data: { id: client.id } }
  } catch (e) {
    const msg = (e as Error).message
    if (msg === "Not authenticated" || msg === "No business context") {
      return { success: false, error: msg }
    }
    console.error("createClient error:", e)
    return { success: false, error: msg }
  }
}

export async function updateClient(
  id: string,
  data: {
    firstName?: string
    lastName?: string
    email?: string
    phone?: string
    notes?: string
    tags?: string[]
  }
): Promise<ActionResult> {
  try {
    z.string().uuid().parse(id)
    updateClientSchema.parse(data)
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { success: false, error: "Invalid input: " + e.issues[0]?.message }
    }
    throw e
  }

  try {
    const { businessId } = await getBusinessContext()

    if (data.email) {
      const normalizedEmail = data.email.trim().toLowerCase()
      const existing = await prisma.client.findFirst({
        where: { businessId, email: normalizedEmail, id: { not: id } },
      })
      if (existing) return { success: false, error: "A client with this email already exists" }
      data.email = normalizedEmail
    }

    await prisma.client.update({
      where: { id, businessId },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        notes: data.notes,
        tags: data.tags,
      },
    })

    revalidatePath("/clients")
    revalidatePath(`/clients/${id}`)
    return { success: true, data: undefined }
  } catch (e) {
    console.error("updateClient error:", e)
    return { success: false, error: (e as Error).message }
  }
}

export async function deleteClient(id: string): Promise<ActionResult> {
  try {
    const { businessId } = await getBusinessContext()

    await prisma.client.update({
      where: { id, businessId },
      data: { deletedAt: new Date() },
    })

    revalidatePath("/clients")
    return { success: true, data: undefined }
  } catch (e) {
    console.error("deleteClient error:", e)
    return { success: false, error: (e as Error).message }
  }
}
