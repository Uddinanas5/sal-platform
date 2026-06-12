import Stripe from "stripe"
import { prisma } from "@/lib/prisma"
import { stripe } from "@/lib/stripe"

// STRIPE → DB RECONCILIATION (Phase 2C).
//
// Webhooks are at-least-once but not guaranteed: an endpoint outage longer
// than Stripe's retry horizon, a mis-categorized endpoint, or a dropped write
// silently desyncs our money state from Stripe's. This module detects that
// drift daily and REPORTS it — v1 never auto-heals (a wrong auto-fix on money
// state is worse than a loud report).
//
// Shape (gate.ts style): computeDrift() is a PURE function over plain
// snapshots, fully unit-testable with fixtures. loadReconcileInputs() is the
// thin I/O wrapper (Stripe list endpoints + Prisma reads) that the cron route
// feeds into it. The window is 35 days — comfortably inside Stripe's 30-day
// events horizon with margin for late-arriving state. No Sigma: overkill at
// launch volume (and ~3h freshness anyway).

// ─────────────────────────────────────────────────────────────────────────────
// Shared Stripe → SAL subscription status mapping (used by the webhook AND the
// reconciler so the two can never disagree).
//
// Maps onto SAL's SubscriptionStatus enum values (exactly: active | trialing |
// past_due | cancelled | paused). We treat a trial as full access (active),
// and every failure/incomplete state as past_due so the dashboard shows the
// non-blocking "update your card" banner rather than hard-locking the salon.
// Stripe's `paused` (pause_collection) is a TEMPORARY hold — the subscription
// still exists and is expected to resume — so it maps to our own `paused`
// value (non-blocking banner), NEVER to `cancelled`. Only a true Stripe
// `canceled` is terminal and triggers the hard gate.
// ─────────────────────────────────────────────────────────────────────────────
export function mapStripeStatus(
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

// ─────────────────────────────────────────────────────────────────────────────
// Plain snapshots — the pure core never sees a Stripe SDK object or a Prisma
// row, only these.
// ─────────────────────────────────────────────────────────────────────────────
export type StripePaymentIntentSnapshot = {
  id: string
  status: string // Stripe PaymentIntent status (succeeded | canceled | ...)
  amountReceivedCents: number
  currency: string // lowercase ISO, as Stripe returns it
}

export type StripeDisputeSnapshot = {
  id: string
  paymentIntentId: string | null
  status: string
  amountCents: number
}

export type StripeSubscriptionSnapshot = {
  id: string
  status: Stripe.Subscription.Status
  metadataBusinessId: string | null
  customerId: string | null
}

export type DbPaymentSnapshot = {
  id: string
  processorId: string | null
  status: string
  totalAmountCents: number
  currency: string // uppercase ISO, as we store it
}

export type DbDisputeSnapshot = {
  id: string
  status: string
}

export type DbBusinessSnapshot = {
  id: string
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  subscriptionStatus: string
}

export type ReconcileInputs = {
  stripePaymentIntents: StripePaymentIntentSnapshot[]
  stripeDisputes: StripeDisputeSnapshot[]
  stripeSubscriptions: StripeSubscriptionSnapshot[]
  dbPayments: DbPaymentSnapshot[]
  dbDisputes: DbDisputeSnapshot[]
  dbBusinesses: DbBusinessSnapshot[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Drift kinds. Each one is a Stripe-vs-DB disagreement a human should review.
// ─────────────────────────────────────────────────────────────────────────────
export type Drift =
  // Stripe says money moved (PI succeeded) but we have NO Payment row at all.
  | {
      kind: "missing_payment"
      paymentIntentId: string
      stripeStatus: string
      amountCents: number
      currency: string
    }
  // The Payment row's status disagrees with Stripe's terminal state (e.g. PI
  // succeeded but the row is still pending/failed — the missed-webhook case —
  // or PI canceled but the row says completed).
  | {
      kind: "payment_status_drift"
      paymentId: string
      paymentIntentId: string
      dbStatus: string
      stripeStatus: string
    }
  // Amounts disagree on a payment both sides consider settled.
  | {
      kind: "payment_amount_drift"
      paymentId: string
      paymentIntentId: string
      dbAmountCents: number
      stripeAmountCents: number
    }
  // Stripe has a dispute we never recorded (missed charge.dispute.* webhook).
  | {
      kind: "missing_dispute"
      disputeId: string
      paymentIntentId: string | null
      stripeStatus: string
      amountCents: number
    }
  // Our dispute row's status disagrees with Stripe's.
  | {
      kind: "dispute_status_drift"
      disputeId: string
      dbStatus: string
      stripeStatus: string
    }
  // The business's subscriptionStatus disagrees with what the live Stripe
  // subscription maps to (mapStripeStatus — same mapping the webhook applies).
  | {
      kind: "subscription_status_drift"
      businessId: string
      subscriptionId: string
      dbStatus: string
      stripeStatus: string
      expectedStatus: string
    }

// DB payment statuses that are consistent with a SUCCEEDED PaymentIntent.
// completed = the normal case; refunded/disputed = post-success lifecycles
// tracked by their own webhooks (totalAmount still reflects the gross charge).
const SETTLED_DB_STATUSES = new Set(["completed", "refunded", "disputed"])

// PaymentIntent statuses still in flight — no judgement until they settle.
const IN_FLIGHT_PI_STATUSES = new Set([
  "processing",
  "requires_payment_method",
  "requires_confirmation",
  "requires_action",
  "requires_capture",
])

/**
 * PURE drift computation — no I/O, no clock, no SDK objects. Everything the
 * daily reconciliation reports comes from here, so every rule is unit-tested
 * with plain fixtures (tests/billing-reconcile-drift.test.ts).
 */
export function computeDrift(inputs: ReconcileInputs): Drift[] {
  const drift: Drift[] = []

  const paymentsByProcessorId = new Map<string, DbPaymentSnapshot>()
  for (const p of inputs.dbPayments) {
    if (p.processorId) paymentsByProcessorId.set(p.processorId, p)
  }

  // ── Payments ──────────────────────────────────────────────────────────────
  for (const pi of inputs.stripePaymentIntents) {
    if (IN_FLIGHT_PI_STATUSES.has(pi.status)) continue

    const row = paymentsByProcessorId.get(pi.id)

    if (pi.status === "succeeded") {
      if (!row) {
        drift.push({
          kind: "missing_payment",
          paymentIntentId: pi.id,
          stripeStatus: pi.status,
          amountCents: pi.amountReceivedCents,
          currency: pi.currency,
        })
        continue
      }
      if (!SETTLED_DB_STATUSES.has(row.status)) {
        // Money moved on Stripe; our row never caught up (missed webhook).
        drift.push({
          kind: "payment_status_drift",
          paymentId: row.id,
          paymentIntentId: pi.id,
          dbStatus: row.status,
          stripeStatus: pi.status,
        })
        continue // don't double-report the same row as an amount drift
      }
      if (row.totalAmountCents !== pi.amountReceivedCents) {
        drift.push({
          kind: "payment_amount_drift",
          paymentId: row.id,
          paymentIntentId: pi.id,
          dbAmountCents: row.totalAmountCents,
          stripeAmountCents: pi.amountReceivedCents,
        })
      }
      continue
    }

    if (pi.status === "canceled" && row && row.status === "completed") {
      // We think money came in; Stripe says the intent was canceled.
      drift.push({
        kind: "payment_status_drift",
        paymentId: row.id,
        paymentIntentId: pi.id,
        dbStatus: row.status,
        stripeStatus: pi.status,
      })
    }
  }

  // ── Disputes ──────────────────────────────────────────────────────────────
  const dbDisputesById = new Map(inputs.dbDisputes.map((d) => [d.id, d]))
  for (const sd of inputs.stripeDisputes) {
    const row = dbDisputesById.get(sd.id)
    if (!row) {
      drift.push({
        kind: "missing_dispute",
        disputeId: sd.id,
        paymentIntentId: sd.paymentIntentId,
        stripeStatus: sd.status,
        amountCents: sd.amountCents,
      })
      continue
    }
    if (row.status !== sd.status) {
      drift.push({
        kind: "dispute_status_drift",
        disputeId: sd.id,
        dbStatus: row.status,
        stripeStatus: sd.status,
      })
    }
  }

  // ── Subscriptions (the salon paying SAL) ─────────────────────────────────
  const businessesById = new Map(inputs.dbBusinesses.map((b) => [b.id, b]))
  const businessesByCustomerId = new Map<string, DbBusinessSnapshot>()
  for (const b of inputs.dbBusinesses) {
    if (b.stripeCustomerId) businessesByCustomerId.set(b.stripeCustomerId, b)
  }

  for (const sub of inputs.stripeSubscriptions) {
    // Resolve by durable identifiers, mirroring the webhook's order.
    const business =
      (sub.metadataBusinessId && businessesById.get(sub.metadataBusinessId)) ||
      (sub.customerId && businessesByCustomerId.get(sub.customerId)) ||
      null
    if (!business) continue // foreign/unattributable subscription — not ours to judge

    // Only compare against the subscription the business is actually on. An
    // old, replaced subscription for the same customer must not flag drift.
    if (business.stripeSubscriptionId && business.stripeSubscriptionId !== sub.id) {
      continue
    }

    const expected = mapStripeStatus(sub.status)
    if (expected !== business.subscriptionStatus) {
      drift.push({
        kind: "subscription_status_drift",
        businessId: business.id,
        subscriptionId: sub.id,
        dbStatus: business.subscriptionStatus,
        stripeStatus: sub.status,
        expectedStatus: expected,
      })
    }
  }

  return drift
}

// ─────────────────────────────────────────────────────────────────────────────
// Thin loader — sequential Stripe pagination with spacing + bounded 429
// backoff, then plain Prisma reads. Everything is normalized into snapshots
// before computeDrift ever sees it.
// ─────────────────────────────────────────────────────────────────────────────
export const RECONCILE_WINDOW_DAYS = 35
const PAGE_SIZE = 100
const PAGE_SPACING_MS = 250
const RATE_LIMIT_MAX_RETRIES = 5
const RATE_LIMIT_BASE_BACKOFF_MS = 1000

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

function isRateLimitError(err: unknown): boolean {
  const e = err as { statusCode?: number; code?: string; type?: string }
  return (
    e?.statusCode === 429 ||
    e?.code === "rate_limit" ||
    e?.type === "StripeRateLimitError"
  )
}

async function withRateLimitBackoff<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown
  for (let attempt = 0; attempt <= RATE_LIMIT_MAX_RETRIES; attempt++) {
    if (attempt > 0) await sleep(RATE_LIMIT_BASE_BACKOFF_MS * 2 ** (attempt - 1))
    try {
      return await fn()
    } catch (err) {
      if (!isRateLimitError(err)) throw err
      lastErr = err
    }
  }
  throw lastErr
}

async function listAllPages<T extends { id: string }>(
  fetchPage: (startingAfter?: string) => Promise<{ data: T[]; has_more: boolean }>
): Promise<T[]> {
  const all: T[] = []
  let startingAfter: string | undefined
  for (;;) {
    const page = await withRateLimitBackoff(() => fetchPage(startingAfter))
    all.push(...page.data)
    if (!page.has_more || page.data.length === 0) break
    startingAfter = page.data[page.data.length - 1].id
    await sleep(PAGE_SPACING_MS) // be kind to the rate limit — sequential, spaced
  }
  return all
}

function toCents(amount: unknown): number {
  return Math.round(Number(amount || 0) * 100)
}

export async function loadReconcileInputs(now = new Date()): Promise<ReconcileInputs> {
  const windowStart = new Date(now.getTime() - RECONCILE_WINDOW_DAYS * 86_400_000)
  const createdGte = Math.floor(windowStart.getTime() / 1000)

  // Stripe side — sequential (never parallel) so a quiet daily cron can't
  // contribute to a rate-limit spike.
  const paymentIntents = await listAllPages<Stripe.PaymentIntent>((sa) =>
    stripe.paymentIntents.list({
      created: { gte: createdGte },
      limit: PAGE_SIZE,
      ...(sa ? { starting_after: sa } : {}),
    })
  )
  const disputes = await listAllPages<Stripe.Dispute>((sa) =>
    stripe.disputes.list({
      created: { gte: createdGte },
      limit: PAGE_SIZE,
      ...(sa ? { starting_after: sa } : {}),
    })
  )
  const subscriptions = await listAllPages<Stripe.Subscription>((sa) =>
    stripe.subscriptions.list({
      status: "all",
      limit: PAGE_SIZE,
      ...(sa ? { starting_after: sa } : {}),
    })
  )

  // DB side. Payments get a 1-day margin on the window so a row created just
  // before the Stripe window opened still matches its PI.
  const dbWindowStart = new Date(windowStart.getTime() - 86_400_000)
  const dbPayments = await prisma.payment.findMany({
    where: { processor: "stripe", createdAt: { gte: dbWindowStart } },
    select: {
      id: true,
      processorId: true,
      status: true,
      totalAmount: true,
      currency: true,
    },
  })
  const dbDisputes = await prisma.dispute.findMany({
    select: { id: true, status: true },
  })
  const dbBusinesses = await prisma.business.findMany({
    where: {
      OR: [
        { NOT: { stripeCustomerId: null } },
        { NOT: { stripeSubscriptionId: null } },
      ],
    },
    select: {
      id: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      subscriptionStatus: true,
    },
  })

  return {
    stripePaymentIntents: paymentIntents.map((pi) => ({
      id: pi.id,
      status: pi.status,
      amountReceivedCents: pi.amount_received ?? pi.amount ?? 0,
      currency: pi.currency,
    })),
    stripeDisputes: disputes.map((d) => ({
      id: d.id,
      paymentIntentId:
        typeof d.payment_intent === "string"
          ? d.payment_intent
          : d.payment_intent?.id ?? null,
      status: d.status,
      amountCents: d.amount ?? 0,
    })),
    stripeSubscriptions: subscriptions.map((s) => ({
      id: s.id,
      status: s.status,
      metadataBusinessId: s.metadata?.businessId ?? null,
      customerId: typeof s.customer === "string" ? s.customer : s.customer?.id ?? null,
    })),
    dbPayments: dbPayments.map((p) => ({
      id: p.id,
      processorId: p.processorId,
      status: p.status,
      totalAmountCents: toCents(p.totalAmount),
      currency: p.currency,
    })),
    dbDisputes,
    dbBusinesses,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Digest email — sent ONLY when drift exists (no alarm fatigue: a clean run is
// silent). Plain HTML list, one line per drift item.
// ─────────────────────────────────────────────────────────────────────────────
export function buildDriftDigest(
  drift: Drift[],
  at: Date
): { subject: string; html: string } {
  const subject = `[SAL] Reconciliation drift: ${drift.length} item${drift.length === 1 ? "" : "s"} need review`
  const items = drift
    .map((d) => {
      const { kind, ...rest } = d
      const detail = Object.entries(rest)
        .map(([k, v]) => `${k}=${String(v)}`)
        .join(" · ")
      return `<li><strong>${kind}</strong> — ${detail}</li>`
    })
    .join("\n")
  const html = `
    <h2>SAL daily reconciliation found drift</h2>
    <p>Run at ${at.toISOString()} over a ${RECONCILE_WINDOW_DAYS}-day window. Stripe is the
    source of truth for money state — each item below is a Stripe-vs-database
    disagreement that needs a human decision. Nothing was auto-corrected.</p>
    <ul>${items}</ul>
    <p>Playbook: docs/INCIDENT_RUNBOOK.md §7 (chargebacks) / §2 (payments).</p>
  `
  return { subject, html }
}
