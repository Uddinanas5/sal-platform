import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhookSignature } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import Stripe from 'stripe'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    )
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not configured')
    return NextResponse.json(
      { error: 'Webhook not configured' },
      { status: 500 }
    )
  }

  const event = verifyWebhookSignature(body, signature, webhookSecret)
  if (!event) {
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    )
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        await handlePaymentSuccess(paymentIntent)
        break
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        await handlePaymentFailure(paymentIntent)
        break
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge
        await handleRefund(charge)
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook processing error:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  const { appointmentId, businessId } = paymentIntent.metadata

  if (appointmentId && businessId) {
    // Update payment record
    await prisma.payment.updateMany({
      where: {
        appointmentId,
        businessId,
        status: 'pending',
      },
      data: {
        status: 'completed',
        processor: 'stripe',
        processorId: paymentIntent.id,
        processedAt: new Date(),
      },
    })

    console.log(`Payment succeeded: ${paymentIntent.id} for appointment ${appointmentId}`)
  } else {
    console.log(`Payment succeeded: ${paymentIntent.id} (no appointment linked)`)
  }
}

async function handlePaymentFailure(paymentIntent: Stripe.PaymentIntent) {
  const { appointmentId, businessId } = paymentIntent.metadata

  if (appointmentId && businessId) {
    await prisma.payment.updateMany({
      where: {
        appointmentId,
        businessId,
        status: 'pending',
      },
      data: {
        status: 'failed',
        processor: 'stripe',
        processorId: paymentIntent.id,
      },
    })
  }

  console.log(`Payment failed: ${paymentIntent.id}`)
}

async function handleRefund(charge: Stripe.Charge) {
  const paymentIntentId = typeof charge.payment_intent === 'string' 
    ? charge.payment_intent 
    : charge.payment_intent?.id

  if (paymentIntentId) {
    // Find the original payment record
    const payment = await prisma.payment.findFirst({
      where: { processorId: paymentIntentId },
    })

    if (payment) {
      // Create a refund record
      const count = await prisma.payment.count({ where: { businessId: payment.businessId } })
      const refundRef = `REF-${String(count + 1).padStart(4, '0')}`

      await prisma.payment.create({
        data: {
          businessId: payment.businessId,
          clientId: payment.clientId,
          appointmentId: payment.appointmentId,
          paymentReference: refundRef,
          type: 'refund',
          method: 'card',
          status: 'completed',
          amount: -Number(charge.amount_refunded) / 100,
          totalAmount: -Number(charge.amount_refunded) / 100,
          currency: charge.currency.toUpperCase(),
          processor: 'stripe',
          processorId: charge.id,
          processedAt: new Date(),
        },
      })
    }
  }

  console.log(`Refund processed for charge: ${charge.id}`)
}
