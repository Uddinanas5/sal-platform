# Stripe Test-Mode Runbook (Billing Launch Evidence)

A copy-pasteable, repeatable runbook for exercising SAL's **subscription billing**
(the salon paying SAL) end-to-end against **Stripe test mode** + the **Stripe CLI**.
The captured output of a clean run through sections 1–7 is the **launch evidence**
for billing.

> **Scope.** This covers the SAL subscription webhook
> (`src/app/api/stripe/webhook/route.ts`) and the gate behaviour it drives
> (`src/lib/billing/gate.ts`). It is **test-mode only**. Never run any of this
> against production keys or the live URL. See `CLAUDE.md` → "Testing & Database
> Safety": run against **localhost + the `dev` schema**.
>
> **Print and verify before you start (per the repo rule):**
> ```text
> TEST TARGET:        localhost:3000
> DATABASE SCHEMA:    dev
> LIVE PRODUCTION URL? no
> STRIPE MODE:        TEST (sk_test_… / whsec from `stripe listen`)
> ```

---

## What the webhook actually does (ground truth)

These are the events the route handles and the **exact DB state** each one writes.
The runbook's "Expected" blocks below assert against THIS table. Source of truth:
`src/app/api/stripe/webhook/route.ts` (verified 2026-06-11).

| Event | Handler effect on the DB |
| --- | --- |
| `account.updated` | `Business.stripeAccountStatus` ← `active` (charges+payouts enabled) / `restricted` (disabled_reason) / `pending`; sets `stripeOnboardedAt` when active. Connect onboarding — **not** subscription billing. |
| `payment_intent.succeeded` | Finds `Payment` by `processorId`. If amount/currency mismatch → `Payment.status = failed` (+ logs, no appointment change). Else, in a tx: `Payment.status = completed`, `processedAt = now`, and if `appointmentId` set → `Appointment.status = confirmed`. No match → logs only. |
| `payment_intent.payment_failed` | Finds `Payment` by `processorId` → `Payment.status = failed`. |
| `charge.refunded` | Finds `Payment` by the charge's `payment_intent` → sets `refundedAmount`, `refundedAt`, and `status = refunded` only on a **full** refund. |
| `checkout.session.completed` (mode=`subscription` only) | Resolves business by `metadata.businessId` / `client_reference_id`. **Freshness-guarded** write: `subscriptionStatus = active`, `subscriptionTier = pro`, persists `stripeSubscriptionId` + `stripeCustomerId`, bumps `lastBillingEventAt`. |
| `customer.subscription.created` | Resolves by `metadata.businessId` → `stripeCustomerId` → `stripeSubscriptionId`. **Freshness-guarded**: `subscriptionStatus = mapStripeStatus(status)`, persists `stripeSubscriptionId`, bumps `lastBillingEventAt`. |
| `customer.subscription.updated` | Same resolution. **Freshness-guarded**: `subscriptionStatus = mapStripeStatus(status)`, persists `stripeSubscriptionId`, bumps `lastBillingEventAt`. |
| `customer.subscription.deleted` | Same resolution. **Freshness-guarded**: `subscriptionStatus = cancelled`, **keeps** `stripeSubscriptionId` (so the hard gate can fire), bumps `lastBillingEventAt`. |
| `invoice.payment_succeeded` / `invoice.paid` | Resolves by `subscription_details.metadata.businessId` → customer-with-live-sub. **Recovery flip**: only `past_due → active` (never touches `cancelled`/`paused`). If no flip, still bumps `lastBillingEventAt` for an `active` live sub. Freshness-guarded. |
| `invoice.payment_failed` | Resolves by `stripeCustomerId` **with a live sub** (`stripeSubscriptionId != null`). **Downgrade**: `subscriptionStatus = past_due`, bumps `lastBillingEventAt`. Freshness-guarded. |

**Status mapping** (`mapStripeStatus` in the route):
`active`/`trialing` → `active` · `past_due`/`unpaid`/`incomplete`/`incomplete_expired` → `past_due` · `paused` → `paused` · `canceled` → `cancelled`.

**Gate mapping** (`decideBillingGate` in `src/lib/billing/gate.ts`) — what the app does for a given `Business`:

| Condition | Decision | App behaviour |
| --- | --- | --- |
| `billingExempt = true` | `allow` | Full access, no banner. (Founder waiver.) |
| `hasSubscription = false` (never subscribed) | `allow` | Full access, no banner. Safe default — every founding beta salon. |
| `status = cancelled` **and** `hasSubscription = true` | `gate` | **Hard redirect** to billing. The ONLY hard lock. |
| `status = past_due` (subscribed) | `banner: past_due` | Full access + "update your card" banner. |
| `status = paused` (subscribed) | `banner: paused` | Full access + paused banner. |
| anything else (e.g. `active`) | `allow` | Full access, no banner. |

> `hasSubscription` ≙ a non-null `stripeSubscriptionId`. This is why
> `customer.subscription.deleted` **keeps** the id: clearing it would set
> `hasSubscription = false` and silently turn the hard gate into `allow`.

**Idempotency model:** the route records a `StripeEvent` row **after** the handler
succeeds. A re-delivery of an already-processed `event.id` short-circuits at the top
with HTTP 200 `{ received: true, duplicate: true, ... }` and **does no DB work**. A
handler that threw leaves **no** row, so a Stripe retry safely re-runs it.

**Plan / Prices** (`src/lib/billing/plan.ts`, find-or-create by `lookup_key`):
- Setup fee: **$1,500** one-time, `lookup_key = sal_setup_1500`, product "SAL Setup Fee".
- Monthly: **$497/mo** recurring, `lookup_key = sal_monthly_497`, product "SAL Subscription".

---

## 0. One-time prerequisites

```bash
# Stripe CLI (macOS)
brew install stripe/stripe-cli/stripe

# Confirm you're on TEST keys (the local .env must hold sk_test_… / pk_test_…)
grep -E '^STRIPE_SECRET_KEY|^NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY' .env
# EXPECT: STRIPE_SECRET_KEY="sk_test_…"   (NOT sk_live_…)

# Dev DB schema sanity (must be `dev`, never public/production)
grep -E '^DATABASE_URL' .env | sed -E 's/(:\/\/[^:]+:)[^@]+/\1***/'
# EXPECT: a Supabase URL whose search_path/?schema points at `dev`.
```

Convenience scripts were added to `package.json` for this runbook
(see [§ package.json scripts](#package-json-scripts)):

```bash
pnpm stripe:listen    # stripe listen --forward-to localhost:3000/api/stripe/webhook
pnpm stripe:trigger   # passthrough to `stripe trigger …`
```

---

## 1. Setup — log in, forward webhooks, capture `whsec`

```bash
# 1a. Authenticate the CLI to your TEST-mode Stripe account (opens a browser)
stripe login
# EXPECT: "Done! The Stripe CLI is configured for <acct> with account id acct_…"

# 1b. Start the app against the dev schema (separate terminal)
pnpm dev
# EXPECT: "ready - started server on http://localhost:3000"

# 1c. Forward live test-mode events to the local webhook (separate terminal).
#     This prints the signing secret the route needs.
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Expected `stripe listen` output:

```text
> Ready! You are using Stripe API Version [2026-01-28]. Your webhook signing
> secret is whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx (^C to quit)
```

**Capture that `whsec_…` into the local env and restart the dev server so the
route picks it up** (the route reads `process.env.STRIPE_WEBHOOK_SECRET` at module
load; a missing secret makes it return **HTTP 500 "Stripe webhook is not
configured"**):

```bash
# In .env (DEV ONLY — never commit, never a live secret):
#   STRIPE_WEBHOOK_SECRET="whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
# then Ctrl-C pnpm dev and re-run it.
```

**Smoke check the wiring:**

```bash
stripe trigger payment_intent.succeeded
```

Expected, across the two terminals:
- `stripe listen` shows `--> payment_intent.succeeded [evt_…]` then
  `<-- [200] POST http://localhost:3000/api/stripe/webhook`.
- The dev server logs the unknown-payment notice
  `payment_intent.succeeded for unknown payment processorId=pi_… — no matching Payment row.`
  (expected — `stripe trigger` mints a synthetic PI with no SAL `Payment` row).
- **DB:** no change (no matching `Payment`). A `StripeEvent` row IS written for
  `evt_…` (handler succeeded → recorded). Verify:
  ```bash
  pnpm stripe:event-count   # see § package.json scripts; prints StripeEvent count
  ```

If the route returns **400 "Invalid signature"**, the `whsec_` in `.env` does not
match the one `stripe listen` is currently using — recapture and restart.

---

## 2. Replay / idempotency — same `event.id` must not double-apply

Goal: prove a redelivered event short-circuits with `{ duplicate: true }` and does
**zero** additional DB work (the `StripeEvent` record-after-success gate).

```bash
# 2a. Trigger a fresh event and copy its id from `stripe listen` (evt_…).
stripe trigger payment_intent.succeeded
#   -> note the EVENT id printed:  --> payment_intent.succeeded [evt_ABC123]

# 2b. Resend THE SAME event id through the CLI.
stripe events resend evt_ABC123 --webhook-endpoint localhost:3000/api/stripe/webhook
#   (or: `stripe events resend evt_ABC123` if your `stripe listen` is the only sink)
```

Expected:
- **First delivery:** route returns `{ "received": true }` (HTTP 200) and writes
  **one** `StripeEvent` row for `evt_ABC123`.
- **Resend of the same id:** route short-circuits at the idempotency gate and
  returns:
  ```json
  { "received": true, "duplicate": true, "message": "[duplicate event]" }
  ```
  with **HTTP 200**, and **no further DB writes** (no second `StripeEvent` row, no
  re-run of the handler side effects).

Verify no double-apply:
```bash
pnpm stripe:event-count    # StripeEvent count for evt_ABC123 must be exactly 1
# EXPECT: a single row; the resend did not create a duplicate.
```

> Why this is the real guard, not theatre: the route does
> `prisma.stripeEvent.findUnique({ where: { id: event.id } })` first and returns
> `duplicate: true` if found. The row only exists because the **first** delivery's
> handler succeeded.

---

## 3. Out-of-order — stale downgrade must lose to the freshness guard

Goal: prove that a `customer.subscription.updated → past_due` followed by an
**older** `invoice.payment_succeeded` (lower `event.created`) leaves the salon
**active**, because the freshness guard (`lastBillingEventAt`) rejects the stale
event.

Because `stripe trigger` does not let you backdate `event.created`, drive this with
**locally constructed events** so you control the timestamps. Use the helper added
for this runbook:

```bash
# Sends two signed events to the local webhook with explicit `created` times and a
# real businessId so the route resolves a row. See § package.json scripts.
pnpm stripe:ooo --business <BUSINESS_ID> --customer <cus_…> --subscription <sub_…>
```

What the helper does, and the expected outcomes per step:

1. **`customer.subscription.updated` (status=`active`)**, `created = T0`
   → `subscriptionStatus = active`, `lastBillingEventAt = T0`.
2. **`customer.subscription.updated` (status=`past_due`)**, `created = T2` (newer)
   → maps to `past_due`; `T2 > T0` so it applies →
   `subscriptionStatus = past_due`, `lastBillingEventAt = T2`. Gate = banner.
3. **`invoice.payment_succeeded`**, `created = T1` where **`T1 < T2`** (older than
   the downgrade) → the recovery flip's `where` includes
   `lastBillingEventAt < T1`; since stored `T2 > T1`, **0 rows match** → **no
   flip**. Salon **stays `past_due`**.

Expected final DB state:
```text
subscriptionStatus  = past_due      (NOT flipped back to active by the stale invoice)
lastBillingEventAt  = T2            (NOT moved backwards to T1)
gate decision       = banner:past_due  (full access + "update your card")
```

> This is the dangerous out-of-order case the guard exists for, run in the safe
> direction (the stale *recovery* can't un-do a fresher downgrade). The symmetric
> case — a stale `invoice.payment_failed` arriving after a fresh recovery — is the
> same mechanism and is asserted by the existing webhook unit tests
> (`tests/` freshness-guard cases).

If you do not have a helper/business handy, the **minimum proof** is the unit-test
suite for the route, which encodes exactly this ordering:
```bash
pnpm test -- stripe
# EXPECT: freshness-guard tests pass (stale downgrade rejected, stale recovery rejected).
```

---

## 4. Renewal via Test Clock — monthly invoice keeps salon active

Goal: prove a real subscription renewal (`invoice.paid`) on the SAL plan keeps the
salon `active` and advances `lastBillingEventAt`.

```bash
# 4a. Create a test clock anchored "now".
stripe test_helpers test_clocks create --frozen-time $(date +%s)
#   -> note: tclock_…

# 4b. Create a customer on that clock, stamped with a real businessId so the
#     webhook can resolve the salon (the route reads metadata.businessId).
stripe customers create \
  --test-clock tclock_… \
  -d "metadata[businessId]=<BUSINESS_ID>"
#   -> note: cus_…

# 4c. Attach a working test card (PaymentMethod) and set it as default.
stripe payment_methods create --type card -d "card[token]=tok_visa"
#   -> note: pm_…
stripe payment_methods attach pm_… -d customer=cus_…
stripe customers update cus_… -d "invoice_settings[default_payment_method]=pm_…"

# 4d. Subscribe to the SAL MONTHLY price (lookup_key sal_monthly_497). Resolve the
#     price id first, and stamp businessId on the SUBSCRIPTION metadata so it rides
#     every invoice (matches subscription_data.metadata.businessId in checkout).
stripe prices list --lookup-keys sal_monthly_497   # -> price_…  ($497/mo)
stripe subscriptions create \
  --customer cus_… \
  -d "items[0][price]=price_…" \
  -d "metadata[businessId]=<BUSINESS_ID>"
#   -> note: sub_…
```

Expected after 4d (initial cycle): `customer.subscription.created` +
`invoice.payment_succeeded`/`invoice.paid` fire →
`subscriptionStatus = active`, `subscriptionTier` unchanged here (it's `pro` only
via checkout), `stripeSubscriptionId = sub_…`, `lastBillingEventAt = T(initial)`.

```bash
# 4e. Advance the clock one month to force the renewal invoice.
stripe test_helpers test_clocks advance tclock_… --frozen-time $(date -v+1m +%s)
#   (Linux: --frozen-time $(date -d '+1 month' +%s))
```

Expected on advance:
- Events: `invoice.created` → `invoice.finalized` → `invoice.paid` /
  `invoice.payment_succeeded` for the new period; status stays `active`.
- **DB:** `subscriptionStatus = active` (the recovery handler finds it already
  `active`, so the second `updateMany` bumps the watermark), and
  **`lastBillingEventAt` advances** to the renewal event's `created`.
- **Gate:** `allow` (no banner).

Verify:
```bash
pnpm stripe:business-billing --business <BUSINESS_ID>
# EXPECT: status=active, lastBillingEventAt advanced vs the pre-advance value.
```

---

## 5. Failed invoice → `past_due` (banner) → recovery → `active`

Goal: exercise the downgrade + non-blocking banner, then the deterministic
recovery flip.

```bash
# 5a. New customer on a fresh test clock, default card = the "charge fails on
#     RECURRING attempt" test card. This card succeeds initial setup but FAILS the
#     renewal charge.
stripe test_helpers test_clocks create --frozen-time $(date +%s)   # -> tclock2_…
stripe customers create --test-clock tclock2_… -d "metadata[businessId]=<BUSINESS_ID>"   # -> cus2_…
stripe payment_methods create --type card \
  -d "card[number]=4000000000000341" -d "card[exp_month]=12" \
  -d "card[exp_year]=2030" -d "card[cvc]=123"                       # -> pm2_…
stripe payment_methods attach pm2_… -d customer=cus2_…
stripe customers update cus2_… -d "invoice_settings[default_payment_method]=pm2_…"

stripe subscriptions create --customer cus2_… \
  -d "items[0][price]=price_…(sal_monthly_497)" \
  -d "metadata[businessId]=<BUSINESS_ID>"                           # -> sub2_…

# 5b. Advance one month to trigger the recurring charge → it FAILS.
stripe test_helpers test_clocks advance tclock2_… --frozen-time $(date -v+1m +%s)
```

Expected after 5b:
- Events: `invoice.payment_failed` (and Stripe moves the sub to `past_due`,
  emitting `customer.subscription.updated → past_due`).
- **DB:** `invoice.payment_failed` handler resolves the customer-with-live-sub →
  `subscriptionStatus = past_due`, bumps `lastBillingEventAt`.
- **Gate:** `banner: past_due` → **full dashboard access retained** + "update your
  card" banner (NOT a hard lock — `past_due` never gates).

Verify:
```bash
pnpm stripe:business-billing --business <BUSINESS_ID>   # EXPECT: status=past_due
```

**Recovery — fix the card, advance, watch it flip back:**

```bash
# 5c. Replace the default card with a good one (tok_visa).
stripe payment_methods create --type card -d "card[token]=tok_visa"   # -> pm2b_…
stripe payment_methods attach pm2b_… -d customer=cus2_…
stripe customers update cus2_… -d "invoice_settings[default_payment_method]=pm2b_…"

# 5d. Pay the open invoice (or advance the clock to the next retry).
stripe invoices list --customer cus2_… --status open                  # -> in_…
stripe invoices pay in_…
#   (alternative: stripe test_helpers test_clocks advance tclock2_… --frozen-time <next-retry>)
```

Expected after 5d:
- Events: `invoice.payment_succeeded` / `invoice.paid` (+ likely
  `customer.subscription.updated → active`).
- **DB:** the recovery branch flips `past_due → active` (it only flips when
  currently `past_due`), bumps `lastBillingEventAt`.
- **Gate:** `allow` — banner gone.

Verify:
```bash
pnpm stripe:business-billing --business <BUSINESS_ID>   # EXPECT: status=active, banner cleared
```

---

## 6. Trial end

Goal: confirm a trialing salon is treated as full access (`trialing → active`) and
that trial expiry without payment lands in the non-blocking `past_due` banner, not
a hard lock.

```bash
# 6a. New customer/clock; subscribe WITH a trial and NO default card so the
#     post-trial charge has nothing to bill.
stripe test_helpers test_clocks create --frozen-time $(date +%s)   # -> tclock3_…
stripe customers create --test-clock tclock3_… -d "metadata[businessId]=<BUSINESS_ID>"  # -> cus3_…
stripe subscriptions create --customer cus3_… \
  -d "items[0][price]=price_…(sal_monthly_497)" \
  -d "metadata[businessId]=<BUSINESS_ID>" \
  -d "trial_period_days=14"                                          # -> sub3_…
```

Expected during trial:
- Events: `customer.subscription.created` with status `trialing`.
- **DB:** `mapStripeStatus(trialing) = active` → `subscriptionStatus = active`,
  `stripeSubscriptionId = sub3_…`, `lastBillingEventAt` bumped.
- **Gate:** `allow` (a trial is full access).

```bash
# 6b. Advance past the trial (15 days) to fire trial end → first charge.
stripe test_helpers test_clocks advance tclock3_… --frozen-time $(date -v+15d +%s)
```

Expected after 6b:
- Events: `customer.subscription.trial_will_end` is emitted ~3 days before end
  (informational — **not handled** by the route; no DB change, no crash). At trial
  end with no card: `invoice.payment_failed` + `customer.subscription.updated →
  past_due`.
- **DB:** `subscriptionStatus = past_due` (the standard failed-invoice path).
- **Gate:** `banner: past_due` — full access + "add a card" banner. **No hard
  lock** at trial end. (A successful first charge would instead keep it `active`.)

> Note: `customer.subscription.trial_will_end` is intentionally unhandled — it has
> no DB side effect in this codebase. Seeing it forwarded with a `[200]` and no DB
> change is the correct, expected behaviour (it hits the `default` switch arm).

---

## 7. Dispute (PLANNED FAST-FOLLOW — not yet handled)

> **Status: NOT IMPLEMENTED.** The webhook route does **not** handle
> `charge.dispute.*` events (`created` / `closed` / `funds_withdrawn` /
> `funds_reinstated`). They currently fall through the `default` switch arm: the
> route returns `200`, records the `StripeEvent`, and makes **no** DB change. There
> is no dispute model, no auto-pause, and no founder alert. This is a documented
> **fast-follow**, not a launch blocker for the beta (low dispute volume, manual
> handling via the Stripe Dashboard in the interim).

For completeness, you can still observe the current (no-op) behaviour:

```bash
stripe trigger charge.dispute.created
```

Expected **today**:
- `stripe listen` shows the event forwarded and `<-- [200]`.
- Dev server: no handler log (falls to `default`).
- **DB:** a `StripeEvent` row is written; **no** `Business`/`Payment` change.

**Fast-follow design (capture as a TODO, do NOT implement here):**
- Handle `charge.dispute.created` → flag the related `Payment`/`Business`, alert the
  founder (Telegram/email), optionally pause payouts.
- Handle `charge.dispute.closed` → reconcile won/lost; on `lost`, reflect the
  reversal on the `Payment`.
- Add `tests/` coverage mirroring the refund tests before shipping.

---

## Capture the evidence

Run sections **1–7 in order** against localhost + the `dev` schema with
`stripe listen` and `pnpm dev` both running, and **save the full terminal output**
(both the `stripe listen` pane and the dev-server pane) to a dated evidence file:

```bash
# Replace <date> with today's date, e.g. 2026-06-11
mkdir -p docs/evidence
# Paste/redirect the captured stripe-listen + dev-server output here:
#   docs/evidence/stripe-test-run-<date>.md
```

The evidence file should contain, per section:
- the **commands run** (already above),
- the **`stripe listen` lines** (`--> <event> [evt_…]` and the `<-- [200] POST …`),
- the relevant **dev-server log lines**, and
- the **before/after billing state** from `pnpm stripe:business-billing`
  (`subscriptionStatus`, `lastBillingEventAt`) proving each Expected block.

A run is **launch-passing** only if: §2 shows `{ duplicate: true }` with a single
`StripeEvent` row, §3 keeps the salon out of a stale flip, §4/§5 advance
`lastBillingEventAt` and land on the documented status, §6 never hard-locks, and §7
is noted as the fast-follow it is.

---

## package.json scripts

This runbook references convenience scripts. Add them under `"scripts"` in
`package.json` (test-mode helpers only — no runtime/src changes):

```jsonc
{
  "scripts": {
    // … existing scripts …
    "stripe:listen": "stripe listen --forward-to localhost:3000/api/stripe/webhook",
    "stripe:trigger": "stripe trigger"
  }
}
```

> `stripe:event-count`, `stripe:business-billing`, and `stripe:ooo` referenced
> above are **optional** local helpers (a tiny `tsx` script that reads the `dev`
> schema via Prisma / posts signed events). They are NOT required to capture
> evidence — every Expected block can also be verified directly in the Stripe
> Dashboard (Test mode → Events) plus a Prisma Studio (`pnpm prisma studio`) look
> at the `Business` row's `subscriptionStatus` / `lastBillingEventAt`. They are
> listed here as the documented, repeatable way to assert DB state; build them as a
> follow-up if you want one-command verification.
