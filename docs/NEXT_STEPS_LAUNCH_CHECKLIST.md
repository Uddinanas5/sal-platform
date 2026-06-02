# SAL Next Steps Launch Checklist

Reviewed: 2026-06-02

This checklist is written for a non-technical founder. It separates what is already working from what must happen before SAL is sold as a real SaaS.

## Plain-English Verdict

SAL is no longer at the "does it even deploy?" stage. The core app is live on Vercel, production environment variables are present, email is working, public booking has been smoke-tested, and Stripe live keys/webhook are configured.

SAL is not yet ready to invite paying salons without guardrails. The next work is mostly launch readiness: Stripe Connect activation, salon subscription billing, production monitoring, legal/support basics, and deciding which unfinished features stay hidden during beta.

## Current Confirmed Status

- `www.meetsal.ai` is hosted on Vercel.
- Vercel Production has the required app/auth/database/email/Stripe environment variables.
- Stripe webhook is configured for `https://www.meetsal.ai/api/stripe/webhook`.
- Stripe payment intents on `main` route payments to connected salon accounts when the salon has an active SAL Payments account.
- SAL Payments branding is merged into `main`; salons see "Activate SAL Payments" instead of raw Stripe Connect wording.
- Email via Resend has been tested by the user and delivered.
- Public booking has been tested with a fake salon/client flow.
- SMS is intentionally not ready and should remain hidden/disabled.

## Launch Phases

### Phase 1: Controlled Beta Without Payments

Goal: Get 1-3 friendly salons using SAL for real scheduling and email confirmations, but do not promise online payments or SMS yet.

Checklist:

- Pick 1-3 beta salons that understand this is an early beta.
- Create each salon account manually or through the normal register/onboarding flow.
- Set up business hours, staff, services, and booking link for each salon.
- Run a full booking smoke test for each salon:
  - client opens public booking link
  - picks service/staff/date/time
  - submits booking
  - salon sees appointment in dashboard
  - client receives confirmation email
  - salon cancels/reschedules once
  - client uses manage booking link once
- Keep SMS off.
- Keep online client payment collection off until Connect is fully approved and tested.
- Tell beta salons: "Use SAL for scheduling and email confirmations first. Payments/SMS are coming after beta validation."

Owner: Founder + Codex.

Status: Ready to begin after final live smoke test.

### Phase 2: SAL Payments

Goal: Let salons accept client payments through SAL Payments, powered by Stripe Connect.

Checklist:

- Founder completes Stripe identity/business verification.
- Founder enables Stripe Connect on the live Stripe account.
- Codex re-tests `Activate SAL Payments` from a real SAL salon account.
- Confirm a connected salon account can be created.
- Confirm webhook `account.updated` marks the business `stripeAccountStatus = active`.
- Confirm the payment checkout refuses payment when the salon is not connected.
- Confirm a test payment routes funds to the connected salon account, not SAL's platform balance.
- Decide whether SAL charges an application/platform fee on client payments.
- If yes, add `application_fee_amount` policy and surface this clearly in Terms.
- Decide payout/refund/dispute wording for salons.

Owner: Founder must complete Stripe verification. Codex can wire/test after that.

Status: Blocked on Stripe Connect activation.

Research basis:

- Stripe Connect is designed for platforms that onboard connected accounts, route payments, and manage payouts: https://docs.stripe.com/connect/how-connect-works
- SAL's current technical direction matches Stripe destination-charge style routing through `transfer_data.destination`: https://docs.stripe.com/connect/destination-charges

### Phase 3: SAL Subscription Billing

Goal: Salons pay SAL monthly for using the software.

Important distinction:

- SAL Payments: salon's clients pay the salon for appointments.
- SAL Billing: salons pay SAL for the software subscription.

Current gap:

- The database has `subscriptionTier` and `subscriptionStatus`.
- The settings screen shows a hardcoded-looking `$49/month Pro Plan`.
- There is no complete Stripe Billing/Checkout/Customer Portal flow for salon subscriptions on `main`.

Checklist:

- Choose simple launch pricing:
  - Free beta, no card required, or
  - $49/month after beta, or
  - two tiers only: Starter and Pro.
- Create Stripe Products/Prices for SAL subscriptions.
- Add Stripe Checkout route for salon subscription signup.
- Add Stripe Customer Portal route so salons can update card/cancel/download invoices.
- Add subscription webhook handling:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`
- Store Stripe customer/subscription IDs on `Business`.
- Gate paid features using `subscriptionStatus`.
- Add trial/grace-period behavior.
- Replace any hardcoded billing UI with real plan state.
- Add admin instructions for manually comping beta salons.

Owner: Codex can build; founder must decide pricing.

Status: Not built.

Research basis:

- Stripe Billing supports fixed-price subscriptions with Checkout: https://docs.stripe.com/billing/subscriptions/set-up-subscription
- Stripe Customer Portal lets customers manage payment methods, invoices, and subscriptions: https://docs.stripe.com/billing/subscriptions/integrating-customer-portal

### Phase 4: Email Reliability

Goal: Emails consistently land in inboxes for real salons and clients.

Checklist:

- Confirm Resend domain is verified.
- Confirm SPF and DKIM are passing.
- Add DMARC DNS record if not already present.
- Send tests to Gmail, Outlook, iCloud, and business domain emails.
- Check Resend bounces/complaints after beta starts.
- Make email copy simple and non-spammy.
- Add a support reply-to address such as `support@meetsal.ai`.
- Make sure password reset, invitation, appointment confirmation, reschedule, cancellation, and receipt emails all send.

Owner: Founder can handle DNS/account access. Codex can test app flows.

Status: Basic email works; deliverability checklist still needed.

Research basis:

- Resend recommends verified domains using SPF/DKIM and optionally DMARC for trust: https://resend.com/docs/dashboard/domains/introduction
- Resend DMARC guide: https://resend.com/docs/dashboard/domains/dmarc

### Phase 5: SMS Later, Not Now

Goal: Add SMS only after legal/compliance setup is ready.

Current gap:

- SAL has SMS-related UI/data concepts in places, but no real Twilio sender is wired up on `main`.
- `main` correctly forces receipt channel to email only in payment settings.

Checklist:

- Do not advertise SMS during beta.
- Do not let salons send marketing SMS until consent/compliance is complete.
- Pick provider, likely Twilio.
- Create paid Twilio account.
- Buy/register phone number or messaging service.
- Register A2P 10DLC Brand/Campaign for US SMS.
- Add opt-in language to booking forms.
- Add STOP/HELP handling.
- Add per-client SMS consent audit trail.
- Add SMS templates for appointment reminders only before marketing SMS.
- Add delivery logs and failure handling.

Owner: Founder for Twilio/business registration. Codex for integration.

Status: Not ready.

Research basis:

- Twilio says US app-to-person SMS over 10DLC requires A2P 10DLC registration and consent-based messaging: https://www.twilio.com/docs/messaging/compliance/a2p-10dlc
- Twilio currently warns campaign reviews can take 10-15 days: https://www.twilio.com/docs/messaging/compliance/a2p-10dlc/quickstart

### Phase 6: Production Safety

Goal: Know when something breaks, recover data, and avoid silent failures.

Checklist:

- Add uptime monitoring for:
  - homepage
  - login
  - public booking page
  - Stripe webhook health behavior
- Add error tracking, for example Sentry.
- Add Vercel log review habit after each deploy.
- Add Stripe webhook failure monitoring.
- Confirm Supabase backup plan.
- If production is on Supabase Free, export backups regularly.
- If production is on Supabase Pro/Team/Enterprise, confirm daily backups in Dashboard.
- Consider Point-in-Time Recovery once real salons rely on SAL.
- Create a simple incident checklist:
  - how to pause payments
  - how to roll back Vercel
  - how to contact affected salons
  - how to restore database if needed
- Add `check:launch` script to `main`; it exists in a local branch but not currently on `main`.
- Make `pnpm test`, `pnpm lint`, `pnpm build`, and env validation part of every release.

Owner: Codex can set most of this up. Founder needs access to accounts and willingness to pay for monitoring/backups if needed.

Status: Partially ready; needs launch hardening.

Research basis:

- Vercel environment variables are scoped by Production/Preview/Development, which matters for preview testing: https://vercel.com/docs/projects/environment-variables
- Supabase provides backups by plan and recommends CLI exports/off-site backups for free projects; PITR is available as an add-on for paid projects: https://supabase.com/docs/guides/platform/backups

### Phase 7: Legal, Trust, and Support

Goal: Be trustworthy enough for beta salons.

Checklist:

- Review Terms of Service.
- Review Privacy Policy.
- Add clear cancellation/refund policy for SAL subscription fees.
- Add SAL Payments wording if platform fees are charged.
- Add data deletion/export process.
- Add support inbox.
- Add simple support SLA for beta, for example "we respond within 1 business day."
- Add visible contact/support link in app.
- Create a private list of beta salon contacts and urgent phone/email fallback.
- Make sure salons understand SAL is not providing legal/tax/accounting advice.

Owner: Founder, ideally with lawyer review before public paid launch.

Status: Needs founder review.

### Phase 8: Product Scope for Beta

Goal: Avoid demoing half-finished features.

Keep enabled for beta:

- Registration/login/password reset.
- Onboarding.
- Services.
- Staff.
- Business hours.
- Public booking.
- Dashboard calendar.
- Clients.
- Email confirmations.
- Checkout/manual payments if stable.
- SAL Payments only after Stripe Connect works.

Hide, disable, or label as beta:

- SMS.
- Marketing SMS.
- Advanced memberships/packages if not fully tested.
- Gift cards if redemption/accounting is not fully tested.
- MCP/API public claims unless intentionally launching developer integrations.
- Any feature backed by mock data.

Owner: Codex.

Status: Needs one more UI audit pass.

## Fresha/Salon Workflow Gaps

These are not all launch blockers, but they matter for salon credibility.

### P1: Staff Breaks and Time Blocks

Finding:

- Main has UI state for staff breaks (`hasBreak`, `breakStart`, `breakEnd`).
- The server/action side needs a focused verification/fix so breaks persist and display correctly.
- Salons also need one-off time blocks like "dentist 2-3pm today."

Why it matters:

- A salon calendar must match real availability.
- If a salon owner thinks lunch is blocked but clients can still book it, trust dies fast.

Next:

- Fix/verify staff break persistence.
- Add ad-hoc time blocks.
- Render unavailable blocks on calendar.

### P1: Front Desk Workflow

Finding:

- Appointment status exists.
- Detail sheet status changes exist.
- Calendar needs faster front-desk interactions: quick status chip, late detection, today panel.

Why it matters:

- A receptionist should check clients in quickly without opening full detail sheets.

Next:

- Add status quick-action on appointment cards.
- Add "running late" detection.
- Add today/front-desk panel.

### P1: Recurring Appointments

Finding:

- Recurring appointments exist, but need stronger edit modes.

Why it matters:

- Salons rely on standing appointments.

Next:

- Add "this appointment only", "this and following", "all in series."
- Track modified instances.

### P2: Cancellation Reasons

Finding:

- SAL should distinguish client-cancelled, business-cancelled, and no-show.

Why it matters:

- Needed later for no-show fees, reports, and retention insights.

Next:

- Add structured cancellation initiator and reason codes.

## Founder To-Do List

Do these first:

1. Complete Stripe identity/business verification.
2. Decide launch pricing:
   - free beta, or
   - paid beta, or
   - free trial then paid.
3. Decide whether SAL takes a percent/platform fee on salon client payments.
4. Create or confirm `support@meetsal.ai`.
5. Confirm Resend DNS records and add DMARC if missing.
6. Pick 1-3 friendly beta salons.
7. Decide if SMS is a launch promise. Recommendation: no.
8. Review Terms/Privacy at a plain-English level, then lawyer review before paid public launch.

## Codex To-Do List

Recommended order:

1. Add/restore launch safety script to `main`.
2. Add missing production release checklist command.
3. Build SAL subscription billing.
4. Add monitoring/error tracking.
5. Verify/repair staff break persistence.
6. Add one-off time blocks.
7. Run final beta salon smoke test.
8. Prepare beta onboarding guide.
9. Build Stripe Connect live smoke test after founder verification is complete.
10. Harden any exposed beta surfaces.

## Final Go/No-Go Checklist

Do not invite paying salons until every P0 item is checked:

- Production build passes.
- Tests pass.
- Env validation passes.
- Public booking works on production.
- Email works on production.
- Login/register/password reset work on production.
- At least one full fake salon smoke test passes.
- Support inbox exists.
- Terms and Privacy are reviewed.
- SMS is hidden or disabled.
- SAL subscription billing is either built or beta is explicitly free.
- SAL Payments are either fully tested or clearly disabled.
- Backups are confirmed.
- Rollback plan exists.
- Founder knows how to contact beta salons if something breaks.

## Recommended Next Move

Start with this sequence:

1. Founder completes Stripe verification when ready.
2. Codex restores `check:launch` and adds a production readiness command on `main`.
3. Codex builds SAL subscription billing or marks beta as free-only.
4. Codex verifies staff breaks because that is a high-trust calendar issue.
5. Founder recruits 1-3 beta salons.

This gets SAL into real usage without over-promising payments, SMS, or advanced salon automation before they are safe.
