# Loop 7 — Stripe dispute handling + reconciliation (Phase 2B/2C)

**Date:** 2026-06-11
**Branch:** `loop/disputes` (off `harden/production-readiness`)
**Design doc:** ~/SAL-Design-Disputes-RLS.md (DOC 1) — followed as specced.
**Policy:** founder-approved merchant liability ("let's do like them") — the SHOP
bears lost chargebacks, exactly like Fresha/Square/Booksy/Vagaro/GlossGenius/
Mindbody/Toast/Shopify (deep-research verified; SAL was the outlier).

## What was built

### 1. Data model (Prisma + 2 migrations, both with committed rollback.sql)

- `Dispute` model (`prisma/schema.prisma`): Stripe dispute id stored
  **verbatim** as the PK (`du_`/legacy `dp_` — never prefix-validated);
  `status` varchar NOT an enum (Stripe adds/retires statuses); `businessId`
  **nullable** for orphans; per-row `lastEventAt` freshness watermark;
  `feeCents Int @default(1500)` + `feeWaived Boolean @default(true)` (the $15
  fee policy is RECORD-ONLY in v1 — refunded if the shop wins, waived in beta,
  nothing auto-charges).
- `PaymentStatus` gains `disputed` in
  `20260611210000_payment_status_disputed` — the `ALTER TYPE ... ADD VALUE`
  is **alone in its own migration** (PG12+ rule: a new enum value cannot be
  USED in the transaction that adds it; Prisma wraps each migration in its own
  txn, so isolation guarantees the value is committed before any use).
- `20260611211000_create_disputes` — table + 2 indexes + 2 FKs
  (`ON DELETE SET NULL`: dispute history survives business/payment deletion,
  per the commissions precedent). House pattern: idempotent + schema-scoped.
- `Dispute` registered in `DIRECT_BUSINESS_ID` (`src/lib/prisma-tenant.ts`).

### 2. Webhook (`src/app/api/stripe/webhook/route.ts` + `src/lib/billing/disputes.ts`)

- `charge.dispute.created/updated/closed` → `applyDisputeEvent()`:
  - Payment resolved by `processorId = payment_intent` (server-trusted).
  - Orphan (unknown PI) → recorded with `businessId null` + loud
    `console.error` (money at risk is never dropped).
  - Freshness: `updateMany where lastEventAt < event.created`, then
    `create`-with-P2002-swallow — handles first-event create, concurrent
    delivery, and the closed-before-created reordering without regression.
  - Payment transitions: open statuses → `disputed`; closed **won** (and
    `warning_closed`) → restore `completed` ONLY-if-disputed; closed **lost**
    → stays `disputed`.
  - Post-DB fire-and-forget founder alert email to `ALERT_EMAIL` (never
    throws; skips with a log when unset).
- `charge.dispute.funds_withdrawn/funds_reinstated` → logged no-ops
  (state already tracked; acting would double-count).
- Existing StripeEvent record-after-success idempotency gate covers all new
  cases unchanged.

### 3. Owner red banner (merchant-liability tone)

- `src/app/(dashboard)/layout.tsx` queries open disputes
  (`OPEN_DISPUTE_STATUSES`, earliest `evidenceDueBy` first, nulls last,
  `.catch → no banner` so a deploy racing its migration degrades gracefully).
- `src/components/dashboard/dashboard-layout.tsx` renders it ABOVE the amber
  billing banner, frost classes `bg-red-500/10 border-red-500/30 text-red-300`,
  approved copy: *"A client disputed a $X payment. Respond with evidence by
  {date} — if the dispute is lost, the amount comes out of your payouts."*
  CTA "Respond in Stripe" → existing `/api/stripe/dashboard-link` route
  (server resolves the caller's OWN connected account).

### 4. Reconciliation (`src/lib/billing/reconcile.ts` + `/api/cron/reconcile`)

- Pure `computeDrift()` (gate.ts style) over plain snapshots. Drift kinds:
  `missing_payment`, `payment_status_drift`, `payment_amount_drift`,
  `missing_dispute`, `dispute_status_drift`, `subscription_status_drift`.
- `mapStripeStatus` MOVED here and exported — webhook + reconciler share one
  mapping and can never disagree.
- Thin loader: 35-day window, sequential pagination with 250ms spacing +
  exponential 429 backoff (max 5 retries), no Sigma.
- Cron route clones dispatch's fail-closed CRON_SECRET auth via new shared
  `src/lib/cron-auth.ts` (dispatch refactored to use it — behavior identical,
  all dispatch tests still green).
- `vercel.json` cron `30 14 * * *`. **Digest email ONLY on drift** (a clean
  run is silent — no alarm fatigue). v1 reports only, never auto-heals.

### 5. ToS (`src/app/terms/page.tsx`)

- New section 7 "Payments, Chargebacks & Disputes" (Fresha clause family,
  plain English): shop is responsible for chargebacks on payments it receives;
  SAL may recover disputed amounts from future payouts or by transfer
  reversal; $15 dispute fee (refunded on win, currently waived); shop must
  respond to evidence requests by the deadline. Sections renumbered 8–12;
  "Last updated" bumped to June 11, 2026.

### 6. Runbook (`docs/INCIDENT_RUNBOOK.md` §7)

- Founder recipe: respond-with-evidence steps (7a), **manual transfer
  reversal** recovery when a dispute is lost (7b — find the `tr_...` on the
  charge → Reverse transfer → partial reversal of the disputed amount only),
  and the won path (7c). Auto-netting from future payouts is explicitly a
  flagged follow-up, not built.

### 7. Tests (mock-Prisma, mirroring stripe-webhook-idempotency patterns)

- `tests/stripe-dispute-webhook.test.ts` — 9 cases: created records+flips+alerts,
  updated fresh watermark path, closed-won only-if-disputed restore, closed-lost
  stays disputed, **out-of-order closed-before-created** (P2002 swallow, zero
  regression), **duplicate short-circuit**, orphan (businessId null + loud
  error), ALERT_EMAIL-unset skip, funds_* logged no-ops.
- `tests/billing-reconcile-drift.test.ts` — 15 cases: fixtures per Drift kind +
  all-clean + in-flight skip + refunded/disputed-not-drift + replaced-sub skip +
  foreign-sub skip + shared mapStripeStatus pinned + digest builder.
- `tests/cron-reconcile-auth.test.ts` — 7 cases: 401 unset / 401 wrong / 200
  correct, x-cron-secret parity, **digest-only-on-drift** (mocked sendEmail),
  drift-without-ALERT_EMAIL, loader-failure 500.
- 16th invariant added to `scripts/check-invariants.mjs`:
  "A chargeback is recorded once and never regressed" → stripe-dispute-webhook.

## Gate results (all green)

| Gate | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS — no warnings or errors¹ |
| `npm test` | PASS — 569/569 (81 files; 538 before this loop, +31 new) |
| `npm run test:tz` | PASS — 569/569 under TZ=UTC and TZ=America/New_York |
| `npm run check:invariants` | PASS — **16/16** invariants GREEN (new dispute invariant included) |
| `npm run check:fake-success` | PASS — 6 advisory notes, all pre-existing files, none from this change |
| `npm run build` | PASS — compiled, 65 pages, `/api/cron/reconcile` present |
| `node scripts/check-migrations.mjs --all` | New migration ACKNOWLEDGED (`sal:safety-assured`: indexes on a brand-new empty table) |

¹ One incidental fix: `.eslintrc.json` gained `"root": true`. Without it, lint
run from a nested git worktree cascades into the parent checkout's eslint
config and dies with a plugin conflict. Standard practice; zero behavior
change in CI.

## Migration rehearsal (dev schema ONLY)

```text
TEST TARGET: Supabase project tssqhzcluqanagsmcvym via sal_agent role (local rehearsal)
DATABASE SCHEMA: dev (isolated — safe to break/reset; sal_agent has NO access to public)
LIVE PRODUCTION URL? no
```

- `npx prisma migrate deploy` → applied 8 pending migrations (6 older ones the
  dev schema was behind on + the 2 new dispute migrations):
  "All migrations have been successfully applied."
- Post-deploy verification: enum = `[pending, completed, failed, refunded,
  disputed]`; `disputes` table present with `disputes_pkey`,
  `disputes_business_id_status_idx`, `disputes_payment_intent_id_idx`; both
  FKs present with `confdeltype = 'n'` (SET NULL).
- **Rollback rehearsed for BOTH migrations** (then re-applied forward):
  - `create_disputes/rollback.sql` → table gone → forward re-applied → table +
    indexes + FKs restored identically.
  - `payment_status_disputed/rollback.sql` (guarded enum rebuild) → enum back
    to 4 values → forward re-applied → `disputed` restored.
- **Idempotency proven:** both forward migrations re-run a second time on an
  already-migrated schema — clean no-ops.

## Founder to-dos (HUMAN_INPUT_NEEDED)

1. **Set `ALERT_EMAIL` in Vercel** (Project → Settings → Environment
   Variables → Production): the inbox for dispute alerts + the daily drift
   digest. Until set, alerts are skipped with a log (everything else works).
2. **Lawyer review of ToS section 7** ("Payments, Chargebacks & Disputes")
   before enforcing it — drafted from industry-standard clauses, not legal
   advice. (Section 6 pricing terms were already flagged for the same review.)
3. **Enable `charge.dispute.*` events on the Stripe webhook endpoint** —
   exact steps:
   1. Stripe Dashboard → **Developers → Webhooks**
      (https://dashboard.stripe.com/webhooks).
   2. Open the endpoint pointing at `https://www.meetsal.ai/api/stripe/webhook`.
   3. Click **⋯ → Update details** → "Select events" (or **Listen to →
      Update events**).
   4. Search "dispute" and tick all five: `charge.dispute.created`,
      `charge.dispute.updated`, `charge.dispute.closed`,
      `charge.dispute.funds_withdrawn`, `charge.dispute.funds_reinstated`.
   5. Save, then use **Send test event** → `charge.dispute.created` and
      confirm a 200 in "Event deliveries".
   6. **While there (pre-launch verification from the design doc):** check the
      endpoint's category. This one endpoint currently serves BOTH platform
      events and `account.updated` (a connected-account event) — Stripe
      registers "Events on your account" vs "Events on connected accounts" as
      separate endpoint categories with SEPARATE signing secrets. If
      `account.updated` deliveries show signature failures, a second endpoint
      (and second `STRIPE_WEBHOOK_SECRET`) is needed.
4. **Cron**: the new `/api/cron/reconcile` schedule (14:30 UTC daily) goes
   live automatically on the next production deploy of `vercel.json`;
   `CRON_SECRET` is already configured for dispatch and is shared.
5. **Read runbook §7** (docs/INCIDENT_RUNBOOK.md): the dispute playbook,
   including the manual transfer-reversal recovery recipe for lost disputes.

## Deferred / explicitly NOT built (per policy)

- Auto-netting lost disputes from future payouts (flagged follow-up; v1
  recovery is the manual transfer reversal in runbook §7b).
- Auto-charging the $15 fee (record-only fields exist: feeCents/feeWaived).
- Auto-evidence assembly (Vagaro/GlossGenius-style) — fast-follow.
- Reconciliation auto-healing — v1 reports only.
