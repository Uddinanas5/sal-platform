import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/staff
 * List staff members with their services
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const businessId = searchParams.get('businessId')
    const locationId = searchParams.get('locationId')
    const serviceId = searchParams.get('serviceId')
    const canAcceptBookings = searchParams.get('canAcceptBookings')
    const includeInactive = searchParams.get('includeInactive') === 'true'

    if (!businessId && !locationId) {
      return NextResponse.json(
        { error: 'businessId or locationId is required' },
        { status: 400 }
      )
    }

    // Build where clause
    const where: Record<string, unknown> = {
      deletedAt: null,
    }

    if (locationId) {
      where.OR = [
        { locationId },
        { staffLocations: { some: { locationId } } },
      ]
    }

    if (businessId && !locationId) {
      where.primaryLocation = {
        businessId,
      }
    }

    if (!includeInactive) {
      where.isActive = true
    }

    if (canAcceptBookings !== null && canAcceptBookings !== undefined) {
      where.canAcceptBookings = canAcceptBookings === 'true'
    }

    if (serviceId) {
      where.staffServices = {
        some: {
          serviceId,
          isActive: true,
        },
      }
    }

    const staff = await prisma.staff.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            avatarUrl: true,
          },
        },
        primaryLocation: {
          select: {
            id: true,
            name: true,
            businessId: true,
          },
        },
        staffServices: {
          where: { isActive: true },
          include: {
            service: {
              select: {
                id: true,
                name: true,
                durationMinutes: true,
                price: true,
                color: true,
                category: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        staffSchedules: {
          where: {
            isWorking: true,
            OR: [
              { effectiveUntil: null },
              { effectiveUntil: { gte: new Date() } },
            ],
          },
          select: {
            dayOfWeek: true,
            startTime: true,
            endTime: true,
            locationId: true,
          },
          orderBy: { dayOfWeek: 'asc' },
        },
      },
      orderBy: [
        { sortOrder: 'asc' },
        { user: { firstName: 'asc' } },
      ],
    })

    // Transform response
    const transformedStaff = staff.map(member => ({
      id: member.id,
      userId: member.user.id,
      name: `${member.user.firstName} ${member.user.lastName}`,
      firstName: member.user.firstName,
      lastName: member.user.lastName,
      email: member.user.email,
      phone: member.user.phone,
      avatarUrl: member.user.avatarUrl,
      title: member.title,
      bio: member.bio,
      specializations: member.specializations,
      color: member.color,
      canAcceptBookings: member.canAcceptBookings,
      employmentType: member.employmentType,
      location: member.primaryLocation,
      services: member.staffServices.map(ss => ({
        id: ss.service.id,
        name: ss.service.name,
        durationMinutes: ss.customDuration || ss.service.durationMinutes,
        price: ss.customPrice || ss.service.price,
        color: ss.service.color,
        category: ss.service.category,
      })),
      serviceCount: member.staffServices.length,
      schedule: formatSchedule(member.staffSchedules),
    }))

    return NextResponse.json({
      staff: transformedStaff,
      total: transformedStaff.length,
    })
  } catch (error) {
    console.error('GET /api/staff error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch staff' },
      { status: 500 }
    )
  }
}

/**
 * Format staff schedule for response
 */
function formatSchedule(schedules: Array<{
  dayOfWeek: number
  startTime: Date
  endTime: Date
  locationId: string
}>): Record<string, { start: string; end: string }> {
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const schedule: Record<string, { start: string; end: string }> = {}

  for (const s of schedules) {
    const dayName = dayNames[s.dayOfWeek]
    schedule[dayName] = {
      start: formatTimeOnly(s.startTime),
      end: formatTimeOnly(s.endTime),
    }
  }

  return schedule
}

/**
 * Format time for display (HH:MM)
 */
function formatTimeOnly(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

/**
 * POST /api/staff
 * Create a new staff member
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      userId,
      locationId,
      employeeId,
      title,
      bio,
      specializations = [],
      commissionRate = 0,
      hourlyRate,
      employmentType = 'full_time',
      hireDate,
      canAcceptBookings = true,
      bookingBufferMinutes = 0,
      maxDailyAppointments,
      color,
      serviceIds = [],
      schedule = [], // Array of { dayOfWeek, startTime, endTime }
    } = body

    // Validation
    if (!userId || !locationId) {
      return NextResponse.json(
        { error: 'userId and locationId are required' },
        { status: 400 }
      )
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const staffMember = await prisma.$transaction(async (tx) => {
      // Create staff profile
      const newStaff = await tx.staff.create({
        data: {
          userId,
          locationId,
          employeeId,
          title,
          bio,
          specializations,
          commissionRate,
          hourlyRate,
          employmentType,
          hireDate: hireDate ? new Date(hireDate) : null,
          canAcceptBookings,
          bookingBufferMinutes,
          maxDailyAppointments,
          color,
        },
      })

      // Assign services
      if (serviceIds.length > 0) {
        await tx.staffService.createMany({
          data: serviceIds.map((serviceId: string) => ({
            staffId: newStaff.id,
            serviceId,
            isActive: true,
          })),
        })
      }

      // Create schedule
      if (schedule.length > 0) {
        await tx.staffSchedule.createMany({
          data: schedule.map((s: { dayOfWeek: number; startTime: string; endTime: string }) => ({
            staffId: newStaff.id,
            locationId,
            dayOfWeek: s.dayOfWeek,
            startTime: parseTime(s.startTime),
            endTime: parseTime(s.endTime),
            isWorking: true,
          })),
        })
      }

      return newStaff
    })

    // Fetch with relations
    const fullStaff = await prisma.staff.findUnique({
      where: { id: staffMember.id },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
          },
        },
        primaryLocation: true,
        staffServices: {
          include: {
            service: true,
          },
        },
        staffSchedules: true,
      },
    })

    return NextResponse.json(fullStaff, { status: 201 })
  } catch (error) {
    console.error('POST /api/staff error:', error)
    return NextResponse.json(
      { error: 'Failed to create staff member' },
      { status: 500 }
    )
  }
}

/**
 * Parse time string (HH:MM) to Date
 */
function parseTime(timeStr: string): Date {
  const [hours, minutes] = timeStr.split(':').map(Number)
  const date = new Date()
  date.setHours(hours, minutes, 0, 0)
  return date
}
