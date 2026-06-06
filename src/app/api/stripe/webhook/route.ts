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

// Map a Stripe subscription status onto SAL's SubscriptionStatus enum values
// (exactly: active | trialing | past_due | cancelled | paused). We treat a
// trial as full access (active), and every failure/incomplete state as past_due
// so the dashboard shows the non-blocking "update your card" banner rather than
// hard-locking the salon. Stripe's `paused` (pause_collection) is a TEMPORARY
// hold — the subscription still exists and is expected to resume — so it maps to
// our own `paused` value (non-blocking banner), NEVER to `cancelled`. Only a true
// Stripe `canceled` is terminal and triggers the hard gate.
function mapStripeStatus(
  status: Stripe.Subscription.Status
): "active" | "past_due" | "cancelled" | "paused" {
  switch (status) {
    case "active":
    case "trialing":
      return "active"
    case "past_due":
    case "unpaid":
    case "incomplete":
    case "incomplete_expired":
      return "past_due"
    case "paused":
      return "paused"
    case "canceled":
      return "cancelled"
    default:
      return "past_due"
  }
}

// Build the Prisma `where` used to resolve the owning business from a Stripe
// subscription event.
//
// Order matters because of webhook out-of-order delivery: Stripe may deliver
// customer.subscription.updated/.deleted BEFORE checkout.session.completed (the
// ONLY place stripeSubscriptionId is written). If we keyed on
// stripeSubscriptionId first it would always match 0 rows in that window — a
// silent no-op that permanently loses a cancelled/past_due event. So we prefer
// the DURABLE identifiers that are set at customer-creation / checkout-creation
// time and are present on every subscription event:
//   1. metadata.businessId — set via subscription_data.metadata.businessId in
//      create-subscription-checkout, so it rides on every subscription event.
//   2. customerId — persisted on the business when the Customer is created.
//   3. stripeSubscriptionId — last resort; only matches once checkout completed.
// Returns null when nothing usable is present so the caller can no-op on an
// unknown/foreign subscription.
function subscriptionResolveWhere(
  subscription: Stripe.Subscription,
  customerId: string | null
):
  | { id: string }
  | { stripeCustomerId: string }
  | { stripeSubscriptionId: string }
  | null {
  const metaBusinessId = subscription.metadata?.businessId
  if (metaBusinessId) return { id: metaBusinessId }
  if (customerId) return { stripeCustomerId: customerId }
  if (subscription.id) return { stripeSubscriptionId: subscription.id }
  return null
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
    // more than once. We RECORD THE EVENT ONLY AFTER the handler succeeds (see
    // the post-switch insert below), accepting at-least-once semantics: every
    // handler here is idempotent (subscription branches set absolute target
    // states keyed by server-trusted Stripe ids; payment/refund branches look up
    // by processorId before mutating), so re-processing is safe.
    //
    // This early read-only check fast-paths a genuine duplicate (an event we
    // ALREADY fully processed) so we don't redo work. Crucially, because the row
    // is written post-success, a row never exists for an event whose handler
    // threw — so a 500 retry safely re-runs the side effect instead of being
    // short-circuited as a "duplicate" and permanently dropped.
    const alreadyProcessed = await prisma.stripeEvent
      .findUnique({ where: { id: event.id } })
      .catch(() => null)
    if (alreadyProcessed) {
      return NextResponse.json(
        { received: true, duplicate: true, message: "[duplicate event]" },
        { status: 200 }
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

      // ───────────────────────────────────────────────────────────────────
      // SAL SUBSCRIPTION BILLING (the salon paying SAL).
      // Webhook-driven state: this route is the single source of truth for a
      // business's subscriptionStatus. Every lookup is keyed by a Stripe id we
      // get from the (already signature-verified) event — metadata.businessId
      // or stripeCustomerId — never by anything the browser could forge.
      // ───────────────────────────────────────────────────────────────────
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session

        // Only our subscription checkout matters here; ignore one-time/payment
        // mode sessions (those belong to other flows, if any).
        if (session.mode !== "subscription") break

        const businessId =
          session.metadata?.businessId ?? session.client_reference_id ?? null
        if (!businessId) {
          console.error(
            `[stripe.webhook] checkout.session.completed without businessId — session=${session.id}`
          )
          break
        }

        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id ?? null
        const customerId =
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id ?? null

        const completed = await prisma.business.updateMany({
          where: { id: businessId },
          data: {
            subscriptionStatus: "active",
            subscriptionTier: "pro",
            ...(subscriptionId ? { stripeSubscriptionId: subscriptionId } : {}),
            ...(customerId ? { stripeCustomerId: customerId } : {}),
          },
        })
        if (completed.count === 0) {
          // The salon PAID but we couldn't flip it to active — loud, because a
          // charged-but-not-active salon is a revenue/access incident.
          console.error(
            `[stripe.webhook] checkout.session.completed matched 0 businesses — businessId=${businessId} session=${session.id} subscription=${subscriptionId}. Charged but NOT activated — manual review needed.`
          )
        }

        break
      }

      case "customer.subscription.created": {
        // Persist the subscription id (and customer id) from the FIRST
        // subscription event so the row is keyed correctly even if
        // checkout.session.completed is delayed or delivered out of order. The
        // business is resolved by durable identifiers (metadata.businessId /
        // customer id) since stripeSubscriptionId is not yet on file.
        const subscription = event.data.object as Stripe.Subscription

        const mapped = mapStripeStatus(subscription.status)

        const customerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer?.id ?? null

        const where = subscriptionResolveWhere(subscription, customerId)
        if (!where) {
          console.error(
            `[stripe.webhook] customer.subscription.created for unresolvable subscription=${subscription.id} — no-op.`
          )
          break
        }

        const created = await prisma.business.updateMany({
          where,
          data: {
            subscriptionStatus: mapped,
            stripeSubscriptionId: subscription.id,
            ...(customerId ? { stripeCustomerId: customerId } : {}),
          },
        })
        if (created.count === 0) {
          console.error(
            `[stripe.webhook] customer.subscription.created matched 0 businesses — subscription=${subscription.id} customer=${customerId} metadata.businessId=${subscription.metadata?.businessId}. Out-of-order/dropped event?`
          )
        }

        break
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription

        // Map Stripe's subscription status onto our SubscriptionStatus enum
        // (active | trialing | past_due | cancelled | paused). We collapse
        // trialing → active (full access during a trial), the failure states
        // (past_due/unpaid/incomplete*) → past_due, and Stripe `paused` → our
        // own `paused` (non-blocking — the subscription still exists).
        const mapped = mapStripeStatus(subscription.status)

        const customerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer?.id ?? null

        // Resolve the business by durable identifiers (metadata.businessId /
        // customer id) first, falling back to the subscription id last — all
        // server-trusted from Stripe. See subscriptionResolveWhere for why the
        // subscription id can't be the primary key during out-of-order delivery.
        const where = subscriptionResolveWhere(subscription, customerId)
        if (!where) {
          console.error(
            `[stripe.webhook] customer.subscription.updated for unresolvable subscription=${subscription.id} — no-op.`
          )
          break
        }

        // Persist the subscription id alongside the status so a later checkout-
        // completed / created event isn't required for the row to be keyed, and
        // so the cancelled hard gate (which needs a non-null id) can fire even if
        // this is the only event we ever see for the subscription.
        const updated = await prisma.business.updateMany({
          where,
          data: {
            subscriptionStatus: mapped,
            stripeSubscriptionId: subscription.id,
          },
        })
        // Loud: a 0-match here means an out-of-order/dropped event we could not
        // attribute to any business (e.g. a cancellation that would otherwise be
        // silently swallowed). Surface it for manual review.
        if (updated.count === 0) {
          console.error(
            `[stripe.webhook] customer.subscription.updated matched 0 businesses — subscription=${subscription.id} customer=${customerId} metadata.businessId=${subscription.metadata?.businessId} status=${mapped}. Out-of-order/dropped event?`
          )
        }

        break
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription

        const customerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer?.id ?? null

        const where = subscriptionResolveWhere(subscription, customerId)
        if (!where) {
          console.error(
            `[stripe.webhook] customer.subscription.deleted for unresolvable subscription=${subscription.id} — no-op.`
          )
          break
        }

        // Cancelled at Stripe → mark cancelled but KEEP stripeSubscriptionId.
        // The hard gate (gate.ts) only fires when status === "cancelled" AND
        // hasSubscription (a non-null stripeSubscriptionId) — i.e. a salon that
        // DID subscribe and then ended. Clearing the id here would set
        // hasSubscription=false and make decideBillingGate return "allow",
        // silently defeating the lockout (free access for a cancelled salon).
        // A fresh checkout (checkout.session.completed) overwrites the stale id,
        // so we don't need to null it to allow re-subscribing. This also matches
        // the self-service path in actions/account.ts (cancelled, id intact).
        const deleted = await prisma.business.updateMany({
          where,
          data: { subscriptionStatus: "cancelled" },
        })
        if (deleted.count === 0) {
          console.error(
            `[stripe.webhook] customer.subscription.deleted matched 0 businesses — subscription=${subscription.id} customer=${customerId} metadata.businessId=${subscription.metadata?.businessId}. Out-of-order/dropped event?`
          )
        }

        break
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice

        const customerId =
          typeof invoice.customer === "string"
            ? invoice.customer
            : invoice.customer?.id ?? null

        if (!customerId) {
          console.error(
            `[stripe.webhook] invoice.payment_failed without customer — invoice=${invoice.id}`
          )
          break
        }

        // Only flip to past_due when the business currently has a LIVE
        // subscription on file. A stray late invoice for an already-cancelled
        // subscription (sub id retained, customer retained) must not resurrect a
        // past_due state on a salon with no live subscription — that would show
        // a contradictory "Past due / Update payment method" UI for a salon that
        // has nothing to update.
        const invoiceFailed = await prisma.business.updateMany({
          where: { stripeCustomerId: customerId, NOT: { stripeSubscriptionId: null } },
          data: { subscriptionStatus: "past_due" },
        })
        if (invoiceFailed.count === 0) {
          console.error(
            `[stripe.webhook] invoice.payment_failed matched 0 live subscriptions — customer=${customerId} invoice=${invoice.id} (no business with a non-null stripeSubscriptionId). Stray/late invoice?`
          )
        }

        break
      }

      default:
        // Unhandled event type — no action needed
    }

    // Record the event as processed ONLY now that the handler has succeeded.
    // (Idempotency, at-least-once.) If the handler above threw, control jumped
    // to the catch below and this insert never ran — so no row exists and a
    // Stripe retry will re-run the side effect rather than being short-circuited
    // as a duplicate. A concurrent/previous successful delivery may have already
    // written the row (P2002) — that's fine, swallow it.
    try {
      await prisma.stripeEvent.create({
        data: { id: event.id, type: event.type },
      })
    } catch (err) {
      if (!isUniqueViolation(err)) throw err
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
