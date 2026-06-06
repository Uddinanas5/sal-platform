import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import Stripe from "stripe"
import { prisma } from "@/lib/prisma"
import { stripe } from "@/lib/stripe"

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

function toCents(amount: unknown): number {
  return Math.round(Number(amount || 0) * 100)
}

// Duck-typed Prisma unique-violation check (matches src/lib/api/prisma-errors.ts):
// reads `error.code` without importing the runtime error class, so it works for
// both real Prisma errors and mocked errors in tests.
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: unknown }).code === "P2002"
  )
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

    // Idempotency gate — Stripe retries webhooks and may deliver the same event
    // more than once. We record the event id (PK) FIRST, before any side effect.
    // If the row already exists the insert fails with a unique violation (P2002)
    // and we short-circuit with 200 so Stripe stops retrying, without re-running
    // any payment/refund/account mutation. See StripeEvent model (idempotency ledger).
    try {
      await prisma.stripeEvent.create({
        data: { id: event.id, type: event.type },
      })
    } catch (err) {
      if (isUniqueViolation(err)) {
        return NextResponse.json(
          { received: true, duplicate: true, message: "[duplicate event]" },
          { status: 200 }
        )
      }
      // Any other failure recording the event is a real error — surface it so
      // Stripe retries rather than silently processing without an idempotency record.
      throw err
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
            // Loud: a charge that Stripe reports succeeded but with the wrong
            // amount/currency is marked failed here — without a log this would
            // be invisible. Surfaces in Vercel logs / Sentry for manual review.
            console.error(
              `[stripe.webhook] payment_intent.succeeded amount/currency MISMATCH — marking payment FAILED. ` +
                `payment=${succeededPayment.id} pi=${paymentIntent.id} ` +
                `expected=${expectedAmount} ${succeededPayment.currency} received=${receivedAmount} ${paymentIntent.currency}. Manual review needed.`
            )
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
        } else {
          // Stripe says a payment succeeded but we have no matching Payment row.
          // Could be a replayed/foreign event or a dropped write — log for review.
          console.error(
            `[stripe.webhook] payment_intent.succeeded for unknown payment processorId=${paymentIntent.id} — no matching Payment row.`
          )
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
