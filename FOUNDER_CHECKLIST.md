# SAL — Founder Checklist (post-launch, 2026-06-06)

The unified, hardened SAL platform is **deployed to production** (www.meetsal.ai) and
healthy. Everything below is a task only **you** can do — code can't (accounts, DNS,
keys, billing decisions). Nothing here blocks the app from running today; each item
unlocks or improves a specific capability.

## Money is SAFE by default right now
- **No salon will be charged.** Subscription billing ($1,500 setup + $497/mo) is built
  but runs in **Stripe TEST mode** until you verify Stripe (item 4). Beta salons can be
  flagged `billingExempt` so they're never gated.
- **Online card payments are OFF** at checkout (cash + gift card only) until Stripe is live.
- **SMS is OFF** (email only) — no SMS provider wired.

## Do these when you can (rough priority)

1. **Verify the email domain in Resend** — add 3 DNS records (SPF, DKIM, DMARC) for
   `meetsal.ai`. *Until this, confirmation / reminder / review emails may not deliver
   reliably.* Then confirm `EMAIL_FROM` in Vercel is a verified `@meetsal.ai` sender.

2. **Create `support@meetsal.ai`** and monitor it — it's the address the app points
   clients/salons to, and where account-deletion requests are sent.

3. **(Recommended) Upgrade Vercel to Pro (~$20/mo).** The account is on Hobby, which
   only allows a **once-daily** automated job — so appointment reminders currently send
   **once a day** (the day-before nudge). On Pro you get the every-15-minutes job back
   (day-before **and** 2-hours-before reminders). After upgrading, tell me and I'll flip
   two settings (`REMINDER_CADENCE=frequent` + the cron back to every-15-min). Easily
   worth it for a $497/mo product.

4. **Stripe: complete identity/business verification + enable Connect.** Required before
   you can (a) charge salons the subscription and (b) let salons take client card
   payments. Once verified, confirm the live Stripe keys are in Vercel Production. The
   code auto-creates the $1,500 + $497/mo prices on first checkout — just confirm pricing.

5. **Confirm final pricing** — code is wired to **$1,500 one-time setup + $497/mo**. Say
   the word if that changed.

6. **Create a free Sentry project** → give me the DSN and I'll wire error tracking.

7. **Add an uptime monitor** (UptimeRobot/BetterStack, free) pointed at
   `https://www.meetsal.ai/api/health`.

8. **Confirm Supabase backups** — enable daily backups (Pro) or schedule exports. A fresh
   pre-launch snapshot was taken into the `prelaunch_backup_20260606` schema; the older
   `cleanup_backup_20260605` snapshot also exists.

9. **Lawyer skim of Terms §6** — it was rewritten from "free" to describe the real
   $1,500 + $497/mo subscription + cancellation policy. Flagged in `src/app/terms/page.tsx`.

## What shipped in this release (high level)
Unified two diverged codebases + finished every feature: real email campaigns, automated
birthday/win-back messages, membership plans, gift-card issue + checkout redemption,
recurring appointments, subscription billing, client data export/delete. Fixed a critical
timezone bug, made checkout/reports/commissions reconcile to the real money ledger, closed
several access-control + "fake button" issues, and proved under live load that
**double-booking is impossible** (10/25/50 simultaneous same-slot bookings → exactly one
wins). 391 automated tests pass; database upgrade rehearsed against a copy of the live DB
before applying.

_Rollback: git tag `prod-deploy-20260606`; DB snapshot `prelaunch_backup_20260606`._
