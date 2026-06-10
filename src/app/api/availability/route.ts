import { NextRequest, NextResponse } from 'next/server'
import { getMultiStaffAvailability } from '@/lib/availability'
import { prisma } from '@/lib/prisma'
import { getPublicBookingSettings } from '@/lib/actions/booking-settings'
import { withSafeErrors } from '@/lib/api/safe-handler'
import { isUuid } from '@/lib/api/uuid'
import { publicError } from '@/lib/api/public-errors'
import { parseYmd } from '@/lib/date-utils'
import { localDateString } from '@/lib/scheduling/zoned-time'

export const dynamic = 'force-dynamic'

const LEAD_TIME_MAP: Record<string, number> = {
  none: 0, '1h': 60, '2h': 120, '4h': 240, '12h': 720, '24h': 1440, '48h': 2880,
}

// Mirrors MAX_ADVANCE_MAP in the public booking client. Kept in sync by hand
// because the values rarely change and the client is a separate bundle —
// the alternative is dragging client-page code into the API route's import
// graph, which is worse.
const MAX_ADVANCE_DAYS_MAP: Record<string, number> = {
  '1w': 7, '2w': 14, '1m': 30, '2m': 60, '3m': 90,
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
      return publicError('INVALID_REQUEST', 'serviceId is required')
    }

    if (!dateStr) {
      return publicError('INVALID_REQUEST', 'date is required (YYYY-MM-DD format)')
    }

    if (!locationId) {
      return publicError('INVALID_REQUEST', 'locationId is required')
    }

    // PK columns are @db.Uuid — non-UUID strings cause Postgres to throw on
    // the findUnique call rather than returning null, surfacing as a 500 +
    // log noise to anonymous callers. Shape-check before touching Prisma so
    // garbage IDs collapse to the same 404 a missing row would produce.
    if (!isUuid(serviceId)) {
      return publicError('SERVICE_NOT_FOUND')
    }
    if (!isUuid(locationId)) {
      return publicError('LOCATION_NOT_FOUND')
    }
    if (staffId !== null && !isUuid(staffId)) {
      return publicError('STAFF_NOT_FOUND')
    }

    // Parse date strictly — `new Date('2027-02-30')` silently rolls to March 2,
    // so we round-trip the components to reject impossible calendar dates.
    const date = parseYmd(dateStr)
    if (!date) {
      return publicError('INVALID_REQUEST', 'Invalid date format. Use YYYY-MM-DD')
    }

    // Fetch service + booking settings to enforce lead time. isActive + deletedAt
    // null so a soft-deleted (or deleted-then-resurrected) / offline service
    // returns SERVICE_NOT_FOUND from this public endpoint rather than leaking
    // slots — the booking write path filters the same way.
    const service = await prisma.service.findUnique({
      where: { id: serviceId, isActive: true, isOnlineBooking: true, deletedAt: null },
      select: { businessId: true, durationMinutes: true, business: { select: { timezone: true } } },
    })
    if (!service?.businessId) {
      return publicError('SERVICE_NOT_FOUND')
    }

    // The salon's IANA timezone anchors @db.Time working hours and slot labels
    // to the salon's wall clock instead of the server's (UTC on Vercel).
    const timezone = service.business?.timezone || 'UTC'

    // "Today" is the salon's calendar day, NOT the server's. On a UTC host an
    // evening booking in the Americas would otherwise see server-midnight already
    // rolled to tomorrow, rejecting same-day availability every night. Compare
    // YYYY-MM-DD strings in the salon timezone (lexical compare is date-correct).
    const todayKey = localDateString(new Date(), timezone)
    if (dateStr < todayKey) {
      return publicError(
        'OUT_OF_BOOKING_WINDOW',
        'Cannot check availability for past dates'
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
      return publicError('LOCATION_NOT_FOUND')
    }

    const bookingSettings = await getPublicBookingSettings(service.businessId)
    const minLeadTimeMinutes = LEAD_TIME_MAP[bookingSettings.minLeadTime] ?? 30

    // Enforce the same advance-booking ceiling the public booking calendar
    // honours. Without this, `?date=9999-01-01` sails through and we return
    // 200 + empty slots — indistinguishable from "fully booked" and the kind
    // of input that tends to expose weird edges in the staff-schedule query.
    const maxAdvanceDays = MAX_ADVANCE_DAYS_MAP[bookingSettings.maxAdvanceBooking] ?? 30
    // Forward bound is also anchored to the salon's today. Build the max date key
    // by advancing the salon-local civil day, then compare YYYY-MM-DD strings.
    const [ty, tm, td] = todayKey.split('-').map(Number)
    const maxCivil = new Date(Date.UTC(ty, tm - 1, td + maxAdvanceDays))
    const maxKey = `${maxCivil.getUTCFullYear()}-${String(maxCivil.getUTCMonth() + 1).padStart(2, '0')}-${String(maxCivil.getUTCDate()).padStart(2, '0')}`
    if (dateStr > maxKey) {
      return publicError(
        'OUT_OF_BOOKING_WINDOW',
        `Bookings must be made within the next ${maxAdvanceDays} days`
      )
    }

    // Resolve target staff list — either the explicit staffId, or all bookable staff for this service+location.
    // Explicit-staffId branch must also be scoped to the service's business, otherwise a cross-tenant
    // staffId would be honored (mirrors the locationId check above).
    const staffMembers = staffId
      ? await prisma.staff.findMany({
          where: {
            id: staffId,
            // Mirror the booking write path + read query: a removed or
            // not-accepting staffId must resolve to STAFF_NOT_FOUND, not slots.
            isActive: true,
            deletedAt: null,
            canAcceptBookings: true,
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
            deletedAt: null,
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
      return publicError('STAFF_NOT_FOUND')
    }

    // No staff perform this service at this location — distinct from "fully
    // booked". Return a machine-readable reason so the client gates the
    // Join-Waitlist CTA (a waitlist can't conjure a barber for this service).
    if (staffMembers.length === 0) {
      return NextResponse.json({
        date: dateStr,
        serviceId,
        serviceDuration: service.durationMinutes,
        slots: [],
        byStaff: [],
        reason: 'no_staff',
      })
    }

    const availabilityMap = await getMultiStaffAvailability({
      staffIds: staffMembers.map(s => s.id),
      serviceId,
      date,
      locationId,
      minLeadTimeMinutes,
      timezone,
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
          startTime: formatTime(slot.start, timezone),
          endTime: formatTime(slot.end, timezone),
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
        startTime: formatTime(data.start, timezone),
        endTime: formatTime(data.end, timezone),
        availableStaff: data.staffIds,
        staffCount: data.staffIds.length,
      }))

    // Empty slots here means staff DO perform this service and ARE accepting
    // bookings, but every offered slot is taken / the day is closed for them —
    // i.e. genuinely full. That's the one case a waitlist can resolve, so tag it
    // 'fully_booked' and the client gates the Join-Waitlist CTA on this reason.
    return NextResponse.json({
      date: dateStr,
      serviceId,
      serviceDuration: availabilityMap.values().next().value?.serviceDuration ?? service.durationMinutes,
      slots,
      byStaff,
      ...(slots.length === 0 ? { reason: 'fully_booked' } : {}),
    })
})

/**
 * Format time for display (e.g., "10:30 AM") in the salon's timezone, so the
 * label matches the wall clock the client books against on any host.
 */
function formatTime(date: Date, timezone: string): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone || 'UTC',
  })
}
