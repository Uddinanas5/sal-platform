import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import Stripe from "stripe"
import { prisma } from "@/lib/prisma"
import { stripe } from "@/lib/stripe"

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

function toCents(amount: unknown): number {
  return Math.round(Number(amount || 0) * 100)
}

export async function POST(request: NextRequest) {
  try {
    if (!webhookSecret) {
      return NextResponse.json(
        { error: "Stripe webhook is not configured" },
        { status: 500 }
      )
    }

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

        break
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent

        const succeededPayment = await prisma.payment.findFirst({
          where: { processorId: paymentIntent.id },
          include: { appointment: true },
        })

        if (succeededPayment) {
          const expectedAmount = toCents(succeededPayment.totalAmount)
          const receivedAmount = paymentIntent.amount_received || paymentIntent.amount
          const currencyMatches = paymentIntent.currency.toUpperCase() === succeededPayment.currency.toUpperCase()

          if (receivedAmount < expectedAmount || !currencyMatches) {
            await prisma.payment.update({
              where: { id: succeededPayment.id },
              data: {
                status: "failed",
                processorResponse: {
                  reason: "amount_or_currency_mismatch",
                  expectedAmount,
                  receivedAmount,
                  expectedCurrency: succeededPayment.currency,
                  receivedCurrency: paymentIntent.currency,
                },
              },
            })
            break
          }

          await prisma.$transaction(async (tx) => {
            await tx.payment.update({
              where: { id: succeededPayment.id },
              data: {
                status: "completed",
                processedAt: new Date(),
                processorResponse: paymentIntent as unknown as object,
              },
            })

            if (succeededPayment.appointmentId) {
              await tx.appointment.update({
                where: {
                  id: succeededPayment.appointmentId,
                  businessId: succeededPayment.businessId,
                },
                data: { status: "confirmed" },
              })
            }
          })
        }

        break
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        console.error(`Payment failed: ${paymentIntent.last_payment_error?.message}`)

        // Update the Payment record to "failed"
        const failedPayment = await prisma.payment.findFirst({
          where: { processorId: paymentIntent.id },
        })

        if (failedPayment) {
          await prisma.payment.update({
            where: { id: failedPayment.id },
            data: { status: "failed" },
          })
        }

        break
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge

        // Look up the payment by the payment intent ID from the charge
        const paymentIntentId =
          typeof charge.payment_intent === "string"
            ? charge.payment_intent
            : charge.payment_intent?.id

        if (paymentIntentId) {
          const refundedPayment = await prisma.payment.findFirst({
            where: { processorId: paymentIntentId },
          })

          if (refundedPayment) {
            const totalRefunded = (charge.amount_refunded ?? 0) / 100
            const isFullRefund = charge.refunded

            await prisma.payment.update({
              where: { id: refundedPayment.id },
              data: {
                status: isFullRefund ? "refunded" : refundedPayment.status,
                refundedAmount: totalRefunded,
                refundedAt: new Date(),
              },
            })
          }
        }

        break
      }

      default:
        // Unhandled event type — no action needed
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
