"use server"

import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getBusinessContext } from "@/lib/auth-utils"

const createFormTemplateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  fields: z.array(z.record(z.string(), z.unknown())),
  serviceIds: z.array(z.string().uuid()).optional(),
  isAutoSend: z.boolean().optional(),
  isRequired: z.boolean().optional(),
})

const updateFormTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  fields: z.array(z.record(z.string(), z.unknown())).optional(),
  serviceIds: z.array(z.string().uuid()).optional(),
  isAutoSend: z.boolean().optional(),
  isRequired: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

const idSchema = z.string().uuid("Invalid ID")

const submitFormSchema = z.object({
  templateId: z.string().uuid(),
  clientId: z.string().uuid(),
  appointmentId: z.string().uuid().optional(),
  data: z.record(z.string(), z.unknown()),
})

export async function createFormTemplate(data: {
  name: string
  description?: string
  fields: Record<string, unknown>[]
  serviceIds?: string[]
  isAutoSend?: boolean
  isRequired?: boolean
}) {
  try {
    const parsed = createFormTemplateSchema.parse(data)
    const { businessId } = await getBusinessContext()

    const template = await prisma.formTemplate.create({
      data: {
        businessId,
        name: parsed.name,
        description: parsed.description,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        fields: parsed.fields as any,
        serviceIds: parsed.serviceIds || [],
        isAutoSend: parsed.isAutoSend || false,
        isRequired: parsed.isRequired || false,
      },
    })
    revalidatePath("/settings")
    return template
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    }
    throw e
  }
}

export async function updateFormTemplate(
  id: string,
  data: {
    name?: string
    description?: string
    fields?: Record<string, unknown>[]
    serviceIds?: string[]
    isAutoSend?: boolean
    isRequired?: boolean
    isActive?: boolean
  }
) {
  try {
    const parsedId = idSchema.parse(id)
    const parsed = updateFormTemplateSchema.parse(data)
    const { businessId } = await getBusinessContext()

    const template = await prisma.formTemplate.update({
      where: { id: parsedId, businessId },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: parsed as any,
    })
    revalidatePath("/settings")
    return template
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    }
    throw e
  }
}

export async function deleteFormTemplate(id: string) {
  try {
    const parsedId = idSchema.parse(id)
    const { businessId } = await getBusinessContext()
    await prisma.formTemplate.delete({ where: { id: parsedId, businessId } })
    revalidatePath("/settings")
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    }
    throw e
  }
}

export async function submitForm(data: {
  templateId: string
  clientId: string
  appointmentId?: string
  data: Record<string, unknown>
}) {
  try {
    const parsed = submitFormSchema.parse(data)
    const submission = await prisma.formSubmission.create({
      data: {
        templateId: parsed.templateId,
        clientId: parsed.clientId,
        appointmentId: parsed.appointmentId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: parsed.data as any,
        submittedAt: new Date(),
      },
    })
    revalidatePath("/clients")
    return submission
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    }
    throw e
  }
}
