import { prisma } from "@/lib/prisma"
import { hasRole } from "@/lib/permissions"

/**
 * Roster of active staff for a business.
 *
 * SECURE BY DEFAULT (L-044): pay + contact PII (commission, email, phone) are
 * stripped unless the CALLER is admin+. Most callers are staff-accessible pages
 * (/calendar, /services, /booking, search) that forward this array straight to
 * the browser and never display pay/PII — so a forgotten caller can no longer
 * leak a colleague's commission or contact details by default. Admin surfaces
 * (the /staff roster) pass their live role to opt back in.
 */
export async function getStaff(businessId: string, viewerRole?: string | null) {
  const canSeeSensitive = hasRole(viewerRole, "admin")
  const staff = await prisma.staff.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      primaryLocation: { businessId },
    },
    select: {
      id: true,
      isActive: true,
      commissionRate: true,
      color: true,
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          avatarUrl: true,
          role: true,
        },
      },
      staffServices: { select: { serviceId: true } },
      staffSchedules: {
        select: {
          dayOfWeek: true,
          startTime: true,
          endTime: true,
          isWorking: true,
        },
      },
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
      // Pay + contact PII stripped for non-admin callers (L-044).
      email: canSeeSensitive ? s.user.email : "",
      phone: canSeeSensitive ? s.user.phone || "" : "",
      avatar: s.user.avatarUrl || undefined,
      role: s.user.role === "admin" ? "admin" as const : s.user.role === "owner" ? "admin" as const : "staff" as const,
      services: s.staffServices.map((ss) => ss.serviceId),
      workingHours,
      color: s.color || "#059669",
      isActive: s.isActive,
      commission: canSeeSensitive ? Number(s.commissionRate) : 0,
    }
  })
}

export async function getStaffById(id: string, businessId: string) {
  const staff = await prisma.staff.findFirst({
    where: { id, primaryLocation: { businessId } },
    select: {
      id: true,
      userId: true,
      commissionRate: true,
      color: true,
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          role: true,
        },
      },
      staffServices: {
        select: {
          service: { select: { id: true, name: true } },
        },
      },
      staffSchedules: {
        select: {
          dayOfWeek: true,
          startTime: true,
          endTime: true,
          isWorking: true,
          breaks: {
            select: {
              startTime: true,
              endTime: true,
              isPaid: true,
            },
          },
        },
      },
    },
  })

  if (!staff) return null

  // Build working hours from schedules (same format as getStaff)
  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
  const workingHours: Record<
    string,
    { start: string; end: string; break?: { start: string; end: string } | null } | null
  > = {}
  for (const day of dayNames) workingHours[day] = null
  for (const sched of staff.staffSchedules) {
    const dayName = dayNames[sched.dayOfWeek]
    if (sched.isWorking && sched.startTime && sched.endTime) {
      const fmt = (d: Date) => `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`
      const brk = sched.breaks?.[0]
      workingHours[dayName] = {
        start: fmt(sched.startTime),
        end: fmt(sched.endTime),
        break: brk ? { start: fmt(brk.startTime), end: fmt(brk.endTime) } : null,
      }
    }
  }

  return {
    id: staff.id,
    userId: staff.userId,
    name: `${staff.user.firstName} ${staff.user.lastName}`,
    email: staff.user.email,
    phone: staff.user.phone || "",
    role: staff.user.role === "owner" ? "admin" as const : staff.user.role as "admin" | "staff",
    services: staff.staffServices.map((ss) => ss.service.id),
    serviceDetails: staff.staffServices.map((ss) => ({
      id: ss.service.id,
      name: ss.service.name,
    })),
    assignedServiceIds: staff.staffServices.map((ss) => ss.service.id),
    workingHours,
    commission: Number(staff.commissionRate),
    color: staff.color || "#059669",
  }
}
