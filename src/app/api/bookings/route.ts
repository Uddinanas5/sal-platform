import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getBusinessContext } from '@/lib/auth-utils'
import { isSlotAvailable, generateBookingReference } from '@/lib/availability'
import { withSafeErrors } from '@/lib/api/safe-handler'
import { parseYmd } from '@/lib/date-utils'
import type { Prisma } from '@/generated/prisma'

/**
 * GET /api/bookings
 * List appointments with optional filters
 */
export const GET = withSafeErrors('GET /api/bookings', async (request: NextRequest) => {
    let ctx
    try {
      ctx = await getBusinessContext()
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const locationId = searchParams.get('locationId')
    const staffId = searchParams.get('staffId')
    const clientId = searchParams.get('clientId')
    const status = searchParams.get('status')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const date = searchParams.get('date') // Single date filter
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    // businessId is always the caller's business — ignore any value in the query string
    const where: Prisma.AppointmentWhereInput = {
      businessId: ctx.businessId,
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

    // Date filtering — parse YYYY-MM-DD strictly so impossible calendar dates
    // like 2026-06-31 reject with 400 instead of silently rolling to July 1.
    if (date) {
      const startOfDay = parseYmd(date)
      if (!startOfDay) {
        return NextResponse.json(
          { error: 'Invalid date. Use YYYY-MM-DD' },
          { status: 400 }
        )
      }
      const endOfDay = parseYmd(date)!
      endOfDay.setHours(23, 59, 59, 999)

      where.startTime = {
        gte: startOfDay,
        lte: endOfDay,
      }
    } else {
      if (dateFrom) {
        const from = parseYmd(dateFrom)
        if (!from) {
          return NextResponse.json(
            { error: 'Invalid dateFrom. Use YYYY-MM-DD' },
            { status: 400 }
          )
        }
        where.startTime = {
          ...(where.startTime as object || {}),
          gte: from,
        }
      }
      if (dateTo) {
        const to = parseYmd(dateTo)
        if (!to) {
          return NextResponse.json(
            { error: 'Invalid dateTo. Use YYYY-MM-DD' },
            { status: 400 }
          )
        }
        to.setHours(23, 59, 59, 999)
        where.startTime = {
          ...(where.startTime as object || {}),
          lte: to,
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
})

/**
 * POST /api/bookings
 * Create a new appointment
 */
export const POST = withSafeErrors('POST /api/bookings', async (request: NextRequest) => {
    // Require authentication for dashboard-created bookings
    // Public booking widget uses /book/[businessSlug] via server actions instead
    let ctx
    try {
      ctx = await getBusinessContext()
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    const {
      locationId,
      clientId,
      services, // Array of { serviceId, staffId, startTime }
      notes,
      source = 'online',
    } = body

    // businessId is always the caller's business — ignore any value in the body
    const businessId = ctx.businessId

    // Validation
    if (!locationId || !services || services.length === 0) {
      return NextResponse.json(
        { error: 'locationId and at least one service are required' },
        { status: 400 }
      )
    }

    // Validate location belongs to caller's business
    const location = await prisma.location.findFirst({
      where: { id: locationId, businessId },
      select: { id: true },
    })
    if (!location) {
      return NextResponse.json(
        { error: 'Location not found' },
        { status: 404 }
      )
    }

    // If a clientId is provided, validate it belongs to caller's business
    if (clientId) {
      const client = await prisma.client.findFirst({
        where: { id: clientId, businessId },
        select: { id: true },
      })
      if (!client) {
        return NextResponse.json(
          { error: 'Client not found' },
          { status: 404 }
        )
      }
    }

    // Fetch service details and validate availability
    const serviceDetails = await Promise.all(
      services.map(async (svc: { serviceId: string; staffId: string; startTime: string }) => {
        const service = await prisma.service.findFirst({
          where: { id: svc.serviceId, businessId },
          include: {
            staffServices: {
              where: {
                staffId: svc.staffId,
                isActive: true,
                staff: { primaryLocation: { businessId } },
              },
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
})
