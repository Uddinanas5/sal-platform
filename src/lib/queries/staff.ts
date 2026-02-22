import { prisma } from "@/lib/prisma"

export async function getStaff(businessId?: string) {
  // Staff links to business through location
  const locationFilter = businessId
    ? { primaryLocation: { businessId } }
    : {}

  const staff = await prisma.staff.findMany({
    where: { isActive: true, deletedAt: null, ...locationFilter },
    include: {
      user: true,
      staffServices: { include: { service: true } },
      staffSchedules: true,
    },
    orderBy: { sortOrder: "asc" },
  })

  return staff.map((s) => {
    const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
    const workingHours: Record<string, { start: string; end: string } | null> = {}

    for (const day of dayNames) {
      const schedule = s.staffSchedules.find(
        (sch) => sch.dayOfWeek === dayNames.indexOf(day) && sch.isWorking
      )
      if (schedule) {
        const startH = schedule.startTime.getUTCHours().toString().padStart(2, "0")
        const startM = schedule.startTime.getUTCMinutes().toString().padStart(2, "0")
        const endH = schedule.endTime.getUTCHours().toString().padStart(2, "0")
        const endM = schedule.endTime.getUTCMinutes().toString().padStart(2, "0")
        workingHours[day] = { start: `${startH}:${startM}`, end: `${endH}:${endM}` }
      } else {
        workingHours[day] = null
      }
    }

    return {
      id: s.id,
      name: `${s.user.firstName} ${s.user.lastName}`,
      email: s.user.email,
      phone: s.user.phone || "",
      avatar: s.user.avatarUrl || undefined,
      role: s.user.role === "admin" ? "admin" as const : s.user.role === "owner" ? "admin" as const : "staff" as const,
      services: s.staffServices.map((ss) => ss.serviceId),
      workingHours,
      color: s.color || "#059669",
      isActive: s.isActive,
      commission: Number(s.commissionRate),
    }
  })
}

export async function getStaffById(id: string) {
  const staff = await prisma.staff.findUnique({
    where: { id },
    include: {
      user: true,
      staffServices: { include: { service: true } },
      staffSchedules: { include: { breaks: true } },
    },
  })

  if (!staff) return null

  return {
    id: staff.id,
    name: `${staff.user.firstName} ${staff.user.lastName}`,
    email: staff.user.email,
    phone: staff.user.phone || "",
    role: staff.user.role,
    services: staff.staffServices.map((ss) => ({
      id: ss.service.id,
      name: ss.service.name,
    })),
    commission: Number(staff.commissionRate),
    color: staff.color || "#059669",
  }
}
