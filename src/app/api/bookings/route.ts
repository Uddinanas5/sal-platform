import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isSlotAvailable, generateBookingReference } from '@/lib/availability'
import type { Prisma } from '@/generated/prisma'

/**
 * GET /api/bookings
 * List appointments with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const businessId = searchParams.get('businessId')
    const locationId = searchParams.get('locationId')
    const staffId = searchParams.get('staffId')
    const clientId = searchParams.get('clientId')
    const status = searchParams.get('status')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const date = searchParams.get('date') // Single date filter
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    if (!businessId) {
      return NextResponse.json(
        { error: 'businessId is required' },
        { status: 400 }
      )
    }

    // Build where clause
    const where: Prisma.AppointmentWhereInput = {
      businessId,
    }

    if (locationId) {
      where.locationId = locationId
    }

    if (clientId) {
      where.clientId = clientId
    }

    if (status) {
      where.status = status as Prisma.EnumAppointmentStatusFilter
    }

    // Handle staff filter (appointments where staff member is assigned)
    if (staffId) {
      where.services = {
        some: { staffId }
      }
    }

    // Date filtering
    if (date) {
      const startOfDay = new Date(date)
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date(date)
      endOfDay.setHours(23, 59, 59, 999)
      
      where.startTime = {
        gte: startOfDay,
        lte: endOfDay,
      }
    } else {
      if (dateFrom) {
        where.startTime = {
          ...(where.startTime as object || {}),
          gte: new Date(dateFrom),
        }
      }
      if (dateTo) {
        where.startTime = {
          ...(where.startTime as object || {}),
          lte: new Date(dateTo),
        }
      }
    }

    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        include: {
          client: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
          location: {
            select: {
              id: true,
              name: true,
            },
          },
          services: {
            include: {
              service: {
                select: {
                  id: true,
                  name: true,
                  color: true,
                },
              },
              staff: {
                include: {
                  user: {
                    select: {
                      firstName: true,
                      lastName: true,
                      avatarUrl: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { startTime: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.appointment.count({ where }),
    ])

    return NextResponse.json({
      appointments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('GET /api/bookings error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch appointments' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/bookings
 * Create a new appointment
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const {
      businessId,
      locationId,
      clientId,
      services, // Array of { serviceId, staffId, startTime }
      notes,
      source = 'online',
    } = body

    // Validation
    if (!businessId || !locationId || !services || services.length === 0) {
      return NextResponse.json(
        { error: 'businessId, locationId, and at least one service are required' },
        { status: 400 }
      )
    }

    // Fetch service details and validate availability
    const serviceDetails = await Promise.all(
      services.map(async (svc: { serviceId: string; staffId: string; startTime: string }) => {
        const service = await prisma.service.findUnique({
          where: { id: svc.serviceId },
          include: {
            staffServices: {
              where: { staffId: svc.staffId, isActive: true },
            },
          },
        })

        if (!service) {
          throw new Error(`Service ${svc.serviceId} not found`)
        }

        if (service.staffServices.length === 0) {
          throw new Error(`Staff ${svc.staffId} does not provide service ${service.name}`)
        }

        // Check availability
        const startTime = new Date(svc.startTime)
        const available = await isSlotAvailable({
          staffId: svc.staffId,
          serviceId: svc.serviceId,
          startTime,
          locationId,
        })

        if (!available) {
          throw new Error(`Time slot ${svc.startTime} is not available for ${service.name}`)
        }

        const staffService = service.staffServices[0]
        const duration = staffService.customDuration || service.durationMinutes
        const price = staffService.customPrice || service.price

        const endTime = new Date(startTime.getTime() + duration * 60000)

        return {
          serviceId: svc.serviceId,
          staffId: svc.staffId,
          name: service.name,
          durationMinutes: duration,
          price: price,
          startTime,
          endTime,
          taxRate: service.taxRate,
          isTaxable: service.isTaxable,
        }
      })
    )

    // Calculate totals
    const subtotal = serviceDetails.reduce(
      (sum, svc) => sum + Number(svc.price),
      0
    )
    
    const taxAmount = serviceDetails.reduce((sum, svc) => {
      if (svc.isTaxable && svc.taxRate) {
        return sum + (Number(svc.price) * Number(svc.taxRate) / 100)
      }
      return sum
    }, 0)

    const totalAmount = subtotal + taxAmount

    // Calculate appointment time range
    const appointmentStart = new Date(Math.min(...serviceDetails.map(s => s.startTime.getTime())))
    const appointmentEnd = new Date(Math.max(...serviceDetails.map(s => s.endTime.getTime())))
    const totalDuration = Math.round((appointmentEnd.getTime() - appointmentStart.getTime()) / 60000)

    // Create appointment with services in a transaction
    const appointment = await prisma.$transaction(async (tx) => {
      const apt = await tx.appointment.create({
        data: {
          businessId,
          locationId,
          clientId,
          bookingReference: generateBookingReference(),
          status: 'pending',
          source: source,
          startTime: appointmentStart,
          endTime: appointmentEnd,
          totalDuration,
          subtotal,
          taxAmount,
          discountAmount: 0,
          totalAmount,
          depositAmount: 0,
          notes,
        },
      })

      // Create appointment services
      await tx.appointmentService.createMany({
        data: serviceDetails.map((svc, index) => ({
          appointmentId: apt.id,
          serviceId: svc.serviceId,
          staffId: svc.staffId,
          name: svc.name,
          durationMinutes: svc.durationMinutes,
          price: svc.price,
          discountAmount: 0,
          taxAmount: svc.isTaxable && svc.taxRate 
            ? Number(svc.price) * Number(svc.taxRate) / 100 
            : 0,
          finalPrice: svc.isTaxable && svc.taxRate
            ? Number(svc.price) * (1 + Number(svc.taxRate) / 100)
            : Number(svc.price),
          startTime: svc.startTime,
          endTime: svc.endTime,
          status: 'scheduled',
          sortOrder: index,
        })),
      })

      // Update client visit stats if client exists
      if (clientId) {
        await tx.client.update({
          where: { id: clientId },
          data: {
            totalVisits: { increment: 1 },
            lastVisitAt: appointmentStart,
          },
        })
      }

      return apt
    })

    // Fetch the complete appointment with relations
    const fullAppointment = await prisma.appointment.findUnique({
      where: { id: appointment.id },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        location: {
          select: {
            id: true,
            name: true,
          },
        },
        services: {
          include: {
            service: true,
            staff: {
              include: {
                user: {
                  select: {
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    return NextResponse.json(fullAppointment, { status: 201 })
  } catch (error) {
    console.error('POST /api/bookings error:', error)
    const message = error instanceof Error ? error.message : 'Failed to create appointment'
    return NextResponse.json(
      { error: message },
      { status: 400 }
    )
  }
}
