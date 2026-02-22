import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import Stripe from "stripe"
import { prisma } from "@/lib/prisma"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-12-18.acacia",
})

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const headersList = await headers()
    const signature = headersList.get("stripe-signature")

    if (!signature) {
      return NextResponse.json(
        { error: "Missing signature" },
        { status: 400 }
      )
    }

    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err) {
      console.error("Webhook signature verification failed:", err)
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 400 }
      )
    }

    // Handle the event
    switch (event.type) {
      case "account.updated": {
        const account = event.data.object as Stripe.Account
        
        // Determine status
        let status = "pending"
        if (account.charges_enabled && account.payouts_enabled) {
          status = "active"
        } else if (account.requirements?.disabled_reason) {
          status = "restricted"
        }

        // Update business with new status
        await prisma.business.updateMany({
          where: { stripeAccountId: account.id },
          data: {
            stripeAccountStatus: status,
            ...(status === "active" ? { stripeOnboardedAt: new Date() } : {}),
          },
        })

        console.log(`Stripe account ${account.id} updated to status: ${status}`)
        break
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        console.log(`PaymentIntent ${paymentIntent.id} succeeded`)
        
        // You could update appointment/transaction status here
        // based on paymentIntent.metadata.appointmentId etc.
        break
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        console.log(`PaymentIntent ${paymentIntent.id} failed:`, paymentIntent.last_payment_error?.message)
        break
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge
        console.log(`Charge ${charge.id} refunded`)
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("Webhook error:", error)
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    )
  }
}

// Disable body parsing - Stripe needs the raw body
export const config = {
  api: {
    bodyParser: false,
  },
}
