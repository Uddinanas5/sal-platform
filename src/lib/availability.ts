import { prisma } from './prisma'
import { generateBookingReference as generateSecureBookingReference } from "@/lib/booking-reference"
import { combineDateWithTimeZoned, localDateString } from "@/lib/scheduling/zoned-time"

interface TimeSlot {
  start: Date
  end: Date
}

interface AvailabilityParams {
  staffId: string
  serviceId: string
  date: Date // The date to check availability for
  locationId: string
  // IANA timezone of the salon (Business.timezone). The salon's @db.Time working
  // hours, breaks and time-off windows are interpreted as wall-clock in THIS
  // zone, so a 9am NY salon produces the correct UTC slot instants on any host.
  // Defaults to UTC (the schema default) when not supplied.
  timezone?: string
}

interface AvailabilityResult {
  slots: TimeSlot[]
  staffId: string
  serviceId: string
  date: string
  serviceDuration: number
}

// A canonical midnight `@db.Time` value (00:00:00 stored at UTC midnight),
// reused to derive salon-local day boundaries via combineDateWithTimeZoned.
const ZERO_TIME = new Date(Date.UTC(1970, 0, 1, 0, 0, 0, 0))

/** UTC-midnight Date for a civil day — matches how Postgres stores @db.Date. */
function dayUtcMidnight(civilDate: Date): Date {
  return new Date(Date.UTC(civilDate.getFullYear(), civilDate.getMonth(), civilDate.getDate()))
}

/** YYYY-MM-DD for a civil day (built from local getters of a local-midnight Date). */
function localDateKey(civilDate: Date): string {
  const y = civilDate.getFullYear()
  const m = String(civilDate.getMonth() + 1).padStart(2, "0")
  const d = String(civilDate.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

/**
 * Get available time slots for a staff member on a given date
 */
export async function getAvailability(params: AvailabilityParams & { minLeadTimeMinutes?: number }): Promise<AvailabilityResult> {
  const { staffId, serviceId, date, locationId } = params
  const timezone = params.timezone || "UTC"

  // The requested civil day. `date` is constructed at local midnight of the
  // requested YYYY-MM-DD (parseYmd), so its local getters yield the intended
  // calendar day on any host. We use this civil day to anchor every @db.Time
  // wall-clock to the salon's timezone.
  const civilDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const dateKey = localDateKey(civilDate)

  // Salon-local day boundaries, as absolute UTC instants, used to window the
  // existing-appointments query (its startTime/endTime are absolute @db.Timestamp
  // columns). Midnight-to-midnight in the salon timezone (not the server's).
  const startOfDay = combineDateWithTimeZoned(civilDate, ZERO_TIME, timezone)
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1)

  // For @db.Date columns (schedule effective dates, time-off start/end) Postgres
  // stores UTC midnight, so compare against this day's UTC midnight — not the
  // salon-local instant — to avoid an off-by-one on non-UTC hosts.
  const dayUtc = dayUtcMidnight(civilDate)

  const dayOfWeek = civilDate.getDay() // 0 = Sunday, 1 = Monday, etc.

  // Fetch all required data in parallel
  const [service, staffSchedule, staffTimeOff, existingAppointments, staff, businessHours] = await Promise.all([
    // Get service duration. deletedAt:null so a soft-deleted (incl. resurrected-
    // to-isActive) service never resolves real slots from any availability caller.
    prisma.service.findUnique({
      where: { id: serviceId, deletedAt: null },
      select: {
        durationMinutes: true,
        bufferBeforeMinutes: true,
        bufferAfterMinutes: true,
      },
    }),

    // Get staff schedule for this day
    prisma.staffSchedule.findFirst({
      where: {
        staffId,
        locationId,
        dayOfWeek,
        isWorking: true,
        OR: [
          { effectiveFrom: null },
          { effectiveFrom: { lte: dayUtc } },
        ],
        AND: [
          {
            OR: [
              { effectiveUntil: null },
              { effectiveUntil: { gte: dayUtc } },
            ],
          },
        ],
      },
      include: {
        breaks: true,
      },
    }),

    // Check for time off
    prisma.staffTimeOff.findFirst({
      where: {
        staffId,
        status: 'approved',
        startDate: { lte: dayUtc },
        endDate: { gte: dayUtc },
      },
    }),

    // Get existing appointments for the day
    prisma.appointmentService.findMany({
      where: {
        staffId,
        startTime: { gte: startOfDay },
        endTime: { lte: endOfDay },
        appointment: {
          status: { notIn: ['cancelled'] },
        },
      },
      select: {
        startTime: true,
        endTime: true,
        durationMinutes: true,
      },
      orderBy: { startTime: 'asc' },
    }),

    // Get staff buffer settings + activation flags (defense-in-depth: a
    // deactivated / soft-deleted staff member must never resolve slots, even if
    // a caller's where-clause omitted the isActive/deletedAt filter).
    prisma.staff.findUnique({
      where: { id: staffId },
      select: {
        bookingBufferMinutes: true,
        canAcceptBookings: true,
        isActive: true,
        deletedAt: true,
      },
    }),

    // Get business hours for this location and day
    prisma.businessHours.findFirst({
      where: { locationId, dayOfWeek },
    }),
  ])

  // Validation checks
  if (!service) {
    throw new Error('Service not found')
  }

  if (!staff || !staff.canAcceptBookings || !staff.isActive || staff.deletedAt) {
    return {
      slots: [],
      staffId,
      serviceId,
      date: dateKey,
      serviceDuration: service.durationMinutes,
    }
  }

  // Staff is on time off
  if (staffTimeOff) {
    // Check if partial day off (with specific times)
    if (staffTimeOff.startTime && staffTimeOff.endTime) {
      // Partial day - will be handled as a "break"
    } else {
      // Full day off
      return {
        slots: [],
        staffId,
        serviceId,
        date: dateKey,
        serviceDuration: service.durationMinutes,
      }
    }
  }

  // No schedule for this day
  if (!staffSchedule) {
    return {
      slots: [],
      staffId,
      serviceId,
      date: dateKey,
      serviceDuration: service.durationMinutes,
    }
  }

  // Business is closed this day (no hours entry, or explicitly closed, or missing open/close times)
  if (businessHours && (businessHours.isClosed || !businessHours.openTime || !businessHours.closeTime)) {
    return {
      slots: [],
      staffId,
      serviceId,
      date: dateKey,
      serviceDuration: service.durationMinutes,
    }
  }

  // Calculate total service duration including buffers
  const totalDuration = service.durationMinutes +
    service.bufferBeforeMinutes +
    service.bufferAfterMinutes +
    staff.bookingBufferMinutes

  // Get working hours for the day — constrained to business hours if available.
  // @db.Time wall-clock is interpreted in the salon timezone, anchored to the
  // requested civil day, yielding the correct absolute instants on any host.
  const staffStart = combineDateWithTimeZoned(civilDate, staffSchedule.startTime, timezone)
  const staffEnd = combineDateWithTimeZoned(civilDate, staffSchedule.endTime, timezone)

  let workStart: Date
  let workEnd: Date

  if (businessHours?.openTime && businessHours?.closeTime) {
    const bizOpen = combineDateWithTimeZoned(civilDate, businessHours.openTime, timezone)
    const bizClose = combineDateWithTimeZoned(civilDate, businessHours.closeTime, timezone)
    // Effective window is intersection of staff schedule and business hours
    workStart = staffStart > bizOpen ? staffStart : bizOpen
    workEnd = staffEnd < bizClose ? staffEnd : bizClose
    // If intersection is empty, no slots
    if (workStart >= workEnd) {
      return {
        slots: [],
        staffId,
        serviceId,
        date: dateKey,
        serviceDuration: service.durationMinutes,
      }
    }
  } else {
    // No business hours configured — use staff schedule as-is
    workStart = staffStart
    workEnd = staffEnd
  }

  // Build list of blocked time ranges (appointments + breaks)
  const blockedRanges: TimeSlot[] = []

  // Add existing appointments as blocked
  for (const apt of existingAppointments) {
    blockedRanges.push({
      start: new Date(apt.startTime),
      end: new Date(apt.endTime),
    })
  }

  // Add breaks as blocked
  for (const brk of staffSchedule.breaks) {
    blockedRanges.push({
      start: combineDateWithTimeZoned(civilDate, brk.startTime, timezone),
      end: combineDateWithTimeZoned(civilDate, brk.endTime, timezone),
    })
  }

  // Add partial time off if applicable
  if (staffTimeOff?.startTime && staffTimeOff?.endTime) {
    blockedRanges.push({
      start: combineDateWithTimeZoned(civilDate, staffTimeOff.startTime, timezone),
      end: combineDateWithTimeZoned(civilDate, staffTimeOff.endTime, timezone),
    })
  }

  // Sort blocked ranges by start time
  blockedRanges.sort((a, b) => a.start.getTime() - b.start.getTime())

  // Generate available slots
  const slots: TimeSlot[] = []
  const slotInterval = 15 // 15-minute intervals

  let currentTime = new Date(workStart)

  // Skip past times if checking today, applying configurable min lead time.
  // "Today" is the salon-local calendar day, not the server's — so near
  // midnight on a non-UTC host the lead-time floor is still applied to the
  // right day.
  const now = new Date()
  if (localDateString(now, timezone) === dateKey) {
    const leadTimeMinutes = params.minLeadTimeMinutes ?? 30
    // Round the absolute cutoff up to the next slot-interval boundary measured
    // from the work-window start, so rounding is host-timezone independent.
    const rawCutoff = now.getTime() + leadTimeMinutes * 60 * 1000
    const intervalMs = slotInterval * 60 * 1000
    const fromStart = rawCutoff - workStart.getTime()
    const cutoffMs = workStart.getTime() + Math.ceil(Math.max(0, fromStart) / intervalMs) * intervalMs

    if (cutoffMs > currentTime.getTime()) {
      currentTime = new Date(cutoffMs)
    }
  }

  while (currentTime.getTime() + totalDuration * 60000 <= workEnd.getTime()) {
    const slotEnd = new Date(currentTime.getTime() + totalDuration * 60000)

    // Check if this slot overlaps with any blocked range
    const isBlocked = blockedRanges.some(range =>
      (currentTime < range.end && slotEnd > range.start)
    )

    if (!isBlocked) {
      // The actual appointment time (excluding before buffer)
      const appointmentStart = new Date(currentTime.getTime() + service.bufferBeforeMinutes * 60000)
      const appointmentEnd = new Date(appointmentStart.getTime() + service.durationMinutes * 60000)

      slots.push({
        start: appointmentStart,
        end: appointmentEnd,
      })
    }

    // Move to next slot (absolute arithmetic — host-timezone independent)
    currentTime = new Date(currentTime.getTime() + slotInterval * 60000)
  }

  return {
    slots,
    staffId,
    serviceId,
    date: dateKey,
    serviceDuration: service.durationMinutes,
  }
}

/**
 * Check if a specific time slot is available
 */
export async function isSlotAvailable(params: {
  staffId: string
  serviceId: string
  startTime: Date
  locationId: string
  timezone?: string
}): Promise<boolean> {
  const { staffId, serviceId, startTime, locationId, timezone } = params

  // startTime is an absolute instant; getAvailability anchors slots to the
  // salon-local civil day, so derive that civil day from startTime in the salon
  // timezone (a local-midnight Date getAvailability can read with local getters).
  const tz = timezone || "UTC"
  const localDay = localDateString(startTime, tz) // YYYY-MM-DD in salon tz
  const [y, mo, d] = localDay.split("-").map(Number)
  const civilDate = new Date(y, mo - 1, d)

  const availability = await getAvailability({
    staffId,
    serviceId,
    date: civilDate,
    locationId,
    timezone: tz,
  })

  return availability.slots.some(slot =>
    slot.start.getTime() === startTime.getTime()
  )
}

/**
 * Get availability for multiple staff members
 */
export async function getMultiStaffAvailability(params: {
  staffIds: string[]
  serviceId: string
  date: Date
  locationId: string
  minLeadTimeMinutes?: number
  timezone?: string
}): Promise<Map<string, AvailabilityResult>> {
  const { staffIds, serviceId, date, locationId, minLeadTimeMinutes, timezone } = params

  const results = await Promise.all(
    staffIds.map(staffId =>
      getAvailability({ staffId, serviceId, date, locationId, minLeadTimeMinutes, timezone })
    )
  )

  const map = new Map<string, AvailabilityResult>()
  staffIds.forEach((staffId, index) => {
    map.set(staffId, results[index])
  })

  return map
}

/**
 * Generate a unique booking reference
 */
export function generateBookingReference(): string {
  return generateSecureBookingReference()
}
