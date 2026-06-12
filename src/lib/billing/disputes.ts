import Stripe from "stripe"
import { prisma } from "@/lib/prisma"
import { sendEmail, getSupportEmail } from "@/lib/email"
import { formatInZone } from "@/lib/scheduling/zoned-time"

// STRIPE DISPUTE (CHARGEBACK) HANDLING — Phase 2B.
//
// Policy (founder-approved Jun 2026, industry-standard merchant liability —
// Fresha/Square/Booksy/Vagaro/GlossGenius/Mindbody/Toast/Shopify all do this):
//   - The SHOP bears a lost chargeback. Recovery v1 = manual transfer reversal
//     by the founder (recipe: docs/INCIDENT_RUNBOOK.md §7). Auto-netting from
//     future payouts is a flagged follow-up, NOT implemented here.
//   - $15 dispute fee: refunded if the shop wins, WAIVED during beta. v1 is
//     RECORD-ONLY (Dispute.feeCents/feeWaived) — nothing auto-charges.
//   - Notify + help respond: red dashboard banner with the evidence deadline
//     (dashboard layout) + founder alert email (ALERT_EMAIL) from here.
//
// Mechanics mirror the existing webhook hardening exactly:
//   - The route-level StripeEvent ledger short-circuits true duplicates.
//   - A per-row lastEventAt watermark (this file) guards OUT-OF-ORDER delivery:
//     only an event strictly newer than the freshest one applied may write.
//   - updateMany-where-lastEventAt-lt, then create-with-P2002-swallow: handles
//     first-event-create, concurrent delivery, and the closed-before-created
//     reordering without ever regressing a fresher state.

// Stripe dispute statuses that mean the dispute is OPEN — money is at risk and
// the shop may still need to act. Drives the red dashboard banner and the
// payment's `disputed` flip. Stored as varchar (Stripe adds/retires statuses;
// an unknown status is recorded verbatim and treated as open/at-risk).
export const OPEN_DISPUTE_STATUSES = [
  "warning_needs_response",
  "warning_under_review",
  "needs_response",
  "under_review",
] as const

// Closed in the shop's favor → the payment is restored to `completed` (ONLY if
// currently `disputed`). `warning_closed` = an inquiry/early-fraud-warning that
// closed without ever becoming a full dispute.
const WON_STATUSES = new Set<string>(["won", "warning_closed"])

// Duck-typed Prisma unique-violation check (matches the webhook route): reads
// `error.code` without importing the runtime error class, so it works for both
// real Prisma errors and mocked errors in tests.
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: unknown }).code === "P2002"
  )
}

export type DisputeEventResult = {
  applied: boolean // false = stale (a fresher event already applied) — no-op
  orphan: boolean // no Payment row matched the dispute's payment_intent
}

/**
 * Apply one charge.dispute.created / .updated / .closed event. Idempotent and
 * order-safe: replays are no-ops (route-level StripeEvent ledger catches exact
 * duplicates; the per-row lastEventAt watermark catches stale out-of-order
 * deliveries). Throws on unexpected DB errors so the route returns 500 and
 * Stripe retries (record-after-success semantics).
 */
export async function applyDisputeEvent(
  event: Stripe.Event
): Promise<DisputeEventResult> {
  const dispute = event.data.object as Stripe.Dispute
  const eventCreated = new Date(event.created * 1000)

  const paymentIntentId =
    typeof dispute.payment_intent === "string"
      ? dispute.payment_intent
      : dispute.payment_intent?.id ?? null
  const chargeId =
    typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id ?? null

  // Resolve the disputed Payment by processorId (= the PaymentIntent id) —
  // the same server-trusted key every other payment webhook uses.
  const payment = paymentIntentId
    ? await prisma.payment.findFirst({
        where: { processorId: paymentIntentId },
        select: { id: true, businessId: true },
      })
    : null

  const orphan = !payment
  if (orphan) {
    // LOUD: an unattributable dispute is still money at risk. Record it with
    // businessId null (never drop it) and surface for manual review.
    console.error(
      `[stripe.webhook] ${event.type} for UNKNOWN payment — dispute=${dispute.id} ` +
        `payment_intent=${paymentIntentId ?? "none"} charge=${chargeId ?? "none"} ` +
        `amount=${dispute.amount} ${dispute.currency} status=${dispute.status}. ` +
        `Recorded with businessId=null — manual review needed.`
    )
  }

  // Absolute state from this event. The dispute id is stored VERBATIM (du_ or
  // legacy dp_ — never validate the prefix); status verbatim too (varchar).
  const state = {
    businessId: payment?.businessId ?? null,
    paymentId: payment?.id ?? null,
    paymentIntentId,
    chargeId,
    amountCents: dispute.amount ?? 0,
    currency: (dispute.currency ?? "usd").toUpperCase(),
    reason: dispute.reason ?? null,
    status: dispute.status as string,
    evidenceDueBy: dispute.evidence_details?.due_by
      ? new Date(dispute.evidence_details.due_by * 1000)
      : null,
    lastEventAt: eventCreated,
  }

  // Freshness-guarded upsert. updateMany folds the watermark check into one
  // atomic write (only rows whose lastEventAt < this event's created match).
  let applied = false
  const updated = await prisma.dispute.updateMany({
    where: { id: dispute.id, lastEventAt: { lt: eventCreated } },
    data: state,
  })
  if (updated.count > 0) {
    applied = true
  } else {
    // 0 rows: either the row doesn't exist yet (first event we see — possibly
    // out of order, e.g. `closed` delivered before `created`), or a fresher
    // event already applied (stale). create() resolves which: success = first
    // event; P2002 = the row exists with lastEventAt >= ours → stale, swallow.
    try {
      await prisma.dispute.create({ data: { id: dispute.id, ...state } })
      applied = true
    } catch (err) {
      if (!isUniqueViolation(err)) throw err
      console.warn(
        `[stripe.webhook] ${event.type} is stale for dispute=${dispute.id} ` +
          `(a fresher dispute event was already applied) — no-op.`
      )
    }
  }

  // Payment status transition — ONLY when this event actually applied (a stale
  // event must never regress the payment) and the payment is known.
  if (applied && payment) {
    if (WON_STATUSES.has(state.status)) {
      // Shop won → restore `completed`, but ONLY if currently `disputed`.
      // Never clobber refunded/failed states owned by other flows.
      await prisma.payment.updateMany({
        where: { id: payment.id, status: "disputed" },
        data: { status: "completed" },
      })
    } else {
      // Open statuses AND a lost closure → `disputed`. A lost dispute STAYS
      // `disputed` (the money left; `refunded` would misreport it as a
      // voluntary refund). Only flip from the states a chargeback can land on.
      await prisma.payment.updateMany({
        where: { id: payment.id, status: { in: ["completed", "pending"] } },
        data: { status: "disputed" },
      })
    }
  }

  // Notification emails — POST-DB, fire-and-forget (sendEmail never throws,
  // and the owner path catches its own lookup errors, so a slow/failing
  // provider or DB hiccup can never 500 the webhook). Only when the event
  // applied: duplicates and stale replays must not re-alert.
  if (applied) {
    // Founder copy (ALERT_EMAIL) on EVERY applied event...
    await sendDisputeAlertEmail(event.type, state, dispute.id)
    // ...and the business OWNER on created/closed (adversarial ToS review,
    // finding #10: the ToS promised "we will notify you ... by email" but only
    // the founder was emailed — the shop owner got a banner they might never
    // see inside a 7–21 day evidence window).
    await sendOwnerDisputeEmail(event.type, state, dispute.id)
  }

  return { applied, orphan }
}

async function sendDisputeAlertEmail(
  eventType: string,
  state: {
    businessId: string | null
    paymentIntentId: string | null
    amountCents: number
    currency: string
    reason: string | null
    status: string
    evidenceDueBy: Date | null
  },
  disputeId: string
): Promise<void> {
  const to = process.env.ALERT_EMAIL
  if (!to) {
    // Skip-with-a-log, never throw: alerting is best-effort by design.
    console.warn(
      `[stripe.webhook] ALERT_EMAIL not set — skipping dispute alert email (dispute=${disputeId} status=${state.status}).`
    )
    return
  }

  const amount = `$${(state.amountCents / 100).toFixed(2)} ${state.currency}`
  const dueBy = state.evidenceDueBy
    ? state.evidenceDueBy.toISOString()
    : "(no deadline on event)"

  await sendEmail({
    to,
    subject: `[SAL] Dispute ${state.status} — ${amount} (${disputeId})`,
    html: `
      <h2>Stripe dispute ${state.status}</h2>
      <p><strong>${eventType}</strong></p>
      <ul>
        <li>Dispute: ${disputeId}</li>
        <li>Amount: ${amount}</li>
        <li>Status: ${state.status}</li>
        <li>Reason: ${state.reason ?? "unknown"}</li>
        <li>Business: ${state.businessId ?? "UNKNOWN (orphan — manual review!)"}</li>
        <li>Payment intent: ${state.paymentIntentId ?? "unknown"}</li>
        <li>Evidence due by: ${dueBy}</li>
      </ul>
      <p>Policy: the shop bears a lost chargeback (merchant liability). Playbook:
      docs/INCIDENT_RUNBOOK.md §7 — respond with evidence in the Stripe dashboard
      before the deadline; if lost, recover via manual transfer reversal.</p>
    `,
  })
}

// Merchant-facing dispute notification (adversarial ToS review, finding #10).
// Sent on `created` (act NOW: get your evidence to SAL) and `closed` (the
// outcome) — NOT on `updated`, whose status churn is noise to a shop owner.
//
// The copy matches the dashboard banner and ToS §7: under destination charges
// the dispute lives on SAL's PLATFORM Stripe account, so the merchant cannot
// respond in their own Stripe dashboard — they reply to THIS email with their
// evidence and SAL submits it to the card network. replyTo is therefore
// getSupportEmail(), the same inbox the banner's mailto CTA points at.
//
// Best-effort BY DESIGN: the dispute is already recorded and the founder alert
// has fired. A thrown owner-lookup error here would 500 the webhook, Stripe
// would retry, and the retry would be swallowed as stale (watermark) — losing
// the notification forever. So every failure is caught and logged, never thrown.
async function sendOwnerDisputeEmail(
  eventType: string,
  state: {
    businessId: string | null
    paymentIntentId: string | null
    amountCents: number
    currency: string
    reason: string | null
    status: string
    evidenceDueBy: Date | null
  },
  disputeId: string
): Promise<void> {
  if (!eventType.endsWith(".created") && !eventType.endsWith(".closed")) return
  // Orphan disputes have no business to notify — the founder alert already
  // screams about those (manual review).
  if (!state.businessId) return

  try {
    const business = await prisma.business.findUnique({
      where: { id: state.businessId },
      select: {
        name: true,
        timezone: true,
        owner: { select: { email: true, firstName: true } },
      },
    })
    const ownerEmail = business?.owner?.email
    if (!ownerEmail) {
      console.warn(
        `[stripe.webhook] no owner email for business=${state.businessId} — skipping owner dispute email (dispute=${disputeId}).`
      )
      return
    }

    const amount = `$${(state.amountCents / 100).toFixed(2)} ${state.currency}`
    const supportEmail = getSupportEmail()
    // Deadline in the SALON's wall-clock (same precedent as booking emails) —
    // an ISO/UTC timestamp reads like a different day to a 9pm-ET owner.
    const dueBy = state.evidenceDueBy
      ? formatInZone(state.evidenceDueBy, business.timezone, {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
          timeZoneName: "short",
        })
      : null

    let subject: string
    let html: string
    if (eventType.endsWith(".created")) {
      subject = `Action needed: a client disputed a ${amount} payment to ${business.name}`
      html = `
        <h2>A payment to ${business.name} was disputed</h2>
        <p>A client disputed (charged back) a <strong>${amount}</strong> payment
        made to your business through SAL.</p>
        <p><strong>What to do: reply to this email with your evidence</strong> —
        receipts, appointment records, photos, client messages, and any
        cancellation-policy consent. ${dueBy ? `Please send it by <strong>${dueBy}</strong>.` : "Please send it as soon as possible."}
        SAL submits your evidence to the card network on your behalf — disputes
        are handled on SAL's payment account, so you won't see this dispute in
        your own Stripe dashboard.</p>
        <p>If the dispute is lost, the disputed amount is your business's
        responsibility and comes out of your payouts (Terms of Service §7).
        Disputes that receive no evidence are almost always lost.</p>
        <p>Questions? Reply to this email or write to ${supportEmail}.</p>
      `
    } else if (WON_STATUSES.has(state.status)) {
      subject = `Good news: the disputed ${amount} payment to ${business.name} was resolved in your favor`
      html = `
        <h2>Dispute resolved in your favor</h2>
        <p>The card network resolved the dispute over a <strong>${amount}</strong>
        payment to ${business.name} in your favor. The payment is restored and
        nothing is deducted from your payouts.</p>
        <p>Questions? Reply to this email or write to ${supportEmail}.</p>
      `
    } else if (state.status === "lost") {
      subject = `Dispute lost: ${amount} payment to ${business.name}`
      html = `
        <h2>Dispute lost</h2>
        <p>The card network resolved the dispute over a <strong>${amount}</strong>
        payment to ${business.name} in the cardholder's favor. Per the Terms of
        Service (§7), the disputed amount is your business's responsibility and
        comes out of your payouts. We'll reach out about next steps.</p>
        <p>Questions? Reply to this email or write to ${supportEmail}.</p>
      `
    } else {
      // A closed status that is neither won nor lost (Stripe adds/retires
      // statuses) — report it verbatim rather than guessing the outcome.
      subject = `Dispute closed (${state.status}): ${amount} payment to ${business.name}`
      html = `
        <h2>Dispute closed</h2>
        <p>The dispute over a <strong>${amount}</strong> payment to
        ${business.name} was closed with status
        <strong>${state.status}</strong>, as reported by our payment processor.</p>
        <p>Questions? Reply to this email or write to ${supportEmail}.</p>
      `
    }

    await sendEmail({ to: ownerEmail, replyTo: supportEmail, subject, html })
  } catch (err) {
    console.error(
      `[stripe.webhook] owner dispute email failed (dispute=${disputeId}):`,
      err
    )
  }
}
