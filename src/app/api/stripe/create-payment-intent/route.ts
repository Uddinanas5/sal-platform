import { NextRequest, NextResponse } from 'next/server'
import { createPaymentIntent, getOrCreateCustomer } from '@/lib/stripe'
import { getRouteBusinessContext } from '@/lib/api/route-auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createPaymentIntentSchema = z.object({
  // A client-supplied amount is NEVER trusted — the charge amount is derived
  // server-side from the appointment's totalAmount, so appointmentId is required.
  // (Accepted-but-ignored for backward compat with existing callers.)
  amount: z.number().positive().optional(),
  email: z.string().email().optional(),
  name: z.string().optional(),
  phone: z.string().optional(),
  appointmentId: z.string().uuid(),
  items: z.unknown().optional(),
})

function generatePaymentReference() {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `PAY-${timestamp}-${random}`.toUpperCase()
}

export async function POST(request: NextRequest) {
  try {
    // L-048: this mints a real card charge, so the raw JWT is not enough — the
    // caller must be a LIVE member (fresh role + session watermark), same as
    // every server action behind getBusinessContext.
    const user = await getRouteBusinessContext()
    if (!user) {
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
    // Amount is always recomputed from the appointment below — the request value
    // (if any) is ignored so a caller can never charge an arbitrary amount.
    let amount = 0
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

    // Already-paid guard — mirrors the three in-person checkout paths
    // (actions/checkout, v1/checkout, mcp/checkout). The hourly idempotency key
    // only dedupes retries WITHIN the same hour; without this, a second call in a
    // later hour mints a fresh PaymentIntent and charges the client's card again.
    // A COMPLETED payment means the appointment is settled — never re-charge it.
    const alreadyPaid = await prisma.payment.findFirst({
      where: { appointmentId, businessId: user.businessId, type: 'payment', status: 'completed' },
      select: { id: true },
    })
    if (alreadyPaid) {
      return NextResponse.json(
        { error: 'This appointment has already been paid.' },
        { status: 400 }
      )
    }

    amount = Number(appointment.totalAmount)
    clientId = appointment.clientId

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
          userId: user.userId,
          businessId: user.businessId,
        },
      })
      if (customerResult.success) {
        customerId = customerResult.customerId
      }
    }

    // Create payment intent. Idempotency key is per-appointment, hourly-bucketed
    // (mirrors the subscription-checkout key scheme): a double-submit/retry for
    // the same appointment within the hour returns the SAME PaymentIntent rather
    // than charging the client's card twice. Amount is already server-derived
    // from appointment.totalAmount, so the appointment is the natural charge unit.
    const hourBucket = Math.floor(Date.now() / 3_600_000)
    const result = await createPaymentIntent({
      amount: Math.round(amount * 100), // Convert to cents
      customerId,
      connectedAccountId: business.stripeAccountId,
      idempotencyKey: `pi-${appointmentId}-${hourBucket}`,
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
        processedBy: user.userId,
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
