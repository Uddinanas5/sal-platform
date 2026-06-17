# SAL Incident Runbook

What to do when something is wrong in production. Written for a non-technical
founder — follow top to bottom. Keep this link handy.

## 0. First 2 minutes — assess

1. Is the site down or just slow? Open https://www.meetsal.ai and try to log in.
2. Check **Vercel → Deployments** — is the latest production deploy green or did
   it error?
3. Check **Vercel → Logs** (or Sentry, once set up) for a spike of errors.
4. Decide severity:
   - **SEV1** — site down, can't book, or money is moving wrong → act now.
   - **SEV2** — one feature broken, workaround exists → fix on a branch.

## 1. Roll back a bad deploy (fastest fix)

If the problem started right after a deploy:

1. **Vercel → Deployments**.
2. Find the previous **known-good** Production deployment.
3. Click **⋯ → Promote to Production**. This is instant (no rebuild) and reverts
   the live site to that version.
4. Confirm the site works again, then investigate the bad deploy on a branch.

> Rolling back code does NOT roll back the database. If a bad deploy also ran a
> migration, see §4.

## 2. Pause payments (if money is at risk)

SAL Payments (client→salon) runs through Stripe. To stop charges immediately:

1. **Stripe Dashboard** → toggle the affected connected account / or disable the
   payment surface by rolling back to a deploy where online card payment is off
   (it is off by default in beta).
2. In SAL, the POS "Card" and gift-card methods are already disabled for beta —
   only cash recording is active, so there is usually nothing to pause there.
3. If a specific charge is wrong, refund it from the **Stripe Dashboard** (SAL
   does not yet issue refunds in-app — see HANDOFF.md).

## 3. Contact affected salons

1. Open your **private beta-salon contact list** (keep names, emails, phone
   numbers — see §6).
2. Send a short, honest message: what's affected, that you're on it, and an ETA.
3. For SEV1, call them — don't rely on email.

## 4. Restore / fix the database

1. **Supabase → Database → Backups.** Confirm the most recent backup time.
2. If data was lost/corrupted: use **Point-in-Time Recovery** (paid plans) or
   restore the latest daily backup. Do this in a staging project first if
   possible.
3. If a migration went wrong: do NOT re-run it blindly. Check
   `prisma/migrations/` for what changed, and restore from backup if needed.
4. After any restore, re-run the verification in §5.

## 5. Verify recovery

Run the smoke test from `docs/RELEASE_CHECKLIST.md`:
- Load homepage + log in.
- Open a public booking link → book → confirmation email arrives.
- Appointment shows on the dashboard. Cancel it.

If all pass, the incident is resolved. Post a short "all clear" to affected
salons.

## 6. Keep these ready BEFORE an incident

- A private list of beta-salon **names + emails + phone numbers**.
- Login access to: **Vercel**, **Supabase**, **Stripe**, **Resend**, and (once
  set up) **Sentry** + the uptime monitor.
- This runbook bookmarked.

## 7. Chargebacks (disputes) — what to do when a client disputes a payment

**The policy (founder-approved, industry standard):** the SHOP bears a lost
chargeback — the same as Fresha, Square, Booksy, Vagaro, GlossGenius, Mindbody,
Toast and Shopify. The $15 Stripe dispute fee is refunded to the shop if they
win, and is **waived entirely during beta** (we only record it; nothing is
auto-charged).

**How money actually moves (why SAL must act):** SAL uses Connect *destination
charges*, so when a dispute opens, Stripe debits the disputed amount (+ $15
fee) from **SAL's platform balance** — even though the salon already received
the money. If the dispute is lost, SAL recovers the amount from the salon
(below). If it's won, Stripe returns the funds to SAL and nothing is owed.

### 7a. When the dispute OPENS (you get an ALERT_EMAIL + the salon sees a red banner)

1. Open **Stripe Dashboard → Payments → Disputes** and find the dispute.
2. Note the **evidence deadline**. Disputes with no response are almost always
   lost — treat the deadline as hard.
3. Contact the salon owner (the dashboard banner already tells them). Help them
   gather evidence: the appointment record, client booking confirmation,
   cancellation-policy consent, any messages with the client.
4. Submit the evidence **in the Stripe Dashboard** (Counter dispute → upload
   evidence) before the deadline. v1 has no in-app evidence flow — Stripe's
   form is the tool.

### 7b. If the dispute is LOST — recover the money from the salon (manual transfer reversal)

The disputed amount left SAL's balance; the salon still has it. Recovery v1 is
a **manual transfer reversal** (auto-netting from future payouts is a planned
follow-up, not built yet):

1. In **Stripe Dashboard**, open the disputed payment (Payments → the charge).
2. On the payment page, find the **Transfer** to the salon's connected account
   (destination charge → there is exactly one, `tr_...`).
3. Open the transfer and click **Reverse transfer**. Reverse **only the
   disputed amount** (a partial reversal if the transfer was larger).
   - This pulls the funds back from the connected account's balance to SAL.
   - If the connected account balance is insufficient, Stripe debits the
     salon's bank account on file (debit agreement is part of Express
     onboarding).
4. Record it: note the dispute id, charge id, transfer id, amount and date in
   the founder log. The `disputes` table row (status `lost`) is the system of
   record for WHICH disputes were lost; the reversal itself lives in Stripe.
5. Tell the salon owner it happened — they already saw the banner; close the
   loop with the final amount.
6. The $15 fee: **waived during beta** — do nothing. Post-beta: refund it to
   the salon only if they WIN (the fee fields are already recorded per dispute
   in the `disputes` table).

### 7c. If the dispute is WON

Nothing to recover. Stripe returns the disputed amount to SAL's balance, the
webhook restores the payment to `completed`, and the red banner clears on its
own. Tell the salon the good news.

## Severity → action quick table

| Symptom | First action |
|---|---|
| Site down after a deploy | Roll back (§1) |
| Errors but site up | Check logs/Sentry, fix on a branch |
| Wrong charge / money moving | Pause payments (§2) + refund in Stripe |
| Client disputed a payment | Respond with evidence (§7a); if lost, reverse the transfer (§7b) |
| Data missing/corrupted | Restore DB (§4) |
| Emails not sending | Check Resend dashboard (bounces, domain status) |
