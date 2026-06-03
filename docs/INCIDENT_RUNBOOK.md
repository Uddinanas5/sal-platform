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

## Severity → action quick table

| Symptom | First action |
|---|---|
| Site down after a deploy | Roll back (§1) |
| Errors but site up | Check logs/Sentry, fix on a branch |
| Wrong charge / money moving | Pause payments (§2) + refund in Stripe |
| Data missing/corrupted | Restore DB (§4) |
| Emails not sending | Check Resend dashboard (bounces, domain status) |
