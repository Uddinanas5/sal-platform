import Stripe from "stripe"
import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"

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

  // Founder alert email — POST-DB, fire-and-forget (sendEmail never throws, so
  // a slow/failing provider can never 500 the webhook). Only when the event
  // applied: duplicates and stale replays must not re-alert.
  if (applied) {
    await sendDisputeAlertEmail(event.type, state, dispute.id)
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
