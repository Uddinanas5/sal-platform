import { NextRequest, NextResponse } from 'next/server'
import { getAvailability, getMultiStaffAvailability } from '@/lib/availability'
import { prisma } from '@/lib/prisma'

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
export async function GET(request: NextRequest) {
  try {
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

    // Parse date
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) {
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

    // If staffId provided, get availability for that staff member
    if (staffId) {
      const availability = await getAvailability({
        staffId,
        serviceId,
        date,
        locationId,
      })

      // Get staff details
      const staff = await prisma.staff.findUnique({
        where: { id: staffId },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },
        },
      })

      return NextResponse.json({
        date: availability.date,
        serviceId: availability.serviceId,
        serviceDuration: availability.serviceDuration,
        staff: staff ? {
          id: staff.id,
          name: `${staff.user.firstName} ${staff.user.lastName}`,
          avatarUrl: staff.user.avatarUrl,
        } : null,
        slots: availability.slots.map(slot => ({
          start: slot.start.toISOString(),
          end: slot.end.toISOString(),
          startTime: formatTime(slot.start),
          endTime: formatTime(slot.end),
        })),
        totalSlots: availability.slots.length,
      })
    }

    // Get all staff who provide this service at this location
    const staffMembers = await prisma.staff.findMany({
      where: {
        locationId,
        isActive: true,
        canAcceptBookings: true,
        staffServices: {
          some: {
            serviceId,
            isActive: true,
          },
        },
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    })

    if (staffMembers.length === 0) {
      return NextResponse.json({
        date: dateStr,
        serviceId,
        message: 'No staff members available for this service',
        availability: [],
      })
    }

    // Get availability for all staff
    const availabilityMap = await getMultiStaffAvailability({
      staffIds: staffMembers.map(s => s.id),
      serviceId,
      date,
      locationId,
    })

    const availability = staffMembers.map(staff => {
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

    // Also return a combined list of all unique times with available staff
    const allSlots = new Map<string, { time: string; staffIds: string[] }>()
    
    for (const [staffId, result] of Array.from(availabilityMap.entries())) {
      for (const slot of result.slots) {
        const key = slot.start.toISOString()
        const existing = allSlots.get(key)
        if (existing) {
          existing.staffIds.push(staffId)
        } else {
          allSlots.set(key, {
            time: formatTime(slot.start),
            staffIds: [staffId],
          })
        }
      }
    }

    const combinedSlots = Array.from(allSlots.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([startTime, data]) => ({
        startTime,
        displayTime: data.time,
        availableStaff: data.staffIds,
        staffCount: data.staffIds.length,
      }))

    return NextResponse.json({
      date: dateStr,
      serviceId,
      serviceDuration: availabilityMap.values().next().value?.serviceDuration || 0,
      byStaff: availability,
      allSlots: combinedSlots,
      totalAvailableSlots: combinedSlots.length,
    })
  } catch (error) {
    console.error('GET /api/availability error:', error)
    const message = error instanceof Error ? error.message : 'Failed to check availability'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
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
