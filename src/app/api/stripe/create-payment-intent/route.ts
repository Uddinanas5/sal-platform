import { NextRequest, NextResponse } from 'next/server'
import { createPaymentIntent, getOrCreateCustomer } from '@/lib/stripe'
import { auth } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    
    const body = await request.json()
    const { amount, email, name, phone, appointmentId, items } = body

    if (!amount || amount < 50) {
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
          userId: session?.user?.id || 'guest',
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
      metadata: {
        appointmentId: appointmentId || '',
        items: items ? JSON.stringify(items) : '',
        businessId: (session?.user as { businessId?: string })?.businessId || '',
      },
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }

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
