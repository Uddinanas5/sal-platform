import { prisma } from "@/lib/prisma"
import { hasRole } from "@/lib/permissions"

type AppointmentAccessContext = {
  userId: string
  businessId: string
  role: string
}

export async function canAccessAppointment(
  ctx: AppointmentAccessContext,
  appointmentId: string
) {
  if (hasRole(ctx.role, "admin")) return true

  const staffProfile = await prisma.staff.findFirst({
    where: {
      userId: ctx.userId,
      primaryLocation: { businessId: ctx.businessId },
      isActive: true,
      deletedAt: null,
    },
    select: { id: true },
  })
  if (!staffProfile) return false

  const assigned = await prisma.appointmentService.findFirst({
    where: {
      appointmentId,
      staffId: staffProfile.id,
      appointment: { businessId: ctx.businessId },
    },
    select: { id: true },
  })

  return Boolean(assigned)
}

export async function canAccessAppointmentSeries(
  ctx: AppointmentAccessContext,
  seriesId: string
) {
  if (hasRole(ctx.role, "admin")) return true

  const staffProfile = await prisma.staff.findFirst({
    where: {
      userId: ctx.userId,
      primaryLocation: { businessId: ctx.businessId },
      isActive: true,
      deletedAt: null,
    },
    select: { id: true },
  })
  if (!staffProfile) return false

  const assigned = await prisma.appointmentService.findFirst({
    where: {
      staffId: staffProfile.id,
      appointment: { seriesId, businessId: ctx.businessId },
    },
    select: { id: true },
  })

  return Boolean(assigned)
}
