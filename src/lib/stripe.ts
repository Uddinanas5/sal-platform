import Stripe from 'stripe'

// Server-side Stripe instance
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-01-27.acacia',
  typescript: true,
})

// Create a payment intent for checkout
export async function createPaymentIntent({
  amount,
  currency = 'usd',
  customerId,
  metadata,
}: {
  amount: number // in cents
  currency?: string
  customerId?: string
  metadata?: Record<string, string>
}) {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      customer: customerId,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: metadata || {},
    })

    return {
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    }
  } catch (error) {
    console.error('Stripe createPaymentIntent error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Payment initialization failed',
    }
  }
}

// Create or retrieve a Stripe customer
export async function getOrCreateCustomer({
  email,
  name,
  phone,
  metadata,
}: {
  email: string
  name?: string
  phone?: string
  metadata?: Record<string, string>
}) {
  try {
    // Check if customer exists
    const existingCustomers = await stripe.customers.list({
      email,
      limit: 1,
    })

    if (existingCustomers.data.length > 0) {
      return {
        success: true,
        customerId: existingCustomers.data[0].id,
        isNew: false,
      }
    }

    // Create new customer
    const customer = await stripe.customers.create({
      email,
      name,
      phone,
      metadata: metadata || {},
    })

    return {
      success: true,
      customerId: customer.id,
      isNew: true,
    }
  } catch (error) {
    console.error('Stripe customer error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Customer creation failed',
    }
  }
}

// Save card on file for future use
export async function saveCardOnFile({
  customerId,
  paymentMethodId,
}: {
  customerId: string
  paymentMethodId: string
}) {
  try {
    // Attach payment method to customer
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    })

    // Set as default payment method
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    })

    return { success: true }
  } catch (error) {
    console.error('Stripe saveCardOnFile error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save card',
    }
  }
}

// Charge a saved card (for no-shows, deposits, etc.)
export async function chargeCard({
  customerId,
  amount,
  currency = 'usd',
  description,
  metadata,
}: {
  customerId: string
  amount: number // in cents
  currency?: string
  description?: string
  metadata?: Record<string, string>
}) {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      customer: customerId,
      off_session: true,
      confirm: true,
      description,
      metadata: metadata || {},
    })

    return {
      success: true,
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
    }
  } catch (error) {
    console.error('Stripe chargeCard error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Card charge failed',
    }
  }
}

// Create a refund
export async function createRefund({
  paymentIntentId,
  amount,
  reason,
}: {
  paymentIntentId: string
  amount?: number // in cents, partial refund if provided
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer'
}) {
  try {
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount,
      reason,
    })

    return {
      success: true,
      refundId: refund.id,
      status: refund.status,
    }
  } catch (error) {
    console.error('Stripe refund error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Refund failed',
    }
  }
}

// Verify webhook signature
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string,
  webhookSecret: string
): Stripe.Event | null {
  try {
    return stripe.webhooks.constructEvent(payload, signature, webhookSecret)
  } catch (error) {
    console.error('Stripe webhook verification failed:', error)
    return null
  }
}
