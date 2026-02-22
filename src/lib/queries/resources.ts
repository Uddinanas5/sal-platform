import { prisma } from "@/lib/prisma"

export async function getResources(businessId?: string) {
  const businessFilter = businessId ? { businessId } : {}

  const resources = await prisma.resource.findMany({
    where: businessFilter,
    orderBy: { sortOrder: "asc" },
  })
  return resources.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type,
    description: r.description || "",
    capacity: r.capacity,
    isActive: r.isActive,
    serviceIds: r.serviceIds,
    createdAt: r.createdAt,
  }))
}

export async function getResourceCount(businessId?: string) {
  const businessFilter = businessId ? { businessId } : {}

  return prisma.resource.count({
    where: { ...businessFilter, isActive: true },
  })
}
