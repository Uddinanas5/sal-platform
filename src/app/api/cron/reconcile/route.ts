import { NextRequest, NextResponse } from "next/server"
import { authorizeCron } from "@/lib/cron-auth"
import {
  loadReconcileInputs,
  computeDrift,
  buildDriftDigest,
} from "@/lib/billing/reconcile"
import { sendEmail } from "@/lib/email"
import { getLog } from "@/lib/log/context"

// DAILY STRIPE→DB RECONCILIATION (Phase 2C). Invoked by Vercel Cron (see
// vercel.json "crons", 14:30 UTC daily — an hour after the dispatch cron's
// daily automations so the two never contend).
//
// SECURITY MODEL — FAIL CLOSED (shared with cron/dispatch, src/lib/cron-auth.ts):
// CRON_SECRET required, constant-time compare, unset secret = nobody is
// authorized. 401 does NOTHING — no Stripe calls, no DB reads.
//
// BEHAVIOR: load 35-day Stripe + DB snapshots → pure computeDrift() → report.
//   - v1 REPORTS ONLY, never auto-heals (a wrong auto-fix on money state is
//     worse than a loud report).
//   - Digest email goes out ONLY when drift exists (no alarm fatigue — a clean
//     run is silent). Sent to ALERT_EMAIL; if unset, we log loudly and still
//     return the drift in the response.
export const dynamic = "force-dynamic"
export const revalidate = 0

async function handle(req: NextRequest) {
  if (!authorizeCron(req)) {
    // Opaque 401 — do not reveal whether the secret was unset vs. mismatched.
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const startedAt = new Date()
  try {
    const inputs = await loadReconcileInputs(startedAt)
    const drift = computeDrift(inputs)

    let emailed = false
    if (drift.length > 0) {
      const to = process.env.ALERT_EMAIL
      if (!to) {
        console.error(
          `[cron.reconcile] DRIFT FOUND (${drift.length} item(s)) but ALERT_EMAIL is not set — ` +
            `digest NOT sent. Set ALERT_EMAIL in Vercel env. Drift: ${JSON.stringify(drift)}`
        )
      } else {
        const digest = buildDriftDigest(drift, startedAt)
        // sendEmail never throws (best-effort by design); a provider outage
        // must not fail the cron — the drift still lands in logs + response.
        const result = await sendEmail({ to, ...digest })
        emailed = Boolean(result.success)
      }
    }

    const scanned = {
      stripePaymentIntents: inputs.stripePaymentIntents.length,
      stripeDisputes: inputs.stripeDisputes.length,
      stripeSubscriptions: inputs.stripeSubscriptions.length,
      dbPayments: inputs.dbPayments.length,
      dbDisputes: inputs.dbDisputes.length,
      dbBusinesses: inputs.dbBusinesses.length,
    }
    getLog().info(
      { at: startedAt.toISOString(), scanned, driftCount: drift.length, emailed },
      "cron/reconcile run"
    )

    return NextResponse.json({
      ok: true,
      at: startedAt.toISOString(),
      scanned,
      driftCount: drift.length,
      drift,
      emailed,
    })
  } catch (e) {
    getLog().error(
      { err: e instanceof Error ? e.message : String(e) },
      "cron/reconcile run failed"
    )
    return NextResponse.json(
      { ok: false, error: "reconcile_failed" },
      { status: 500 }
    )
  }
}

// Vercel Cron issues GET requests. POST is accepted too for manual/portable
// triggering with the same auth gate.
export async function GET(req: NextRequest) {
  return handle(req)
}

export async function POST(req: NextRequest) {
  return handle(req)
}
