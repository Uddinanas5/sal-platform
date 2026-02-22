"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getBusinessContext } from "@/lib/auth-utils"

export async function createFormTemplate(data: {
  name: string
  description?: string
  fields: Record<string, unknown>[]
  serviceIds?: string[]
  isAutoSend?: boolean
  isRequired?: boolean
}) {
  const { businessId } = await getBusinessContext()

  const template = await prisma.formTemplate.create({
    data: {
      businessId,
      name: data.name,
      description: data.description,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fields: data.fields as any,
      serviceIds: data.serviceIds || [],
      isAutoSend: data.isAutoSend || false,
      isRequired: data.isRequired || false,
    },
  })
  revalidatePath("/settings")
  return template
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
  const { businessId } = await getBusinessContext()

  const template = await prisma.formTemplate.update({
    where: { id, businessId },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: data as any,
  })
  revalidatePath("/settings")
  return template
}

export async function deleteFormTemplate(id: string) {
  const { businessId } = await getBusinessContext()
  await prisma.formTemplate.delete({ where: { id, businessId } })
  revalidatePath("/settings")
}

export async function submitForm(data: {
  templateId: string
  clientId: string
  appointmentId?: string
  data: Record<string, unknown>
}) {
  const submission = await prisma.formSubmission.create({
    data: {
      templateId: data.templateId,
      clientId: data.clientId,
      appointmentId: data.appointmentId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: data.data as any,
      submittedAt: new Date(),
    },
  })
  revalidatePath("/clients")
  return submission
}
