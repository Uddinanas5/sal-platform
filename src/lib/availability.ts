import { prisma } from './prisma'

interface TimeSlot {
  start: Date
  end: Date
}

interface AvailabilityParams {
  staffId: string
  serviceId: string
  date: Date // The date to check availability for
  locationId: string
}

interface AvailabilityResult {
  slots: TimeSlot[]
  staffId: string
  serviceId: string
  date: string
  serviceDuration: number
}

/**
 * Get available time slots for a staff member on a given date
 */
export async function getAvailability(params: AvailabilityParams): Promise<AvailabilityResult> {
  const { staffId, serviceId, date, locationId } = params

  // Normalize date to start of day
  const startOfDay = new Date(date)
  startOfDay.setHours(0, 0, 0, 0)

  const endOfDay = new Date(date)
  endOfDay.setHours(23, 59, 59, 999)

  const dayOfWeek = date.getDay() // 0 = Sunday, 1 = Monday, etc.

  // Fetch all required data in parallel
  const [service, staffSchedule, staffTimeOff, existingAppointments, staff] = await Promise.all([
    // Get service duration
    prisma.service.findUnique({
      where: { id: serviceId },
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
          { effectiveFrom: { lte: startOfDay } },
        ],
        AND: [
          {
            OR: [
              { effectiveUntil: null },
              { effectiveUntil: { gte: startOfDay } },
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
        startDate: { lte: startOfDay },
        endDate: { gte: startOfDay },
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

    // Get staff buffer settings
    prisma.staff.findUnique({
      where: { id: staffId },
      select: {
        bookingBufferMinutes: true,
        canAcceptBookings: true,
      },
    }),
  ])

  // Validation checks
  if (!service) {
    throw new Error('Service not found')
  }

  if (!staff || !staff.canAcceptBookings) {
    return {
      slots: [],
      staffId,
      serviceId,
      date: startOfDay.toISOString().split('T')[0],
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
        date: startOfDay.toISOString().split('T')[0],
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
      date: startOfDay.toISOString().split('T')[0],
      serviceDuration: service.durationMinutes,
    }
  }

  // Calculate total service duration including buffers
  const totalDuration = service.durationMinutes + 
    service.bufferBeforeMinutes + 
    service.bufferAfterMinutes + 
    staff.bookingBufferMinutes

  // Get working hours for the day
  const workStart = combineDateWithTime(startOfDay, staffSchedule.startTime)
  const workEnd = combineDateWithTime(startOfDay, staffSchedule.endTime)

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
      start: combineDateWithTime(startOfDay, brk.startTime),
      end: combineDateWithTime(startOfDay, brk.endTime),
    })
  }

  // Add partial time off if applicable
  if (staffTimeOff?.startTime && staffTimeOff?.endTime) {
    blockedRanges.push({
      start: combineDateWithTime(startOfDay, staffTimeOff.startTime),
      end: combineDateWithTime(startOfDay, staffTimeOff.endTime),
    })
  }

  // Sort blocked ranges by start time
  blockedRanges.sort((a, b) => a.start.getTime() - b.start.getTime())

  // Generate available slots
  const slots: TimeSlot[] = []
  const slotInterval = 15 // 15-minute intervals

  let currentTime = new Date(workStart)

  // Skip past times if checking today
  const now = new Date()
  if (startOfDay.toDateString() === now.toDateString()) {
    // Round up to next slot interval
    const minutes = now.getMinutes()
    const roundedMinutes = Math.ceil(minutes / slotInterval) * slotInterval
    const minStartTime = new Date(now)
    minStartTime.setMinutes(roundedMinutes, 0, 0)
    
    // Add minimum booking lead time (e.g., 30 minutes)
    minStartTime.setMinutes(minStartTime.getMinutes() + 30)
    
    if (minStartTime > currentTime) {
      currentTime = minStartTime
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

    // Move to next slot
    currentTime.setMinutes(currentTime.getMinutes() + slotInterval)
  }

  return {
    slots,
    staffId,
    serviceId,
    date: startOfDay.toISOString().split('T')[0],
    serviceDuration: service.durationMinutes,
  }
}

/**
 * Combine a date with a time value (from DateTime @db.Time field)
 */
function combineDateWithTime(date: Date, time: Date): Date {
  const result = new Date(date)
  result.setHours(time.getHours(), time.getMinutes(), time.getSeconds(), 0)
  return result
}

/**
 * Check if a specific time slot is available
 */
export async function isSlotAvailable(params: {
  staffId: string
  serviceId: string
  startTime: Date
  locationId: string
}): Promise<boolean> {
  const { staffId, serviceId, startTime, locationId } = params

  const availability = await getAvailability({
    staffId,
    serviceId,
    date: startTime,
    locationId,
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
}): Promise<Map<string, AvailabilityResult>> {
  const { staffIds, serviceId, date, locationId } = params

  const results = await Promise.all(
    staffIds.map(staffId => 
      getAvailability({ staffId, serviceId, date, locationId })
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
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let result = 'SAL-'
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}
