# SAL Monitoring & Backups Setup

How to know when SAL breaks and be able to recover. Most of this is account
setup (no code) — do it once before inviting beta salons. Items needing a key
are tracked in `HANDOFF.md`.

## 1. Error tracking — Sentry (recommended, free tier)

SAL currently logs errors to the server console (visible in **Vercel → Logs**),
and the Stripe webhook now logs loud warnings on amount/currency mismatches and
unknown payments. That's enough to start, but a real error tracker is better.

To wire Sentry (≈10 min once you have an account):

1. Create a free project at https://sentry.io → get the **DSN**.
2. Install + run the wizard in the repo:
   ```bash
   npx @sentry/wizard@latest -i nextjs
   ```
   This adds `sentry.*.config.ts` + wraps `next.config.mjs`. Commit it.
3. Set `SENTRY_DSN` (and `NEXT_PUBLIC_SENTRY_DSN`) in **Vercel → Environment
   Variables** (Production).
4. Sentry is inert without the DSN, so this is safe to merge before the account
   exists — it just won't report until the env var is set.

> Until Sentry is wired, review **Vercel → Logs** after every deploy and watch
> for `[stripe.webhook]` error lines.

## 2. Uptime monitoring (free)

Use UptimeRobot or BetterStack (both have free tiers). Add HTTP checks for:

- `https://www.meetsal.ai` (homepage)
- `https://www.meetsal.ai/login`
- a real public booking page, e.g. `https://www.meetsal.ai/book/<a-salon-slug>`
- `https://www.meetsal.ai/api/health` (returns JSON health; alert on non-200)

Set alerts to email/SMS you. Check interval 5 min is fine for beta.

## 3. Stripe webhook health

- **Stripe Dashboard → Developers → Webhooks** → the `…/api/stripe/webhook`
  endpoint shows delivery success/failure. Check it after enabling SAL Payments.
- The webhook code logs `[stripe.webhook] … MISMATCH` / `unknown payment` on the
  dangerous branches — these will show in Vercel logs / Sentry.

## 4. Database backups — Supabase

1. **Supabase → Database → Backups.** Confirm your plan:
   - **Free**: no automated daily backups — run regular manual exports:
     ```bash
     supabase db dump -f backup-$(date +%F).sql   # store off-site
     ```
   - **Pro/Team**: daily backups are automatic — confirm they're enabled.
2. Once real salons depend on SAL, enable **Point-in-Time Recovery (PITR)** (paid
   add-on) so you can restore to any minute, not just the last daily snapshot.
3. Test a restore once into a staging project so you know the steps before you
   need them (see `docs/INCIDENT_RUNBOOK.md` §4).

## 5. Release safety (already in code)

- CI (`.github/workflows/ci.yml`) blocks merges that fail lint/type-check/tests/
  build.
- `npm run check:launch` is the pre-deploy gate (adds prod env validation).
- After each deploy, run the smoke test in `docs/RELEASE_CHECKLIST.md`.
