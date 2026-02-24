import { prisma } from "@/lib/prisma"

export async function getServices(businessId?: string) {
  const businessFilter = businessId ? { businessId } : {}

  const services = await prisma.service.findMany({
    where: { isActive: true, deletedAt: null, ...businessFilter },
    select: {
      id: true,
      name: true,
      description: true,
      durationMinutes: true,
      price: true,
      color: true,
      isActive: true,
      category: { select: { name: true } },
    },
    orderBy: { sortOrder: "asc" },
  })

  return services.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description || "",
    duration: s.durationMinutes,
    price: Number(s.price),
    category: s.category?.name || "Uncategorized",
    color: s.color || "#059669",
    isActive: s.isActive,
  }))
}

export async function getServicesByCategory(businessId?: string) {
  const businessFilter = businessId ? { businessId } : {}

  const categories = await prisma.serviceCategory.findMany({
    where: { isActive: true, ...businessFilter },
    select: {
      name: true,
      color: true,
      services: {
        where: { isActive: true, deletedAt: null },
        select: {
          id: true,
          name: true,
          description: true,
          durationMinutes: true,
          price: true,
          color: true,
          isActive: true,
        },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { sortOrder: "asc" },
  })

  return categories.map((cat) => ({
    category: cat.name,
    color: cat.color,
    services: cat.services.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description || "",
      duration: s.durationMinutes,
      price: Number(s.price),
      category: cat.name,
      color: s.color || cat.color || "#059669",
      isActive: s.isActive,
    })),
  }))
}
