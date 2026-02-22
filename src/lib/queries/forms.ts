import { prisma } from "@/lib/prisma"

export async function getFormTemplates(businessId?: string) {
  const businessFilter = businessId ? { businessId } : {}

  const templates = await prisma.formTemplate.findMany({
    where: { ...businessFilter, isActive: true },
    include: { _count: { select: { submissions: true } } },
    orderBy: { createdAt: "desc" },
  })
  return templates.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description || "",
    fields: t.fields as Record<string, unknown>[],
    serviceIds: t.serviceIds,
    isAutoSend: t.isAutoSend,
    isRequired: t.isRequired,
    isActive: t.isActive,
    submissionCount: t._count.submissions,
    createdAt: t.createdAt,
  }))
}

export async function getFormSubmissions(templateId?: string) {
  const submissions = await prisma.formSubmission.findMany({
    where: templateId ? { templateId } : {},
    include: { template: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  })
  return submissions.map((s) => ({
    id: s.id,
    templateId: s.templateId,
    templateName: s.template.name,
    clientId: s.clientId,
    appointmentId: s.appointmentId,
    data: s.data as Record<string, unknown>,
    submittedAt: s.submittedAt,
    createdAt: s.createdAt,
  }))
}
