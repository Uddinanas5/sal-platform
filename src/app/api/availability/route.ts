import { NextRequest, NextResponse } from 'next/server'
import { getMultiStaffAvailability } from '@/lib/availability'
import { prisma } from '@/lib/prisma'
import { getPublicBookingSettings } from '@/lib/actions/booking-settings'
import { withSafeErrors } from '@/lib/api/safe-handler'

export const dynamic = 'force-dynamic'

const LEAD_TIME_MAP: Record<string, number> = {
  none: 0, '1h': 60, '2h': 120, '4h': 240, '12h': 720, '24h': 1440, '48h': 2880,
}

/**
 * GET /api/availability
 * Check available time slots for a service on a given date
 *
 * Query params:
 * - serviceId (required): The service to check availability for
 * - date (required): The date to check (YYYY-MM-DD)
 * - locationId (required): The location
 * - staffId (optional): Specific staff member, or returns all staff availability
 */
export const GET = withSafeErrors('GET /api/availability', async (request: NextRequest) => {
    const searchParams = request.nextUrl.searchParams
    const serviceId = searchParams.get('serviceId')
    const dateStr = searchParams.get('date')
    const locationId = searchParams.get('locationId')
    const staffId = searchParams.get('staffId')

    // Validation
    if (!serviceId) {
      return NextResponse.json(
        { error: 'serviceId is required' },
        { status: 400 }
      )
    }

    if (!dateStr) {
      return NextResponse.json(
        { error: 'date is required (YYYY-MM-DD format)' },
        { status: 400 }
      )
    }

    if (!locationId) {
      return NextResponse.json(
        { error: 'locationId is required' },
        { status: 400 }
      )
    }

    // Parse date strictly — `new Date('2027-02-30')` silently rolls to March 2,
    // so we round-trip the components to reject impossible calendar dates.
    const date = parseYmd(dateStr)
    if (!date) {
      return NextResponse.json(
        { error: 'Invalid date format. Use YYYY-MM-DD' },
        { status: 400 }
      )
    }

    // Check date is not in the past
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (date < today) {
      return NextResponse.json(
        { error: 'Cannot check availability for past dates' },
        { status: 400 }
      )
    }

    // Fetch service + booking settings to enforce lead time
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      select: { businessId: true, durationMinutes: true },
    })
    if (!service?.businessId) {
      return NextResponse.json(
        { error: 'Service not found' },
        { status: 404 }
      )
    }

    // Verify the location exists and belongs to the same business as the service.
    // Without this, a bogus or cross-tenant locationId leaks through as an empty
    // staff list (200 with no slots), which is indistinguishable from "all booked".
    const location = await prisma.location.findFirst({
      where: { id: locationId, businessId: service.businessId },
      select: { id: true },
    })
    if (!location) {
      return NextResponse.json(
        { error: 'Location not found' },
        { status: 404 }
      )
    }

    const bookingSettings = await getPublicBookingSettings(service.businessId)
    const minLeadTimeMinutes = LEAD_TIME_MAP[bookingSettings.minLeadTime] ?? 30

    // Resolve target staff list — either the explicit staffId, or all bookable staff for this service+location.
    // Explicit-staffId branch must also be scoped to the service's business, otherwise a cross-tenant
    // staffId would be honored (mirrors the locationId check above).
    const staffMembers = staffId
      ? await prisma.staff.findMany({
          where: {
            id: staffId,
            primaryLocation: { businessId: service.businessId },
          },
          include: {
            user: { select: { firstName: true, lastName: true, avatarUrl: true } },
          },
        })
      : await prisma.staff.findMany({
          where: {
            locationId,
            isActive: true,
            canAcceptBookings: true,
            staffServices: { some: { serviceId, isActive: true } },
          },
          include: {
            user: { select: { firstName: true, lastName: true, avatarUrl: true } },
          },
        })

    // If an explicit staffId was provided but didn't resolve under the business scope,
    // surface it as 404 rather than silently returning empty slots (which is
    // indistinguishable from "fully booked").
    if (staffId && staffMembers.length === 0) {
      return NextResponse.json(
        { error: 'Staff not found' },
        { status: 404 }
      )
    }

    // Empty case — return the same envelope with empty slots/byStaff
    if (staffMembers.length === 0) {
      return NextResponse.json({
        date: dateStr,
        serviceId,
        serviceDuration: service.durationMinutes,
        slots: [],
        byStaff: [],
      })
    }

    const availabilityMap = await getMultiStaffAvailability({
      staffIds: staffMembers.map(s => s.id),
      serviceId,
      date,
      locationId,
      minLeadTimeMinutes,
    })

    const byStaff = staffMembers.map(staff => {
      const staffAvailability = availabilityMap.get(staff.id)
      return {
        staff: {
          id: staff.id,
          name: `${staff.user.firstName} ${staff.user.lastName}`,
          avatarUrl: staff.user.avatarUrl,
        },
        slots: staffAvailability?.slots.map(slot => ({
          start: slot.start.toISOString(),
          end: slot.end.toISOString(),
          startTime: formatTime(slot.start),
          endTime: formatTime(slot.end),
        })) || [],
        totalSlots: staffAvailability?.slots.length || 0,
      }
    })

    // Unified slot list — keyed by start time, with the staff who can take it
    const slotMap = new Map<string, { end: Date; start: Date; staffIds: string[] }>()
    for (const [sId, result] of Array.from(availabilityMap.entries())) {
      for (const slot of result.slots) {
        const key = slot.start.toISOString()
        const existing = slotMap.get(key)
        if (existing) {
          existing.staffIds.push(sId)
        } else {
          slotMap.set(key, { start: slot.start, end: slot.end, staffIds: [sId] })
        }
      }
    }

    const slots = Array.from(slotMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, data]) => ({
        start: data.start.toISOString(),
        end: data.end.toISOString(),
        startTime: formatTime(data.start),
        endTime: formatTime(data.end),
        availableStaff: data.staffIds,
        staffCount: data.staffIds.length,
      }))

    return NextResponse.json({
      date: dateStr,
      serviceId,
      serviceDuration: availabilityMap.values().next().value?.serviceDuration ?? service.durationMinutes,
      slots,
      byStaff,
    })
})

/**
 * Strict YYYY-MM-DD parser. Returns null for malformed input or impossible
 * calendar dates (e.g. 2027-02-30, 2026-13-01). Round-trips the parsed
 * components against the resulting Date to catch JS's silent month/day overflow.
 */
function parseYmd(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  const d = new Date(year, month - 1, day)
  if (
    d.getFullYear() !== year ||
    d.getMonth() !== month - 1 ||
    d.getDate() !== day
  ) {
    return null
  }
  return d
}

/**
 * Format time for display (e.g., "10:30 AM")
 */
function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}
