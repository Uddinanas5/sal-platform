import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { AppointmentStatus } from '@/generated/prisma'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/bookings/[id]
 * Get a single appointment by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            notes: true,
          },
        },
        location: {
          select: {
            id: true,
            name: true,
            addressLine1: true,
            city: true,
            phone: true,
          },
        },
        business: {
          select: {
            id: true,
            name: true,
            timezone: true,
            currency: true,
          },
        },
        services: {
          include: {
            service: {
              select: {
                id: true,
                name: true,
                description: true,
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
          orderBy: { sortOrder: 'asc' },
        },
        payments: {
          select: {
            id: true,
            type: true,
            method: true,
            status: true,
            amount: true,
            tipAmount: true,
            createdAt: true,
          },
        },
      },
    })

    if (!appointment) {
      return NextResponse.json(
        { error: 'Appointment not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(appointment)
  } catch (error) {
    console.error('GET /api/bookings/[id] error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch appointment' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/bookings/[id]
 * Update or cancel an appointment
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    const {
      status,
      notes,
      internalNotes,
      cancellationReason,
      cancelledBy,
    } = body

    // Check if appointment exists
    const existing = await prisma.appointment.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        clientId: true,
        totalAmount: true,
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Appointment not found' },
        { status: 404 }
      )
    }

    // Build update data
    const updateData: Record<string, unknown> = {}

    if (notes !== undefined) {
      updateData.notes = notes
    }

    if (internalNotes !== undefined) {
      updateData.internalNotes = internalNotes
    }

    // Handle status changes
    if (status && status !== existing.status) {
      const validTransitions = getValidStatusTransitions(existing.status as AppointmentStatus)
      
      if (!validTransitions.includes(status)) {
        return NextResponse.json(
          { error: `Cannot transition from ${existing.status} to ${status}` },
          { status: 400 }
        )
      }

      updateData.status = status

      // Handle specific status changes
      switch (status) {
        case 'confirmed':
          updateData.confirmationSentAt = new Date()
          break

        case 'cancelled':
          updateData.cancelledAt = new Date()
          updateData.cancellationReason = cancellationReason || null
          updateData.cancelledBy = cancelledBy || null
          break

        case 'no_show':
          updateData.noShowAt = new Date()
          break

        case 'checked_in':
          updateData.checkedInAt = new Date()
          break

        case 'completed':
          updateData.completedAt = new Date()
          // Update client stats
          if (existing.clientId) {
            await prisma.client.update({
              where: { id: existing.clientId },
              data: {
                totalSpent: { increment: Number(existing.totalAmount) },
              },
            })
          }
          break
      }
    }

    const appointment = await prisma.appointment.update({
      where: { id },
      data: updateData,
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
        services: {
          include: {
            service: {
              select: {
                id: true,
                name: true,
              },
            },
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

    return NextResponse.json(appointment)
  } catch (error) {
    console.error('PATCH /api/bookings/[id] error:', error)
    return NextResponse.json(
      { error: 'Failed to update appointment' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/bookings/[id]
 * Soft delete (cancel) an appointment
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const searchParams = request.nextUrl.searchParams
    const reason = searchParams.get('reason')
    const cancelledBy = searchParams.get('cancelledBy')

    const existing = await prisma.appointment.findUnique({
      where: { id },
      select: { id: true, status: true },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Appointment not found' },
        { status: 404 }
      )
    }

    // Can't cancel already cancelled or completed appointments
    if (['cancelled', 'completed'].includes(existing.status)) {
      return NextResponse.json(
        { error: `Cannot cancel appointment with status ${existing.status}` },
        { status: 400 }
      )
    }

    const appointment = await prisma.appointment.update({
      where: { id },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancellationReason: reason,
        cancelledBy,
      },
    })

    return NextResponse.json({
      message: 'Appointment cancelled successfully',
      appointment,
    })
  } catch (error) {
    console.error('DELETE /api/bookings/[id] error:', error)
    return NextResponse.json(
      { error: 'Failed to cancel appointment' },
      { status: 500 }
    )
  }
}

/**
 * Get valid status transitions for an appointment
 */
function getValidStatusTransitions(currentStatus: AppointmentStatus): AppointmentStatus[] {
  const transitions: Record<AppointmentStatus, AppointmentStatus[]> = {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['checked_in', 'cancelled', 'no_show'],
    checked_in: ['in_progress', 'cancelled'],
    in_progress: ['completed', 'cancelled'],
    completed: [],
    cancelled: [],
    no_show: [],
  }

  return transitions[currentStatus] || []
}
