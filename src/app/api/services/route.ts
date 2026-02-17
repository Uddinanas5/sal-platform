import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/services
 * List services with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const businessId = searchParams.get('businessId')
    const categoryId = searchParams.get('categoryId')
    const staffId = searchParams.get('staffId')
    const onlineOnly = searchParams.get('onlineOnly') === 'true'
    const includeInactive = searchParams.get('includeInactive') === 'true'

    if (!businessId) {
      return NextResponse.json(
        { error: 'businessId is required' },
        { status: 400 }
      )
    }

    // Build where clause
    const where: Record<string, unknown> = {
      businessId,
      deletedAt: null,
    }

    if (!includeInactive) {
      where.isActive = true
    }

    if (categoryId) {
      where.categoryId = categoryId
    }

    if (onlineOnly) {
      where.isOnlineBooking = true
    }

    if (staffId) {
      where.staffServices = {
        some: {
          staffId,
          isActive: true,
        },
      }
    }

    const services = await prisma.service.findMany({
      where,
      include: {
        category: {
          select: {
            id: true,
            name: true,
            color: true,
            icon: true,
          },
        },
        staffServices: {
          where: { isActive: true },
          include: {
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
      orderBy: [
        { category: { sortOrder: 'asc' } },
        { sortOrder: 'asc' },
        { name: 'asc' },
      ],
    })

    // Transform response
    const transformedServices = services.map(service => ({
      id: service.id,
      name: service.name,
      description: service.description,
      durationMinutes: service.durationMinutes,
      price: service.price,
      priceType: service.priceType,
      maxPrice: service.maxPrice,
      color: service.color,
      imageUrl: service.imageUrl,
      isOnlineBooking: service.isOnlineBooking,
      category: service.category,
      staff: service.staffServices.map(ss => ({
        id: ss.staff.id,
        name: `${ss.staff.user.firstName} ${ss.staff.user.lastName}`,
        avatarUrl: ss.staff.user.avatarUrl,
        customDuration: ss.customDuration,
        customPrice: ss.customPrice,
      })),
      staffCount: service.staffServices.length,
    }))

    // Group by category if requested
    const grouped = searchParams.get('grouped') === 'true'
    
    if (grouped) {
      const groupedServices: Record<string, typeof transformedServices> = {}
      
      for (const service of transformedServices) {
        const categoryName = service.category?.name || 'Uncategorized'
        if (!groupedServices[categoryName]) {
          groupedServices[categoryName] = []
        }
        groupedServices[categoryName].push(service)
      }

      return NextResponse.json({
        grouped: true,
        categories: Object.entries(groupedServices).map(([name, services]) => ({
          name,
          services,
          count: services.length,
        })),
        total: transformedServices.length,
      })
    }

    return NextResponse.json({
      services: transformedServices,
      total: transformedServices.length,
    })
  } catch (error) {
    console.error('GET /api/services error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch services' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/services
 * Create a new service
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      businessId,
      categoryId,
      name,
      description,
      durationMinutes,
      price,
      priceType = 'fixed',
      maxPrice,
      depositAmount,
      depositType = 'fixed',
      taxRate,
      isTaxable = true,
      color,
      imageUrl,
      isOnlineBooking = true,
      bufferBeforeMinutes = 0,
      bufferAfterMinutes = 0,
      staffIds = [],
    } = body

    // Validation
    if (!businessId || !name || !durationMinutes || price === undefined) {
      return NextResponse.json(
        { error: 'businessId, name, durationMinutes, and price are required' },
        { status: 400 }
      )
    }

    const service = await prisma.$transaction(async (tx) => {
      // Create the service
      const newService = await tx.service.create({
        data: {
          businessId,
          categoryId,
          name,
          description,
          durationMinutes,
          price,
          priceType,
          maxPrice,
          depositAmount,
          depositType,
          taxRate,
          isTaxable,
          color,
          imageUrl,
          isOnlineBooking,
          bufferBeforeMinutes,
          bufferAfterMinutes,
        },
      })

      // Assign staff to the service
      if (staffIds.length > 0) {
        await tx.staffService.createMany({
          data: staffIds.map((staffId: string) => ({
            staffId,
            serviceId: newService.id,
            isActive: true,
          })),
        })
      }

      return newService
    })

    // Fetch with relations
    const fullService = await prisma.service.findUnique({
      where: { id: service.id },
      include: {
        category: true,
        staffServices: {
          include: {
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

    return NextResponse.json(fullService, { status: 201 })
  } catch (error) {
    console.error('POST /api/services error:', error)
    return NextResponse.json(
      { error: 'Failed to create service' },
      { status: 500 }
    )
  }
}
