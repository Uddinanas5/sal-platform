import { NextRequest, NextResponse } from 'next/server'
import { createPaymentIntent, getOrCreateCustomer } from '@/lib/stripe'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createPaymentIntentSchema = z.object({
  amount: z.number().positive(),
  email: z.string().email().optional(),
  name: z.string().optional(),
  phone: z.string().optional(),
  appointmentId: z.string().uuid().optional(),
  items: z.unknown().optional(),
})

function generatePaymentReference() {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `PAY-${timestamp}-${random}`.toUpperCase()
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    const user = session?.user as { id?: string; businessId?: string } | undefined
    if (!user?.id || !user.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const body = await request.json()
    const parsed = createPaymentIntentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid payment request' },
        { status: 400 }
      )
    }

    const { email, name, phone, appointmentId, items } = parsed.data
    let amount = parsed.data.amount
    let clientId: string | null = null

    const business = await prisma.business.findFirst({
      where: { id: user.businessId, deletedAt: null },
      select: {
        stripeAccountId: true,
        stripeAccountStatus: true,
      },
    })

    if (!business?.stripeAccountId || business.stripeAccountStatus !== 'active') {
      return NextResponse.json(
        { error: 'Online payments are not enabled for this business yet. Activate SAL Payments in Settings first.' },
        { status: 400 }
      )
    }

    if (appointmentId) {
      const appointment = await prisma.appointment.findFirst({
        where: { id: appointmentId, businessId: user.businessId },
        select: {
          id: true,
          clientId: true,
          totalAmount: true,
        },
      })

      if (!appointment) {
        return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
      }

      amount = Number(appointment.totalAmount)
      clientId = appointment.clientId
    }

    if (!amount || amount < 0.5) {
      return NextResponse.json(
        { error: 'Invalid amount (minimum $0.50)' },
        { status: 400 }
      )
    }

    // Create or get customer if email provided
    let customerId: string | undefined
    if (email) {
      const customerResult = await getOrCreateCustomer({
        email,
        name,
        phone,
        metadata: {
          source: 'sal-platform',
          userId: user.id,
          businessId: user.businessId,
        },
      })
      if (customerResult.success) {
        customerId = customerResult.customerId
      }
    }

    // Create payment intent
    const result = await createPaymentIntent({
      amount: Math.round(amount * 100), // Convert to cents
      customerId,
      connectedAccountId: business.stripeAccountId,
      metadata: {
        appointmentId: appointmentId || '',
        items: items ? JSON.stringify(items) : '',
        businessId: user.businessId,
        connectedAccountId: business.stripeAccountId,
      },
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }

    await prisma.payment.create({
      data: {
        businessId: user.businessId,
        appointmentId: appointmentId || null,
        clientId,
        paymentReference: generatePaymentReference(),
        type: 'payment',
        method: 'online',
        status: 'pending',
        amount,
        tipAmount: 0,
        totalAmount: amount,
        currency: 'USD',
        processor: 'stripe',
        processorId: result.paymentIntentId,
        processedBy: user.id,
      },
    })

    return NextResponse.json({
      clientSecret: result.clientSecret,
      paymentIntentId: result.paymentIntentId,
    })
  } catch (error) {
    console.error('Payment intent creation error:', error)
    return NextResponse.json(
      { error: 'Failed to create payment intent' },
      { status: 500 }
    )
  }
}
