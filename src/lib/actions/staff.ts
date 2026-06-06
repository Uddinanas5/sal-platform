"use server"

import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getBusinessContext, requireMinRole } from "@/lib/auth-utils"

type ActionResult<T = void> = { success: true; data: T } | { success: false; error: string }

const breakSchema = z.object({
  startTime: z.string(),
  endTime: z.string(),
  isPaid: z.boolean().optional(),
})

const updateStaffScheduleSchema = z.object({
  staffId: z.string().uuid(),
  schedule: z.array(z.object({
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: z.string(),
    endTime: z.string(),
    isWorking: z.boolean(),
    breaks: z.array(breakSchema).optional(),
  })),
})

type ScheduleDay = z.infer<typeof updateStaffScheduleSchema>["schedule"][number]

const requestTimeOffSchema = z.object({
  staffId: z.string().uuid(),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  type: z.enum(["vacation", "sick", "personal", "other"]),
  notes: z.string().optional(),
})

const timeOffDecisionSchema = z.object({
  timeOffId: z.string().uuid(),
})

// A one-off "block time" (e.g. "block 2-3pm today") is just a partial-day,
// pre-APPROVED StaffTimeOff row. The availability engine already honors approved
// rows with startTime/endTime as a blocked range, so no migration is needed.
const createTimeBlockSchema = z.object({
  staffId: z.string().uuid(),
  // YYYY-MM-DD (the single day the block applies to)
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  // HH:MM 24h
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Invalid start time"),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Invalid end time"),
  reason: z.string().trim().min(1, "Reason is required").max(200),
})

const createStaffSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  role: z.string().min(1),
  serviceIds: z.array(z.string().uuid()).optional(),
})

const deleteStaffSchema = z.object({
  id: z.string().uuid(),
})

export async function updateStaffSchedule(
  staffId: string,
  schedule: ScheduleDay[]
): Promise<ActionResult> {
  try {
    const parsed = updateStaffScheduleSchema.parse({ staffId, schedule })
    staffId = parsed.staffId
    schedule = parsed.schedule

    const { businessId, userId, role } = await getBusinessContext()

    const staff = await prisma.staff.findFirst({
      where: { id: staffId, primaryLocation: { businessId } },
    })
    if (!staff) return { success: false, error: "Staff not found" }

    // Staff can only update their own schedule; admins/owners can update any
    if (role === "staff" && staff.userId !== userId) {
      return { success: false, error: "You can only update your own schedule" }
    }

    // Fetch business hours to prevent scheduling on closed days
    const businessHours = await prisma.businessHours.findMany({
      where: { locationId: staff.locationId },
      select: { dayOfWeek: true, isClosed: true },
    })
    const closedDays = new Set(businessHours.filter(bh => bh.isClosed).map(bh => bh.dayOfWeek))

    // Delete existing schedules and recreate
    await prisma.staffSchedule.deleteMany({ where: { staffId } })

    for (const day of schedule) {
      // Skip days the business is closed — staff can't work on closed days
      if (day.isWorking && !closedDays.has(day.dayOfWeek)) {
        // Persist breaks alongside the schedule so the availability engine
        // (which already blocks break times) actually keeps clients from
        // booking over them. Skip zero/negative-length breaks.
        const validBreaks = (day.breaks ?? []).filter(
          (b) => b.startTime && b.endTime && b.startTime < b.endTime
        )
        await prisma.staffSchedule.create({
          data: {
            staffId,
            locationId: staff.locationId,
            dayOfWeek: day.dayOfWeek,
            startTime: new Date(`2000-01-01T${day.startTime}:00`),
            endTime: new Date(`2000-01-01T${day.endTime}:00`),
            isWorking: true,
            breaks: validBreaks.length
              ? {
                  create: validBreaks.map((b) => ({
                    startTime: new Date(`2000-01-01T${b.startTime}:00`),
                    endTime: new Date(`2000-01-01T${b.endTime}:00`),
                    isPaid: b.isPaid ?? false,
                  })),
                }
              : undefined,
          },
        })
      }
    }

    revalidatePath("/staff")
    revalidatePath(`/staff/${staffId}`)
    revalidatePath("/calendar")
    return { success: true, data: undefined }
  } catch (e) {
    if (e instanceof z.ZodError) return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    console.error("updateStaffSchedule error:", e)
    return { success: false, error: (e as Error).message }
  }
}

export async function requestTimeOff(data: {
  staffId: string
  startDate: string
  endDate: string
  type: "vacation" | "sick" | "personal" | "other"
  notes?: string
}): Promise<ActionResult> {
  try {
    const parsed = requestTimeOffSchema.parse(data)
    const { businessId } = await getBusinessContext()

    // Verify the staff belongs to this business
    const staff = await prisma.staff.findFirst({
      where: { id: parsed.staffId, primaryLocation: { businessId } },
    })
    if (!staff) return { success: false, error: "Staff not found" }

    await prisma.staffTimeOff.create({
      data: {
        staffId: parsed.staffId,
        startDate: new Date(parsed.startDate),
        endDate: new Date(parsed.endDate),
        type: parsed.type,
        // New requests are always pending; the availability engine only blocks
        // APPROVED rows, so a fresh request never silently blocks the calendar.
        status: "pending",
        notes: parsed.notes,
      },
    })

    revalidatePath(`/staff/${parsed.staffId}`)
    // Approval can later block slots, but revalidate now so the new pending row
    // shows up immediately in the time-off tab.
    revalidatePath("/calendar")
    return { success: true, data: undefined }
  } catch (e) {
    if (e instanceof z.ZodError) return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    console.error("requestTimeOff error:", e)
    return { success: false, error: (e as Error).message }
  }
}

export type TimeOffRow = {
  id: string
  staffId: string
  startDate: string
  endDate: string
  type: "vacation" | "sick" | "personal" | "other"
  status: "pending" | "approved" | "rejected"
  notes: string | null
  approvedAt: string | null
}

/**
 * List the REAL StaffTimeOff rows for a staff member, scoped to the caller's
 * business (multi-tenant isolation). Dates are serialized to ISO strings so the
 * result is safe to hand to a client component.
 */
export async function getStaffTimeOff(staffId: string): Promise<ActionResult<TimeOffRow[]>> {
  try {
    const parsed = z.object({ staffId: z.string().uuid() }).parse({ staffId })
    const { businessId, userId, role } = await getBusinessContext()

    // Verify the staff belongs to this business before reading their rows.
    const staff = await prisma.staff.findFirst({
      where: { id: parsed.staffId, primaryLocation: { businessId } },
      select: { id: true, userId: true },
    })
    if (!staff) return { success: false, error: "Staff not found" }

    // Staff-role users may only read their own time off.
    if (role === "staff" && staff.userId !== userId) {
      return { success: false, error: "You can only view your own time off" }
    }

    const rows = await prisma.staffTimeOff.findMany({
      where: { staffId: parsed.staffId },
      orderBy: { startDate: "desc" },
    })

    return {
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        staffId: r.staffId,
        startDate: r.startDate.toISOString(),
        endDate: r.endDate.toISOString(),
        type: r.type as TimeOffRow["type"],
        status: r.status as TimeOffRow["status"],
        notes: r.notes,
        approvedAt: r.approvedAt ? r.approvedAt.toISOString() : null,
      })),
    }
  } catch (e) {
    if (e instanceof z.ZodError) return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    console.error("getStaffTimeOff error:", e)
    return { success: false, error: (e as Error).message }
  }
}

/**
 * Approve a pending time-off request over the REAL row. Once status is
 * "approved" the existing availability engine (availability.ts) blocks those
 * slots — this is the missing link that made pending requests never block the
 * calendar. Admin/owner only; the row must belong to the caller's business.
 */
export async function approveTimeOff(timeOffId: string): Promise<ActionResult> {
  return decideTimeOff(timeOffId, "approved")
}

/**
 * Reject a pending time-off request over the REAL row. Rejected rows are never
 * honored by the availability engine, so the calendar stays open.
 */
export async function rejectTimeOff(timeOffId: string): Promise<ActionResult> {
  return decideTimeOff(timeOffId, "rejected")
}

async function decideTimeOff(
  timeOffId: string,
  decision: "approved" | "rejected"
): Promise<ActionResult> {
  try {
    const parsed = timeOffDecisionSchema.parse({ timeOffId })

    // Only admins/owners can approve or deny — a staff member can't approve
    // their own time off into the calendar.
    const { businessId, userId } = await requireMinRole("admin")

    // Load the row WITH its staff so we can confirm tenant ownership from the
    // DB — never trust the client's claim about which business this belongs to.
    const timeOff = await prisma.staffTimeOff.findFirst({
      where: {
        id: parsed.timeOffId,
        staff: { primaryLocation: { businessId } },
      },
      select: { id: true, staffId: true, status: true },
    })
    if (!timeOff) return { success: false, error: "Time-off request not found" }

    await prisma.staffTimeOff.update({
      where: { id: timeOff.id },
      data: {
        status: decision,
        approvedBy: userId,
        approvedAt: new Date(),
      },
    })

    revalidatePath(`/staff/${timeOff.staffId}`)
    // Approving blocks slots; rejecting reopens them — either way the calendar
    // must reflect the new availability.
    revalidatePath("/calendar")
    return { success: true, data: undefined }
  } catch (e) {
    if (e instanceof z.ZodError) return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    const msg = (e as Error).message
    if (msg.startsWith("Insufficient permissions") || msg === "Not authenticated" || msg === "No business context") {
      return { success: false, error: msg }
    }
    console.error("decideTimeOff error:", e)
    return { success: false, error: msg }
  }
}

/**
 * Create a one-off "block time" on the calendar (e.g. "block 2-3pm today")
 * without filing a formal time-off request. This reuses the EXISTING
 * StaffTimeOff model: a one-off block is simply a partial-day StaffTimeOff row
 * created with status "approved" so the availability engine
 * (availability.ts) immediately treats startTime..endTime as a blocked range —
 * no migration, no new tender, no schema change.
 *
 * Permissions: admins/owners can block any staff member; a staff-role user may
 * block only their OWN calendar. The row is always scoped to (and validated
 * against) the caller's businessId — businessId is derived from the session,
 * never trusted from input, so one business can never block another's staff.
 */
export async function createTimeBlock(data: {
  staffId: string
  date: string
  startTime: string
  endTime: string
  reason: string
}): Promise<ActionResult> {
  try {
    const parsed = createTimeBlockSchema.parse(data)

    if (parsed.startTime >= parsed.endTime) {
      return { success: false, error: "End time must be after start time" }
    }

    const { businessId, userId, role } = await getBusinessContext()

    // Validate the staff belongs to THIS business (tenant isolation): the row is
    // only ever created for a staff member resolved under the caller's business.
    const staff = await prisma.staff.findFirst({
      where: { id: parsed.staffId, primaryLocation: { businessId } },
      select: { id: true, userId: true },
    })
    if (!staff) return { success: false, error: "Staff not found" }

    // Staff-role users can only block their own calendar; admins/owners any.
    if (role === "staff" && staff.userId !== userId) {
      return { success: false, error: "You can only block your own calendar" }
    }

    // Single-day block: startDate === endDate. Parse the date as UTC midnight
    // (date-only `new Date("YYYY-MM-DD")`) to match createTimeOffRequest and the
    // availability engine's startOfDay comparison — NOT local midnight, which
    // skews the date window on a non-UTC host. Time-only columns are stored on
    // the canonical 2000-01-01 date, matching how breaks/schedules write @db.Time.
    const blockDate = new Date(parsed.date.slice(0, 10))

    await prisma.staffTimeOff.create({
      data: {
        staffId: parsed.staffId,
        startDate: blockDate,
        endDate: blockDate,
        startTime: new Date(`2000-01-01T${parsed.startTime}:00`),
        endTime: new Date(`2000-01-01T${parsed.endTime}:00`),
        // "personal" is an existing TimeOffType; one-off blocks are personal.
        type: "personal",
        // Pre-approved so the availability engine blocks the slot immediately —
        // a one-off block is not a request that waits on an admin.
        status: "approved",
        approvedBy: userId,
        approvedAt: new Date(),
        notes: parsed.reason,
      },
    })

    revalidatePath(`/staff/${parsed.staffId}`)
    // The block must show up as unavailable on the calendar right away.
    revalidatePath("/calendar")
    return { success: true, data: undefined }
  } catch (e) {
    if (e instanceof z.ZodError) return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    const msg = (e as Error).message
    if (msg === "Not authenticated" || msg === "No business context") {
      return { success: false, error: msg }
    }
    console.error("createTimeBlock error:", e)
    return { success: false, error: msg }
  }
}

export async function createStaff(data: {
  firstName: string
  lastName: string
  email: string
  phone?: string
  role: string
  serviceIds?: string[]
}): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = createStaffSchema.parse(data)

    const { businessId } = await requireMinRole("admin")

    const location = await prisma.location.findFirst({ where: { businessId } })
    if (!location) return { success: false, error: "Business not configured" }

    const existingUser = await prisma.user.findUnique({ where: { email: parsed.email } })
    if (existingUser) return { success: false, error: "A user with this email already exists" }

    const user = await prisma.user.create({
      data: {
        email: parsed.email,
        firstName: parsed.firstName,
        lastName: parsed.lastName,
        phone: parsed.phone,
        role: "staff",
      },
    })

    const staff = await prisma.staff.create({
      data: {
        userId: user.id,
        locationId: location.id,
        title: parsed.role,
        isActive: true,
      },
    })

    if (parsed.serviceIds?.length) {
      for (const serviceId of parsed.serviceIds) {
        await prisma.staffService.create({
          data: { staffId: staff.id, serviceId },
        })
      }
    }

    revalidatePath("/staff")
    revalidatePath("/calendar")
    return { success: true, data: { id: staff.id } }
  } catch (e) {
    if (e instanceof z.ZodError) return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    const msg = (e as Error).message
    if (msg === "Not authenticated" || msg === "No business context") {
      return { success: false, error: msg }
    }
    console.error("createStaff error:", e)
    return { success: false, error: msg }
  }
}

const updateStaffServicesSchema = z.object({
  staffId: z.string().uuid(),
  serviceIds: z.array(z.string().uuid()),
})

export async function updateStaffServices(data: {
  staffId: string
  serviceIds: string[]
}): Promise<ActionResult> {
  try {
    const parsed = updateStaffServicesSchema.parse(data)
    const { businessId, userId, role } = await getBusinessContext()

    // Verify the staff belongs to this business
    const staff = await prisma.staff.findFirst({
      where: { id: parsed.staffId, primaryLocation: { businessId } },
      select: { id: true, userId: true },
    })
    if (!staff) return { success: false, error: "Staff not found" }

    // Allow if user is admin/manager/owner or updating their own services
    const isAdminOrManager = role === "admin" || role === "owner" || role === "manager"
    const isOwnRecord = staff.userId === userId
    if (!isAdminOrManager && !isOwnRecord) {
      return { success: false, error: "Insufficient permissions" }
    }

    // Delete existing StaffService records and recreate
    await prisma.staffService.deleteMany({ where: { staffId: parsed.staffId } })

    if (parsed.serviceIds.length > 0) {
      await prisma.staffService.createMany({
        data: parsed.serviceIds.map((serviceId) => ({
          staffId: parsed.staffId,
          serviceId,
        })),
      })
    }

    revalidatePath("/staff")
    revalidatePath(`/staff/${parsed.staffId}`)
    revalidatePath("/calendar")
    return { success: true, data: undefined }
  } catch (e) {
    if (e instanceof z.ZodError) return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    console.error("updateStaffServices error:", e)
    return { success: false, error: (e as Error).message }
  }
}

export async function deleteStaff(id: string): Promise<ActionResult> {
  try {
    const parsed = deleteStaffSchema.parse({ id })
    id = parsed.id

    const { businessId } = await requireMinRole("admin")

    // Verify staff belongs to this business before updating
    const staff = await prisma.staff.findFirst({
      where: { id, primaryLocation: { businessId } },
    })
    if (!staff) return { success: false, error: "Staff not found" }

    await prisma.staff.update({
      where: { id },
      data: { isActive: false, deletedAt: new Date() },
    })
    revalidatePath("/staff")
    revalidatePath("/calendar")
    return { success: true, data: undefined }
  } catch (e) {
    if (e instanceof z.ZodError) return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    console.error("deleteStaff error:", e)
    return { success: false, error: (e as Error).message }
  }
}

const updateStaffProfileSchema = z.object({
  staffId: z.string().uuid(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional(),
  commissionRate: z.number().min(0).max(100).optional(),
  color: z.string().optional(),
})

export async function updateStaffProfile(data: {
  staffId: string
  firstName?: string
  lastName?: string
  phone?: string
  commissionRate?: number
  color?: string
}): Promise<ActionResult> {
  try {
    updateStaffProfileSchema.parse(data)
  } catch (e) {
    if (e instanceof z.ZodError) return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    throw e
  }

  try {
    await requireMinRole("admin")

    const staff = await prisma.staff.findUnique({
      where: { id: data.staffId },
      select: { userId: true },
    })
    if (!staff) return { success: false, error: "Staff member not found" }

    // Update user fields (name, phone)
    if (data.firstName || data.lastName || data.phone !== undefined) {
      await prisma.user.update({
        where: { id: staff.userId },
        data: {
          ...(data.firstName && { firstName: data.firstName }),
          ...(data.lastName && { lastName: data.lastName }),
          ...(data.phone !== undefined && { phone: data.phone }),
        },
      })
    }

    // Update staff fields (commission, color)
    if (data.commissionRate !== undefined || data.color) {
      await prisma.staff.update({
        where: { id: data.staffId },
        data: {
          ...(data.commissionRate !== undefined && { commissionRate: data.commissionRate }),
          ...(data.color && { color: data.color }),
        },
      })
    }

    revalidatePath("/staff")
    revalidatePath(`/staff/${data.staffId}`)
    revalidatePath("/calendar")
    return { success: true, data: undefined }
  } catch (e) {
    console.error("updateStaffProfile error:", e)
    return { success: false, error: (e as Error).message }
  }
}
