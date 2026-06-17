import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import Stripe from "stripe"
import { prisma } from "@/lib/prisma"
import { stripe } from "@/lib/stripe"
import { applyDisputeEvent } from "@/lib/billing/disputes"
// Shared Stripe→SAL subscription status mapping — lives in the reconcile
// module so the webhook and the daily reconciler can never disagree.
import { mapStripeStatus } from "@/lib/billing/reconcile"

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

// Convert Stripe's event.created (UNIX seconds) into a Date. Used both as the
// staleness watermark we persist and as the cutoff that gates out-of-order
// downgrades.
function eventCreatedDate(event: Stripe.Event): Date {
  return new Date(event.created * 1000)
}

// Staleness guard for ABSOLUTE-STATE billing writes (the downgrade paths).
//
// A business's subscriptionStatus is driven entirely by these webhooks, and
// Stripe makes no ordering guarantee. The dangerous case: a card retry succeeds,
// the recovery (invoice.payment_succeeded / subscription.updated→active) lands
// and flips the salon back to `active`, and THEN a stale invoice.payment_failed
// for the now-paid invoice is delivered late — re-setting `past_due` on a salon
// that is fully current (false "update your card" banner).
//
// We persist `lastBillingEventAt` = the event.created of the freshest billing
// event we have applied. A downgrade is only allowed to write when THIS event is
// at least as new as that watermark — i.e. the stored watermark is null (nothing
// applied yet) OR < this event's created. Expressed as a Prisma OR so it folds
// into the existing where (keeping the whole mutation a single atomic
// updateMany). The watermark itself is bumped to max(current, event.created) as
// part of the same write (see billingWatermarkData), so a later, genuinely fresh
// event still wins.
function freshnessWhere(eventCreated: Date): {
  OR: [{ lastBillingEventAt: null }, { lastBillingEventAt: { lt: Date } }]
} {
  return {
    OR: [
      { lastBillingEventAt: null },
      { lastBillingEventAt: { lt: eventCreated } },
    ],
  }
}

// Bump the per-business watermark to this event's created time. We never move it
// backwards: the where on these writes already requires lastBillingEventAt to be
// null or < eventCreated, so writing eventCreated is always max(current, event).
function billingWatermarkData(eventCreated: Date): { lastBillingEventAt: Date } {
  return { lastBillingEventAt: eventCreated }
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
      // DISPUTES (chargebacks) — Phase 2B. A client disputed a card payment
      // made to a salon. Merchant-liability policy: the SHOP bears a lost
      // chargeback (industry standard); SAL records, notifies, and helps
      // respond. All state logic lives in src/lib/billing/disputes.ts —
      // per-row lastEventAt watermark + create-with-P2002-swallow makes it
      // safe under replay AND reordering (closed-before-created).
      // ───────────────────────────────────────────────────────────────────
      case "charge.dispute.created":
      case "charge.dispute.updated":
      case "charge.dispute.closed": {
        await applyDisputeEvent(event)
        break
      }

      // Balance-movement notifications within the dispute lifecycle. The money
      // state is already fully tracked by created/updated/closed (dispute row +
      // payment status); acting on these too would double-count the same funds.
      // Deliberate, LOGGED no-ops.
      case "charge.dispute.funds_withdrawn":
      case "charge.dispute.funds_reinstated": {
        const fundsDispute = event.data.object as Stripe.Dispute
        console.warn(
          `[stripe.webhook] ${event.type} dispute=${fundsDispute.id} amount=${fundsDispute.amount} — ` +
            `logged no-op (dispute state is tracked via created/updated/closed; acting here would double-count).`
        )
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

        // Freshness guard: activation is an absolute-state write just like the
        // updated/deleted handlers, so a stale/out-of-order checkout.completed
        // must not resurrect a later cancellation. Only apply if this event is
        // newer than the last billing event we processed, and bump the watermark.
        const completedEventCreated = eventCreatedDate(event)
        const completed = await prisma.business.updateMany({
          where: { id: businessId, ...freshnessWhere(completedEventCreated) },
          data: {
            subscriptionStatus: "active",
            subscriptionTier: "pro",
            ...(subscriptionId ? { stripeSubscriptionId: subscriptionId } : {}),
            ...(customerId ? { stripeCustomerId: customerId } : {}),
            ...billingWatermarkData(completedEventCreated),
          },
        })
        if (completed.count === 0) {
          // 0 rows means either the business is missing OR a newer billing event
          // already superseded this one. Distinguish so we only alarm on a true
          // charged-but-not-activated incident.
          const exists = await prisma.business.findUnique({
            where: { id: businessId },
            select: { lastBillingEventAt: true },
          })
          if (!exists) {
            console.error(
              `[stripe.webhook] checkout.session.completed matched 0 businesses — businessId=${businessId} session=${session.id} subscription=${subscriptionId}. Charged but NOT activated — manual review needed.`
            )
          } else {
            console.warn(
              `[stripe.webhook] checkout.session.completed superseded by a newer billing event — businessId=${businessId} session=${session.id}. No-op (stale).`
            )
          }
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

        const createdEventCreated = eventCreatedDate(event)
        const created = await prisma.business.updateMany({
          where: { ...where, ...freshnessWhere(createdEventCreated) },
          data: {
            subscriptionStatus: mapped,
            stripeSubscriptionId: subscription.id,
            ...(customerId ? { stripeCustomerId: customerId } : {}),
            ...billingWatermarkData(createdEventCreated),
          },
        })
        if (created.count === 0) {
          console.warn(
            `[stripe.webhook] customer.subscription.created matched 0 businesses — subscription=${subscription.id} customer=${customerId} metadata.businessId=${subscription.metadata?.businessId}. Unresolvable, or superseded by a newer billing event.`
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
        //
        // This sets an ABSOLUTE state, so it carries the freshness guard: a stale
        // subscription.updated (older event.created than the last billing event we
        // applied) must not clobber a fresher state. The watermark is bumped to
        // this event's created time in the same atomic write.
        const eventCreated = eventCreatedDate(event)
        const updated = await prisma.business.updateMany({
          where: { ...where, ...freshnessWhere(eventCreated) },
          data: {
            subscriptionStatus: mapped,
            stripeSubscriptionId: subscription.id,
            ...billingWatermarkData(eventCreated),
          },
        })
        // Loud: a 0-match here means EITHER an out-of-order/dropped event we could
        // not attribute to any business (e.g. a cancellation that would otherwise
        // be silently swallowed) OR a stale event the freshness guard correctly
        // rejected. The latter is expected/benign; surface for manual review.
        if (updated.count === 0) {
          console.error(
            `[stripe.webhook] customer.subscription.updated matched 0 businesses — subscription=${subscription.id} customer=${customerId} metadata.businessId=${subscription.metadata?.businessId} status=${mapped}. Out-of-order/dropped event or stale (freshness guard)?`
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
        //
        // Carries the freshness guard + watermark bump: a stale deletion older
        // than an already-applied event must not clobber a fresher state. (A real
        // cancellation is terminal and always the latest billing event, so this
        // never rejects a genuine cancellation.)
        const eventCreated = eventCreatedDate(event)
        const deleted = await prisma.business.updateMany({
          where: { ...where, ...freshnessWhere(eventCreated) },
          data: {
            subscriptionStatus: "cancelled",
            ...billingWatermarkData(eventCreated),
          },
        })
        if (deleted.count === 0) {
          console.error(
            `[stripe.webhook] customer.subscription.deleted matched 0 businesses — subscription=${subscription.id} customer=${customerId} metadata.businessId=${subscription.metadata?.businessId}. Out-of-order/dropped event or stale (freshness guard)?`
          )
        }

        break
      }

      // Successful recurring charge — INCLUDING a card retry that recovers a
      // past_due subscription. Stripe fires `invoice.payment_succeeded` (and
      // `invoice.paid`) on every successful invoice. We can't rely on a later
      // customer.subscription.updated(active) to lift past_due, because Stripe
      // may deliver these out of order (or not re-send .updated at all). So this
      // is the DETERMINISTIC recovery path: clear past_due → active.
      case "invoice.payment_succeeded":
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice

        const customerId =
          typeof invoice.customer === "string"
            ? invoice.customer
            : invoice.customer?.id ?? null

        // Durable resolution, mirroring the subscription handlers: prefer the
        // businessId stamped on the subscription's metadata (rides on every
        // invoice via subscription_details), else fall back to the customer id.
        const metaBusinessId =
          (invoice as { subscription_details?: { metadata?: { businessId?: string } } })
            .subscription_details?.metadata?.businessId ?? null

        if (!metaBusinessId && !customerId) {
          console.error(
            `[stripe.webhook] ${event.type} without businessId or customer — invoice=${invoice.id}`
          )
          break
        }

        const eventCreated = eventCreatedDate(event)

        // Base where: resolve the LIVE subscription owner. metadata.businessId is
        // the durable key; otherwise the customer with a non-null sub id.
        const recoverWhere = metaBusinessId
          ? { id: metaBusinessId }
          : { stripeCustomerId: customerId as string, NOT: { stripeSubscriptionId: null } }

        // Recovery flip: lift past_due → active, but ONLY when currently
        // `past_due`. This deliberately does NOT touch a `cancelled` or `paused`
        // salon (a stray successful invoice must not resurrect a cancelled salon,
        // and a paused sub stays paused). Guarded by freshness + bumps watermark.
        const recovered = await prisma.business.updateMany({
          where: {
            ...recoverWhere,
            subscriptionStatus: "past_due",
            ...freshnessWhere(eventCreated),
          },
          data: {
            subscriptionStatus: "active",
            ...billingWatermarkData(eventCreated),
          },
        })

        // If we didn't flip (already active, cancelled, paused, or stale), still
        // advance the watermark for an active live subscription so a LATER stale
        // payment_failed can't re-flip it. We only bump when currently `active`
        // (don't clobber cancelled/paused, and don't bump on a stale event).
        if (recovered.count === 0) {
          await prisma.business.updateMany({
            where: {
              ...recoverWhere,
              subscriptionStatus: "active",
              ...freshnessWhere(eventCreated),
            },
            data: billingWatermarkData(eventCreated),
          })
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
        //
        // Freshness guard: this is a DOWNGRADE. If a card retry already succeeded
        // and we applied a fresher recovery event (invoice.payment_succeeded /
        // subscription.updated→active), a stale payment_failed delivered late
        // would otherwise re-flip the now-current salon back to past_due. The
        // `lastBillingEventAt` cutoff (null OR < this event's created) blocks that
        // out-of-order overwrite; the watermark is bumped in the same write.
        const eventCreated = eventCreatedDate(event)
        const invoiceFailed = await prisma.business.updateMany({
          where: {
            stripeCustomerId: customerId,
            NOT: { stripeSubscriptionId: null },
            ...freshnessWhere(eventCreated),
          },
          data: {
            subscriptionStatus: "past_due",
            ...billingWatermarkData(eventCreated),
          },
        })
        if (invoiceFailed.count === 0) {
          console.error(
            `[stripe.webhook] invoice.payment_failed matched 0 live subscriptions — customer=${customerId} invoice=${invoice.id} (no live subscription, or a stale event the freshness guard rejected). Stray/late/out-of-order invoice?`
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
