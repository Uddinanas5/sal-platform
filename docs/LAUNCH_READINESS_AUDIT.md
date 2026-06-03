# SAL Launch-Readiness Audit

**Date:** 2026-06-02 · **Scope:** `origin/main` @ `586f03d` · **Production:** https://www.meetsal.ai

## How this was produced

Two independent multi-agent review fleets swept the codebase against the founder's 12-phase launch plan:

1. A **code-verified plan audit** (8 phase-clusters → 94 items, each given a real status: works / partial / missing / fake-or-broken).
2. A **security & correctness review** (8 dimensions → 61 confirmed findings).

**Every flagged item was re-checked by a second adversarial agent** before inclusion — both to disprove false alarms and to catch "looks fine" claims that weren't. The two fleets ran blind to each other and **agreed on the major findings** (fake gift cards, the Stripe dashboard-link leak, half-finished double-booking protection, the dangerous seed script), which is why confidence is high.

Type-check and production build both pass clean on `origin/main`.

---

## Plain-English verdict

**The core is real and trustworthy — the risk is everything bolted around it that *looks* real but isn't.** Sign-up, salon setup, the public booking page, confirmation emails, and cancel all genuinely work against the live database, with proper protection against two clients grabbing the same slot. But a ring of **fake "money" features** (a checkout *Card* button that says "Payment Complete" without charging anyone; gift cards that take money and record nothing; a fake $49/mo billing tab; fake membership plans) and a few **broken buttons** (the calendar *Reschedule* button confirms a move but leaves the booking where it was) violate the #1 rule: *nothing visible should lie.*

Fix/hide that short list and a **no-payments beta is days away.**

## The key strategic call: a no-payments beta neutralizes ~80% of the critical findings for free

Almost every *severe* finding lives in **money + advanced features**: gift cards, tax/tip trust, inventory, online card charging, the Stripe cross-tenant leak, OAuth/API exposure, subscription billing. **For a scheduling-only beta, none of these need to be *fixed* — they need to be *turned off.*** Hiding the not-ready surface is a small, safe change; fixing it all is weeks of work that paid launch (not beta) requires.

| | No-payments beta (Phase 1–2) | Taking real money (Phase 3–4) |
|---|---|---|
| Strategy | **Hide / disable** the not-ready surface | **Build & harden** properly |
| Effort | Small — 1–2 PRs | Large — multi-week |

---

## 12-Phase scorecard

| Phase | Status | One-line |
|---|---|---|
| 1 · Core flows | 🟡 | Real end-to-end **except** the calendar Reschedule button lies (P0). |
| 2 · Beta recruit | 🟡 *(founder)* | Operational — line up salons + contact list. |
| 3 · SAL Payments | 🔴 | Backend is excellent; charge UI is orphaned, POS "Card" is fake, dashboard-link leaks across tenants. |
| 4 · SAL Billing | 🔴 | Essentially not built; the visible $49 tab is a mockup. |
| 5 · Email | 🟡 | 6 transactional emails really send; from-domain unowned, no reply-to, "campaigns/reminders" don't send. |
| 6 · SMS off | 🟢 | SMS correctly disabled everywhere. |
| 7 · Monitoring/backups | 🟡 | Health endpoint + env script + 2 tests exist; no alerting, CI, backups, or runbooks. |
| 8 · Legal/trust/support | 🟡 | Terms/Privacy are real but Terms says "free"; delete/export + support are dead stubs. |
| 9 · Fake-feature cleanup | 🔴 | A cluster of money/engagement features render as working and do nothing. |
| 10 · Workflow polish | 🟡 | Engine is solid; breaks/recurring UI saves nothing. |
| 11 · Feedback loop | 🟡 *(founder)* | Operational. |
| 12 · Launch safety | 🔴 | `check:launch` not on main; no CI gate. |

## Founder action items (non-code)

- **Stripe:** complete identity/business verification; decide on a per-transaction platform fee; one live test charge once the UI is wired.
- **Pricing:** decide final SaaS pricing (the in-app $49 vs the $497 offer) — blocks real billing going live.
- **Email/DNS:** in Resend, add + verify **meetsal.ai** (SPF/DKIM) and set DMARC; confirm `EMAIL_FROM` matches the verified sender.
- **Support:** create + monitor **support@meetsal.ai** before any beta salon.
- **Monitoring:** create free **Sentry** + **uptime monitor** accounts.
- **Backups:** confirm the Supabase plan + enable daily backups; keep a private beta-salon contact list.
- **Legal:** lawyer review of Terms/Privacy — especially the "free of charge" clause and a subscription refund/cancellation policy.

---

## How to read the list below

- Items are **action items only** — confirmed-working flows are listed separately at the end as the "trustworthy core."
- Status: 🚫 fake/broken · ⬜ missing · 🟨 partial · 👤 founder-action.
- `[Cluster]` maps to the plan phase. ⚖️ marks where the adversarial verifier *corrected* the first reviewer (trust these — the rigor caught a mistake in either direction).

## P0 — Must fix before ANY salon uses SAL (7 action items)

- [ ] 🟨 partial · **[Core flows & launch safety]** reschedule flow (dashboard/staff-side)
    - **Where:** `appointments.ts:267-416 rescheduleAppointment: getBusinessContext scoping (282), shifts all service rows by delta (304-319), $transaction with per-sta`
    - **Plain:** The salon can reschedule an appointment from the dashboard and it re-checks conflicts and working hours and emails the client.
    - **Fix:** No action needed for the staff-side flow.
    - ⚖️ CORRECTED: The auditor only examined ONE of three dashboard reschedule entry points. The drag-to-reschedule path is genuinely real and well-built: src/app/(dashboard)/calendar/client.tsx:400 calls rescheduleAppointment (appointments.ts:267-416), which scopes b

- [ ] 🚫 fake/broken · **[Email reliability]** From address correct + reply-to / support@meetsal.ai configured
    - **Where:** `src/lib/email.ts:25 — `from: process.env.EMAIL_FROM || "SAL Platform <noreply@salplatform.com>"`. .env.example:57 defaults `EMAIL_FROM="SAL <noreply@s`
    - **Plain:** Emails are sent from a domain SAL does not own (salplatform.com or sal.app), not meetsal.ai — Resend will refuse to send unless that domain is verified, and there is no reply-to so any client who hits Reply gets nothing. Confirmation emails are also sent from SAL's address rather than the salon's, so a client replying to confirm/cancel reaches no one.
    - **Fix:** P0: Set EMAIL_FROM in Vercel prod to a verified meetsal.ai sender (e.g. 'SAL <noreply@meetsal.ai>') and change the code fallback in email.ts off salplatform.com. Add a `reply_to` param to sendEmail (use support@meetsal.ai globally, OR the salon's own business.email on client-facing booking emails so replies reach the salon). DNS verification of meetsal.ai in Resend is founder_action.

- [ ] 👤 founder · **[Email reliability]** DNS / SPF / DKIM / DMARC for sending domain
    - **Where:** `Not code-verifiable. Sending domain is whatever EMAIL_FROM resolves to (currently salplatform.com/sal.app in code defaults, must become meetsal.ai). R`
    - **Plain:** For emails to actually land in inboxes (not spam), the meetsal.ai domain must be verified in Resend with DNS records — this is a dashboard/DNS task, not something in the code.
    - **Fix:** Founder: in Resend, add and verify meetsal.ai (add the SPF/DKIM TXT/CNAME records they provide to your DNS), then set a DMARC policy. Confirm the verified sender matches whatever EMAIL_FROM is set to in Vercel.

- [ ] 🚫 fake/broken · **[SAL Payments (Stripe Connect)]** Online card payment actually wired into product (StripePayment UI rendered)
    - **Where:** `The real Connect charge UI is src/components/checkout/stripe-payment.tsx (StripePayment) — the ONLY caller of /api/stripe/create-payment-intent. Grep `
    - **Plain:** All the Stripe 'take a real card payment' code exists but is not connected to any screen — there is no place in the live app where a salon's client can actually pay by card online.
    - **Fix:** Decide the intended flow (in-person POS card-present vs online deposit at booking), render StripePayment there, and rely on the webhook to finalize. Until then do not advertise online card payments to beta salons.

- [ ] 🚫 fake/broken · **[SAL Payments (Stripe Connect)]** In-app POS 'Card' button records a completed payment with no real charge
    - **Where:** `src/components/checkout/payment-dialog.tsx:121-132 calls processPayment({method: paymentMethod}) where paymentMethod can be 'card'. src/lib/actions/ch`
    - **Plain:** When a salon clicks 'Card' at checkout, the app says 'Payment Complete' and books the revenue in reports, but no card was actually charged anywhere. An owner could believe they got paid when they didn't.
    - **Fix:** Either relabel 'Card' as 'Card (external terminal) — mark as paid' so it's clearly a manual record, or wire the Card/Online path to the real Stripe flow. Resolve before any beta salon.

- [ ] 🟨 partial · **[SAL Payments (Stripe Connect)]** Payment routes to connected account, not SAL's platform balance
    - **Where:** `src/lib/stripe.ts:40-58 createPaymentIntent passes `transfer_data:{destination: connectedAccountId}` when a connected account is provided; create-paym`
    - **Plain:** When the online-payment path runs, the customer's money is correctly directed to the salon's own Stripe account, not SAL. (Caveat: only fires once the orphaned UI is connected.)
    - **Fix:** No change to routing. Verify with a live test that funds land in the connected account. Decide separately on a platform fee.
    - ⚖️ CORRECTED: The auditor's NARROW technical claim is correct, but the overall "works" status is wrong; the truth is "partial." WHAT'S CORRECT (auditor right): src/lib/stripe.ts:47-53 conditionally adds transfer_data:{destination: connectedAccountId}, and create-

- [ ] 🚫 fake/broken · **[SAL Payments (Stripe Connect)]** Stripe dashboard link for connected salons
    - **Where:** `src/app/api/stripe/dashboard-link/route.ts:12-22 takes `accountId` straight from the request body and calls createDashboardLink(accountId) after only `
    - **Plain:** The 'Open payment dashboard' button works for the owner, but any logged-in user who knows/guesses another salon's Stripe account ID can get a login link into that other salon's payment dashboard — a serious cross-tenant leak.
    - **Fix:** P0 fix: ignore the client-supplied accountId; load the caller's business server-side (getBusinessContext/session), read business.stripeAccountId, and create the login link only for that, rejecting any mismatch.


## P1 — Before public / paid launch (35 action items)

- [ ] ⬜ missing · **[Core flows & launch safety]** launch safety command: check:launch script + scripts/launch-safety-check.mjs on main
    - **Where:** `package.json scripts: dev/build/postinstall/start/lint/check:env/test/test:watch - NO check:launch. scripts/ contains ONLY validate-env.mjs - NO launc`
    - **Plain:** The single "is the app safe to launch" command the checklist refers to does not exist in the deployable code - only an env-var checker (check:env) is present.
    - **Fix:** Port check:launch and scripts/launch-safety-check.mjs from the local branch onto main, or document the gate as `npm run check:env && npm run lint && npm run test && npm run build`. Don't rely on a script that isn't on main.

- [ ] 🟨 partial · **[Core flows & launch safety]** deploy verification process (CI? scripts? test/lint/build/env wired anywhere?)
    - **Where:** `No CI: no .github/ dir, no workflow YAML anywhere. Pieces exist but are manual/unchained: scripts/validate-env.mjs (check:env), lint, test (vitest), b`
    - **Plain:** There's no automated safety net running tests/lint/env checks before a deploy - the building blocks exist but a human must remember each one, and Vercel will deploy main even if tests fail.
    - **Fix:** Add a minimal GitHub Actions workflow (or Vercel ignored-build-step) that runs check:env+lint+test+build on push to main and blocks deploy on failure; until then give the founder one copy-paste pre-promote command.

- [ ] ⬜ missing · **[Email reliability]** Appointment reminder emails (settings template implies reminders send)
    - **Where:** `Editable reminder template exists in UI (src/components/settings/notifications-settings-tab.tsx:205-215) and is persisted (src/lib/actions/settings.ts`
    - **Plain:** Salons can write and save an 'Appointment Reminder' email in settings, which strongly implies reminders go out automatically before appointments — but nothing ever sends them.
    - **Fix:** P1: Add a scheduled job (Vercel Cron hitting an /api/cron/reminders route guarded by CRON_SECRET) that queries upcoming appointments and sends the reminder via sendEmail. Until then, hide/label the reminder template as not-yet-active to avoid a false promise.

- [ ] 🟨 partial · **[Legal, trust & support]** Terms of Service page (src/app/terms) — real content vs placeholder; covers SaaS subscription + SAL Payments platform fee wording
    - **Where:** `src/app/terms/page.tsx is 222 lines of real, structured content (11 sections) — NOT lorem/placeholder. BUT §6 Payment Terms (lines 130-136) states: 'T`
    - **Plain:** The Terms page is genuine, real legal text — not filler. The serious problem is it says the platform is 'free of charge,' which is wrong: you charge salons monthly. If you bill a salon while your own Terms say it's free, that's a contract dispute waiting to happen.
    - **Fix:** Rewrite §6 to describe the real subscription pricing/billing (and the separate Stripe Connect 'SAL Payments' arrangement, noting SAL currently takes no platform fee but reserving the right to). Have a lawyer review (founder action). Do this before charging any salon.

- [ ] ⬜ missing · **[Legal, trust & support]** Refund / cancellation policy for SAL subscription — present anywhere?
    - **Where:** `grep for 'refund | cancellation policy | no refund | money back | prorat' across src returns only end-CLIENT payment enums (src/types/index.ts:430,455`
    - **Plain:** There is no written policy for refunds or cancelling a SAL subscription, and the 'Cancel Subscription' button does nothing. There's also no real subscription-billing code yet — the Billing tab is purely cosmetic. If a salon disputes a charge, you have no documented terms to point to.
    - **Fix:** Add a clear subscription cancellation/refund policy to the Terms (e.g., monthly, cancel anytime effective next cycle, setup-fee refund terms). Separately, the SaaS billing flow itself is unbuilt — wire real Stripe subscription billing + a working Cancel flow before charging salons.

- [ ] 🚫 fake/broken · **[Legal, trust & support]** Data deletion / export process for a salon's data (GDPR-ish) — any code/endpoint?
    - **Where:** `Privacy Policy promises Deletion and Export rights (privacy/page.tsx:166-174) and 'delete or anonymize your personal data within 30 days' (line 144). `
    - **Plain:** Your Privacy Policy promises customers they can delete or download their data, but the app can't do either — the 'Delete Account' button is a dead button and there's no export feature. The only path is emailing an address that may not be monitored.
    - **Fix:** Build real account-deletion and data-export (CSV/JSON) endpoints, OR set up and TEST a documented manual process to a monitored inbox and make the Privacy Policy match reality. At minimum, disable/remove the dead 'Delete Account' button so it doesn't imply working functionality.

- [ ] 🚫 fake/broken · **[Legal, trust & support]** Support inbox / contact — visible support/contact link in app; does help center go anywhere real or is it a stub?
    - **Where:** `In-app 'Help & Support' is a stub: src/components/dashboard/header.tsx:153 — onClick={() => toast.info("Help center coming soon")}. No /help, /support`
    - **Plain:** The 'Help & Support' button inside the app does nothing but show a 'coming soon' toast — there's no help center. The only contact is an email on a domain (salplatform.com) that isn't your real site (meetsal.ai), so support messages may go nowhere.
    - **Fix:** Pick a real support channel (e.g., a monitored support@meetsal.ai mailbox or a help widget) and wire the 'Help & Support' menu item to it. Fix the email domain to meetsal.ai consistently across terms, privacy, landing footer, and lib/email.ts. Confirm the mailbox actually receives mail before any beta salon goes live.

- [ ] ⬜ missing · **[Monitoring, backups, prod safety]** Error tracking (Sentry or similar) installed/configured
    - **Where:** `package.json has no @sentry/*, datadog, rollbar, bugsnag, logtail, axiom, or any APM dependency (grep returned NONE). node_modules/@sentry does not ex`
    - **Plain:** There is no system that captures crashes or errors and tells you about them. If the app throws an error for a real salon, nobody is notified — the error just scrolls past in Vercel's logs that no one is watching.
    - **Fix:** Install Sentry for Next.js (npx @sentry/wizard@latest -i nextjs), which adds instrumentation files and a SENTRY_DSN env var. This is roughly 30 min of setup and gives you crash alerts by email/Slack. Founder action: create a free Sentry account.

- [ ] ⬜ missing · **[Monitoring, backups, prod safety]** Uptime monitoring config/notes for homepage/login/booking/webhook
    - **Where:** `No uptime/monitoring config exists in the repo. The only mentions are aspirational checklist lines in docs/NEXT_STEPS_LAUNCH_CHECKLIST.md:184-188 ('Ad`
    - **Plain:** Nothing watches whether your site, login, booking page, or payment webhook are actually up. If the site goes down at 2am, you find out when a salon emails you angry, not before.
    - **Fix:** Founder action: sign up for a free uptime monitor (UptimeRobot or BetterStack) and add 4 checks: https://www.meetsal.ai, the login page, a public booking page, and a GET to /api/health (which already returns 503 when the DB is down). Have it alert your phone/email. No code change needed since /api/health already exists.

- [ ] 🟨 partial · **[Monitoring, backups, prod safety]** Stripe webhook failure monitoring/logging — does it log/alert on failures or swallow them?
    - **Where:** `src/app/api/stripe/webhook/route.ts logs failures and returns proper status codes: signature failure -> console.error + 400 (lines 38-42), missing sec`
    - **Plain:** Good news: the payment webhook does not hide errors — it logs them and tells Stripe to retry. Bad news: nobody is alerted when a payment webhook fails, so a broken payment flow could go unnoticed for days. And if a successful payment arrives with no matching record in your database, it is silently ignored.
    - **Fix:** Until Sentry is added, founder must build the habit of checking the Stripe Dashboard > Developers > Webhooks 'Failed' tab regularly (Stripe shows webhook delivery failures there for free). After Sentry is installed, the existing console.error calls should be upgraded to Sentry.captureException. Also add a console.error in the 'no matching payment' branch so unmatched succeeded-payments are at least visible.
    - ⚖️ CORRECTED: I read src/app/api/stripe/webhook/route.ts in full and confirm the auditor's factual claims. The webhook does NOT swallow errors: missing secret -> 500 (lines 15-19), missing signature -> 400 (lines 26-31), signature verification failure -> console.

- [ ] 👤 founder · **[Monitoring, backups, prod safety]** Backup plan docs (Supabase free vs paid), PITR notes
    - **Where:** `Only planning text exists in docs/NEXT_STEPS_LAUNCH_CHECKLIST.md:192-195 ('Confirm Supabase backup plan', 'If production is on Supabase Free, export b`
    - **Plain:** There is a to-do note about backups but no actual backup setup. Whether your salon data is being backed up depends entirely on your Supabase account plan, which is not something the code can do for you.
    - **Fix:** Founder action: log into Supabase and confirm the production project's plan. Free tier = no automatic backups; you must either upgrade to Pro (daily backups + PITR add-on) or schedule manual `pg_dump`/Supabase CLI exports off-site. Before putting real salons on, the Pro plan with daily backups is strongly recommended.

- [ ] ⬜ missing · **[Monitoring, backups, prod safety]** Rollback plan for Vercel (docs)
    - **Where:** `No operational Vercel rollback doc exists. README.md:268-274 'Deployment' section only covers initial deploy (connect repo, add env, deploy) — nothing`
    - **Plain:** There is no written, plain-English guide for you to roll back a bad deploy. Vercel does let you instantly revert to a previous deployment in its dashboard, but that procedure is not documented anywhere for you.
    - **Fix:** Write a 5-line runbook: in Vercel Dashboard > Deployments, find the last known-good deployment, click the three-dots menu > 'Promote to Production' (or 'Instant Rollback'). This takes ~10 seconds and needs no code. Document it so you can do it under pressure.

- [ ] ⬜ missing · **[Monitoring, backups, prod safety]** Incident checklist (pause payments / rollback / contact salons / restore db)
    - **Where:** `Exists only as an unbuilt TODO in docs/NEXT_STEPS_LAUNCH_CHECKLIST.md:196-200 ('Create a simple incident checklist: how to pause payments, how to roll`
    - **Plain:** If something goes badly wrong (e.g., payments breaking), there is no step-by-step guide for what to do, and no built-in switch to quickly turn off payments. You'd be improvising during a crisis.
    - **Fix:** Create a one-page INCIDENT.md: (1) Pause payments — how (currently: rotate/remove STRIPE_SECRET_KEY in Vercel, or disable in Stripe dashboard), (2) Roll back Vercel (see above), (3) Contact salons — keep a private list with phone numbers, (4) Restore DB — Supabase backup restore steps. Founder should also maintain the beta-salon contact list now.

- [ ] ⬜ missing · **[Monitoring, backups, prod safety]** Release process gating: CI workflow / husky / test+lint+build+env-validation gated
    - **Where:** `No .github/ directory exists (no GitHub Actions). No .husky/ directory (no git hooks). No *.yml/*.yaml workflow files anywhere (find returned NONE). N`
    - **Plain:** Nothing automatically runs the tests, linter, build check, or environment-variable validation before code goes live. It is entirely on whoever deploys to remember to run them — so a broken or misconfigured build can reach real salons.
    - **Fix:** Add a .github/workflows/ci.yml that runs npm run check:env, lint, test, and build on every push/PR; set Vercel to block production deploys on failed checks. Quick win: a CI file is ~20 lines and closes the biggest 'silent regression' gap. The check:env script (scripts/validate-env.mjs) is solid and should be wired into both CI and Vercel's build command.

- [ ] 🟨 partial · **[Monitoring, backups, prod safety]** Tests directory exists and tests are real
    - **Where:** `tests/ exists with exactly 2 real, meaningful unit test files: tests/date-utils.test.ts (regression for parseYmd date-overflow guard used by /api/book`
    - **Plain:** There are real automated tests, but only two of them, covering small utility pieces. The critical money and booking flows have no test coverage, so a future change could silently break payments or let one salon see another's data without any test catching it.
    - **Fix:** Keep the existing tests and wire them into CI. Then prioritize tests for the webhook amount/currency-mismatch guard and multi-tenant scoping (businessId filtering) on at least the payment and booking actions — these are the dangerous-if-broken paths for a non-technical founder.

- [ ] 🟨 partial · **[Monitoring, backups, prod safety]** Env validation (scripts/validate-env.mjs) present and run
    - **Where:** `scripts/validate-env.mjs is present and genuinely robust: it checks 9 required vars (DATABASE_URL, NEXTAUTH_SECRET/URL, NEXT_PUBLIC_APP_URL, both Stri`
    - **Plain:** There is a good script that checks your production settings are filled in correctly, but it never runs on its own — someone has to remember to type the command. So a missing or wrong key (like a test Stripe key in production) would not be caught automatically.
    - **Fix:** Run check:env automatically: either prepend it to the build command (`node scripts/validate-env.mjs && prisma generate && next build`) or add it as the first step in the CI workflow. Note: it scans .env files, so in Vercel CI you'd run it with the env vars injected. This is a 1-line change with high safety payoff.

- [ ] 🟨 partial · **[SAL Billing (salon subscriptions)]** Business schema has stripeCustomerId / stripeSubscriptionId / subscription status fields wired to real billing
    - **Where:** `prisma/schema.prisma:293-298 — Business has subscriptionTier (enum free/starter/pro/enterprise, default free), subscriptionStatus (enum active/trialin`
    - **Plain:** The database has placeholder columns for which plan a salon is on, but they are filled in once at signup with 'free/active' and never touched again. There is no column linking a salon to a Stripe subscription, so nothing connects these fields to real money.
    - **Fix:** Add stripeCustomerId and stripeSubscriptionId columns to Business and a migration, then populate them when a salon actually subscribes via Stripe Checkout (see next item).

- [ ] ⬜ missing · **[SAL Billing (salon subscriptions)]** Stripe subscription Checkout flow for salons signing up to pay SAL (mode:'subscription')
    - **Where:** `Grep for mode:'subscription', checkout.sessions.create, and price IDs across /src returned nothing. src/lib/stripe.ts only has a create-payment-intent`
    - **Plain:** There is no way for a salon to actually start paying SAL its monthly fee — no checkout page, no Stripe subscription is ever created.
    - **Fix:** Build a /api/stripe/create-subscription-checkout route using stripe.checkout.sessions.create with mode:'subscription' and a real Stripe Price ID, then redirect salon owners to it from the Billing tab.

- [ ] 🚫 fake/broken · **[SAL Billing (salon subscriptions)]** Billing settings page — real data vs hardcoded $49/mo Pro UI
    - **Where:** `src/app/(dashboard)/settings/client.tsx:475-558 — The entire Billing tab is static JSX: hardcoded 'Pro Plan' badge (line 495), '$49 /month' (line 501-`
    - **Plain:** The Billing screen a salon owner sees is a mockup. It always shows '$49/mo Pro Plan' and a fake Visa card regardless of reality, and the buttons are dead. This is dangerous: an owner could believe they are subscribed and being charged when no billing system exists at all.
    - **Fix:** Before any beta with real salons, either remove/hide this Billing tab or replace it with real data driven by Business.subscriptionTier/Status and wire the buttons to a real Stripe Checkout + Customer Portal. Do not ship the fake $49 card to paying customers.

- [ ] ⬜ missing · **[SAL Billing (salon subscriptions)]** Stripe Customer Portal flow (billingPortal.sessions.create)
    - **Where:** `Grep for billingPortal across /src returned nothing. The 'Change Plan', 'Cancel Subscription', and 'Update' payment-method buttons in client.tsx:523-5`
    - **Plain:** Salons have no way to update their card, change plans, or cancel — the buttons that suggest they can are non-functional.
    - **Fix:** Add a /api/stripe/billing-portal route using stripe.billingPortal.sessions.create and wire the Billing-tab buttons to it once subscriptions exist.

- [ ] ⬜ missing · **[SAL Billing (salon subscriptions)]** Subscription webhooks (checkout.session.completed, customer.subscription.created/updated/deleted, invoice.payment_failed, invoice.paid)
    - **Where:** `src/app/api/stripe/webhook/route.ts:46-177 — the switch handles ONLY account.updated (line 47), payment_intent.succeeded (70), payment_intent.payment_`
    - **Plain:** Even if a salon subscription existed in Stripe, SAL would never react to it — successful payments, failed payments, and cancellations would all be ignored, so the database plan status could never stay in sync with reality.
    - **Fix:** Add cases for checkout.session.completed, customer.subscription.created/updated/deleted, invoice.paid, and invoice.payment_failed that update Business.subscriptionStatus/Tier and stripeSubscriptionId.

- [ ] ⬜ missing · **[SAL Billing (salon subscriptions)]** Feature gating by subscription status
    - **Where:** `subscriptionStatus/subscriptionTier are referenced in only 3 places (grep src): types/index.ts (type defs), api/v1/settings/route.ts:40-41 (merely ret`
    - **Plain:** A salon's plan and payment status have zero effect on what they can do — a non-paying or cancelled salon has exactly the same access as a paid one. There is nothing stopping unlimited free use.
    - **Fix:** After billing is built, enforce subscriptionStatus in middleware/dashboard layout (e.g. redirect past_due/cancelled to a billing page) and gate tier-specific features by subscriptionTier.

- [ ] ⬜ missing · **[SAL Payments (Stripe Connect)]** Webhook idempotency / duplicate-event protection
    - **Where:** `webhook/route.ts never records event.id; no StripeEvent/idempotency model in prisma/schema.prisma (grep for model.*Event / idempoten / webhook returns`
    - **Plain:** Stripe sometimes sends the same notification twice. The code doesn't remember which it already handled, so a duplicate could re-run an update. Safe-ish today but fragile as logic grows.
    - **Fix:** Add a StripeEvent table keyed on event.id; short-circuit (return 200) if already seen, written at handler start.

- [ ] 🟨 partial · **[SAL Payments (Stripe Connect)]** Refunds update SAL payment records
    - **Where:** `Webhook charge.refunded (webhook/route.ts:144-174) finds Payment by processorId and sets status 'refunded' (full) or keeps status (partial) with refun`
    - **Plain:** If a refund happens in Stripe directly, SAL's records update correctly, but there is no way to issue a refund from inside SAL — the owner must go to Stripe.
    - **Fix:** Add a refund action calling createRefund (scoped to the salon's own payments), or accept Stripe-dashboard-only refunds for beta and tell salons. The webhook side is already fine.

- [ ] 🚫 fake/broken · **[SMS off & fake-feature hunt]** Marketing campaigns never actually send email (system-wide fake send)
    - **Where:** `createCampaign (src/lib/actions/marketing.ts:60-91) only creates a draft/scheduled DB row — no recipient lookup, no Resend call. sendCampaign (:151-17`
    - **Plain:** When a salon writes an email campaign and clicks 'Send Campaign', the app says it succeeded but no email is ever sent to clients — it just marks the campaign as sent in the database.
    - **Fix:** Either (a) wire campaign send to actually fetch the audience and send via the existing sendEmail/Resend infra, or (b) before any salon sees it, relabel to 'Save Draft' / hide the Campaigns send capability and add a clear 'Campaign delivery coming soon' banner. Do not ship a button that claims to send.

- [ ] 🚫 fake/broken · **[SMS off & fake-feature hunt]** Automated messages never fire (no scheduler/trigger engine)
    - **Where:** `toggleAutomatedMessage (src/lib/actions/marketing.ts:267-293) only flips isActive in DB. No cron/queue/trigger code references automatedMessage for se`
    - **Plain:** A salon can switch on 'Appointment Reminder' or 'Birthday Greeting' automations and they look active, but no reminder or birthday email is ever actually sent.
    - **Fix:** Build the trigger engine (e.g., a scheduled job that sends due automated messages via sendEmail) or hide the Automated Messages tab with a 'coming soon' state until it works. As-is it's a deceptive feature.

- [ ] 🚫 fake/broken · **[SMS off & fake-feature hunt]** Issue Gift Card dialog does not persist (fake issuance)
    - **Where:** `src/components/memberships/issue-gift-card-dialog.tsx:75-99 handleSave only calls toast.success('Gift card issued') and resets the form. No server act`
    - **Plain:** A salon fills out 'Issue $100 gift card', clicks Issue, sees a success message — but nothing is saved. They could take the customer's $100 and have no record of the gift card, an accounting/liability problem.
    - **Fix:** Hide the 'Issue Gift Card' button before any beta salon, OR implement a real createGiftCard server action that persists code/balance/owner. P0 because it touches money.

- [ ] 🚫 fake/broken · **[SMS off & fake-feature hunt]** Gift card redemption at checkout is non-functional
    - **Where:** `src/components/checkout/payment-dialog.tsx:380-388 Apply button onClick toast.info('Gift card validation is not yet configured'); yet the Process butt`
    - **Plain:** At checkout you can pick 'Gift Card', type any 4+ characters, and complete the sale — the code is never validated and no balance is checked or reduced. A customer could 'pay' with a fake code, or a real card's balance would never go down.
    - **Fix:** Hide the Gift Card payment option in checkout (cart-panel.tsx and payment-dialog.tsx) until redemption is implemented (validate code, check/deduct balance atomically). P0 — it lets sales be recorded as paid with no real money.

- [ ] 🚫 fake/broken · **[SMS off & fake-feature hunt]** Create Membership Plan dialog does not persist (fake)
    - **Where:** `src/components/memberships/create-plan-dialog.tsx:69-91 handleSave only toast.success('Membership plan created') and resets form. No server action, no`
    - **Plain:** Setting up a membership plan looks like it works but saves nothing — the plan vanishes on reload.
    - **Fix:** Hide the 'Create Plan' button or implement a real createMembershipPlan action that persists. P0 because it ties into recurring billing/money.

- [ ] 🚫 fake/broken · **[SMS off & fake-feature hunt]** Membership Plans grid renders hardcoded mock plans for every salon
    - **Where:** `src/components/memberships/memberships-tab.tsx:19 imports mockMembershipPlans and :208 .map((plan)=> <PlanCard .../>). These are the same fake Bronze/`
    - **Plain:** Every salon sees the same fake set of membership plans they never created, and the Edit / View Members buttons on them do nothing. The members table below it is real, but the plans above are fake.
    - **Fix:** Replace mockMembershipPlans with real per-business plans from the DB (and pair with the Create Plan fix). Until then, hide the Membership Plans grid. P0 — it's prominent, deceptive, and tied to billing.

- [ ] 🚫 fake/broken · **[SMS off & fake-feature hunt]** Service Bundles section is fully mock and non-functional
    - **Where:** `src/components/services/service-bundles.tsx:28-66 hardcoded mockBundles; rendered live at src/app/(dashboard)/services/client.tsx:406. 'Book Bundle' (`
    - **Plain:** On the Services page, the 'Service Bundles' cards are fake sample packages the salon never made, and neither booking nor creating a bundle does anything.
    - **Fix:** Remove the <ServiceBundles/> render from services/client.tsx (line 406) before any salon sees it, or build a real bundles backend.

- [ ] 🚫 fake/broken · **[SMS off & fake-feature hunt]** Client wallet Top Up / Redeem are dead buttons
    - **Where:** `src/components/clients/client-overview-tab.tsx:154 onClick toast.success('Top-up feature coming soon'), :163 toast.success('Redeem feature coming soon`
    - **Plain:** On a client's profile, the wallet Top Up and Redeem buttons just say 'coming soon', and there's no way to actually use a wallet balance at checkout.
    - **Fix:** Hide the wallet Top Up/Redeem buttons (and the 'can be applied at checkout' note) until wallet is implemented, or remove the wallet card for beta.

- [ ] ⬜ missing · **[Salon workflow polish]** One-off time blocks (ad-hoc 'dentist 2-3pm' labeled block that blocks public booking)
    - **Where:** `No TimeBlock model in prisma/schema.prisma (models list shows StaffBreak, StaffTimeOff, Appointment — no ad-hoc block). new-appointment-dialog.tsx onl`
    - **Plain:** There is no way for a salon to drop a quick labeled 'I'm out 2-3pm' block onto the calendar that stops clients from booking that slot. The 'Block Time' button on the dashboard is a dead button that just opens the calendar.
    - **Fix:** Build it: add a CalendarBlock model (staffId, start, end, label) or reuse partial StaffTimeOff, an action to create one, include it in availability.ts blockedRanges, and render it on the calendar. This is a genuine small build (half-day to a day).

- [ ] 🟨 partial · **[Salon workflow polish]** Recurring appointments edit modes (this only / this and following / all in series) + modified-instance tracking
    - **Where:** `prisma/schema.prisma:730-734 has seriesId/parentAppointmentId/recurrenceRule. createRecurringAppointment (src/lib/actions/recurring.ts:38) and cancelR`
    - **Plain:** Recurring series can be created and cancelled (including 'this and all future') through the backend API, but there is no 'edit this one vs this and following vs all' editing. Worse, in the actual salon calendar the 'Repeat' toggle does nothing — flipping it on and saving just makes one normal appointment, so staff think they made a weekly booking when they only made one.
    - **Fix:** Two things: (1) Wire the dialog's handleSubmit to call createRecurringAppointment when isRecurring is true (small fix). (2) For edit modes, add an updateRecurring action with a scope parameter; this is a real build. Prioritize the dialog wiring as P1 since it silently misleads users.

- [ ] ⬜ missing · **[Salon workflow polish]** Structured cancellation reasons + initiator (client/business/no-show reason codes) — DB + UI
    - **Where:** `prisma/schema.prisma:715-718 has only free-text cancellationReason plus cancelledBy (a User UUID) and noShowAt — NO enum for reason codes and NO initi`
    - **Plain:** When staff cancel an appointment, the app never asks why and never records who initiated it or whether it was a no-show vs a client cancel. The database has a free-text note column but the cancel button doesn't even fill that in, so there is zero cancellation reporting.
    - **Fix:** Add a reason-code enum + initiator field to the Appointment model, add a small dialog on cancel/no-show to capture them, and have updateAppointmentStatus persist them. Important before launch if founders want cancellation/no-show analytics.


## P2 — Polish (16 action items)

- [ ] 🚫 fake/broken · **[Core flows & launch safety]** reschedule flow (client-facing on manage page)
    - **Where:** `manage/[bookingReference]/client.tsx:586-594 the "Reschedule Appointment" button only calls setShowRescheduleInfo(true), rendering a panel (539-583) t`
    - **Plain:** On the client's booking page the Reschedule button looks like a feature but only tells them to phone the salon - it does not actually move the appointment.
    - **Fix:** Relabel to "Need to reschedule? Contact us" so it isn't misleading, or build a real self-reschedule reusing the dashboard conflict/working-hours logic. (a) is fine for beta; real self-reschedule is P2.

- [ ] 🟨 partial · **[Core flows & launch safety]** production release checklist present?
    - **Where:** `PRODUCTION_FEATURE_CHECKLIST.md and docs/NEXT_STEPS_LAUNCH_CHECKLIST.md both exist, but the latter (lines 201, 391) admits required tooling (check:lau`
    - **Plain:** There are written launch checklists, but they reference steps/tools not actually in the live code yet, so they're a guide rather than a guarantee.
    - **Fix:** Reconcile the checklist with reality: either land the missing scripts or edit the checklist so the non-technical founder isn't told to run commands that don't exist.

- [ ] 🚫 fake/broken · **[Email reliability]** Marketing 'Send Campaign' email button (UI implies email sends)
    - **Where:** `src/lib/actions/marketing.ts:151-174 sendCampaign() — for email channel it ONLY does `prisma.campaign.update({ data: { status: 'sent', sentAt: new Dat`
    - **Plain:** The marketing page lets a salon build an email campaign and click 'Send Campaign', and it shows as 'sent' — but no emails are ever actually delivered. It's a button that lies.
    - **Fix:** P1: Either wire sendCampaign to actually iterate the audience and call sendEmail via Resend (mind Resend rate limits / batch API + add unsubscribe), or disable/label the email-send path as 'Coming soon' so the founder doesn't tell salons it works.

- [ ] ⬜ missing · **[Legal, trust & support]** 'SAL does not provide legal/tax/accounting advice' disclaimer present?
    - **Where:** `grep for 'legal advice | tax advice | accounting advice | not provide advice | consult attorney/professional | disclaimer' across src returns zero mat`
    - **Plain:** The app shows tax calculations and financial reports, but nowhere does it say 'this isn't professional tax/legal/accounting advice.' Without that line, a salon could blame SAL if a tax number is wrong for their location.
    - **Fix:** Add a short disclaimer to the Terms (and ideally near financial/tax features) stating SAL is software only and does not provide legal, tax, or accounting advice, and users should consult their own professionals. Low effort, meaningful liability reduction.

- [ ] ⬜ missing · **[SAL Billing (salon subscriptions)]** Trial / grace-period logic
    - **Where:** `Business.trialEndsAt exists (schema.prisma:295) but is never set (register.ts:71-81 omits it) and never read in any business logic. Grep for trialEnds`
    - **Plain:** There is a 'trial ends' date field but nothing ever uses it — there is no free-trial countdown or grace period before cutting off a non-paying salon.
    - **Fix:** When subscriptions are built, set trialEndsAt at signup and add logic (cron or on-request check) that transitions status to past_due/cancelled after trial/grace expiry.

- [ ] 🟨 partial · **[SAL Payments (Stripe Connect)]** Application / platform fee logic (application_fee_amount)
    - **Where:** `src/lib/stripe.ts:54-56 adds application_fee_amount only when applicationFeeAmount > 0, but the sole caller (create-payment-intent/route.ts:102-112) n`
    - **Plain:** The ability to take a cut of each client payment is built but switched off — SAL earns nothing per transaction. Likely intentional (SAL monetizes via the monthly subscription), so this is a business decision, not a bug.
    - **Fix:** Founder decision: if SAL Payments should earn per-transaction revenue, pass applicationFeeAmount from create-payment-intent; otherwise leave off. Document the choice either way.

- [ ] 🟨 partial · **[SMS off & fake-feature hunt]** MCP tools accept and persist SMS channel without email-only enforcement (gating leak)
    - **Where:** `src/lib/mcp/tools/marketing.ts:28 create-campaign channel: z.enum(["email","sms","both"]) and :33-43 writes it straight to prisma.campaign.create with`
    - **Plain:** The AI/developer (MCP) interface — admin-only and behind authentication — could create and even activate an SMS automation, inconsistent with the dashboard which blocks this. Because no SMS sender exists, it would silently do nothing rather than send a text, so the risk is low but the gating is uneven.
    - **Fix:** For consistency, change the MCP create-campaign / create-automated-message channel enums to z.literal("email") (or reject sms/both) and add the same channel!=='email' guard in toggle-automated-message, matching src/lib/actions/marketing.ts.

- [ ] 🚫 fake/broken · **[SMS off & fake-feature hunt]** Marketing campaign card View / Edit / Duplicate are dead buttons
    - **Where:** `src/components/marketing/campaign-card.tsx:154 onClick toast.info('Viewing campaign details'), :163 toast.info('Editing campaign'), :172 toast.success`
    - **Plain:** On each campaign tile, the View, Edit, and Duplicate buttons just pop a toast and do nothing real.
    - **Fix:** Wire to real view/edit/duplicate, or remove the buttons until implemented.

- [ ] 🟨 partial · **[SMS off & fake-feature hunt]** Deals: create works but activate/deactivate toggle is fake
    - **Where:** `src/components/marketing/deals-tab.tsx:106 calls real createDeal action; but handleToggle (:142-147) only updates local state + toast 'Deal activated/`
    - **Plain:** Creating a promotion is real, but flipping a deal on/off only changes it on screen until the page reloads — it never saves.
    - **Fix:** Add a toggleDeal/updateDeal server action and wire handleToggle to it, or remove the toggle.

- [ ] 🚫 fake/broken · **[SMS off & fake-feature hunt]** Client overview 'Save Notes' (and inline tags) are fake no-ops
    - **Where:** `src/components/clients/client-overview-tab.tsx:46-48 handleSaveNotes only toasts 'Notes saved successfully'; add/remove tag (:50-61) update local stat`
    - **Plain:** On the client overview tab, clicking 'Save Notes' says it saved but doesn't — the note disappears on reload. (There's a different Edit dialog that does save, which makes this extra confusing.)
    - **Fix:** Wire handleSaveNotes/tag changes to the existing updateClient action, or remove the inline editor and rely on the Edit Client dialog that already works.

- [ ] 🚫 fake/broken · **[SMS off & fake-feature hunt]** Staff detail 'Edit' button is a stub
    - **Where:** `src/app/(dashboard)/staff/[id]/client.tsx:182 onClick toast.info('Edit form coming soon').`
    - **Plain:** On a staff member's page, the Edit button just says 'coming soon'.
    - **Fix:** Implement edit or hide the button. Lower priority since staff can likely be managed elsewhere — verify a working staff edit path exists.

- [ ] 🚫 fake/broken · **[Salon workflow polish]** Staff breaks (a): do breaks SAVE to DB?
    - **Where:** `src/components/staff/staff-schedule-tab.tsx:108-114 handleSave builds scheduleData with ONLY {dayOfWeek,startTime,endTime,isWorking} — break fields (h`
    - **Plain:** The break toggle and time pickers on a staff member's schedule look fully working — you can set a lunch break and see a bar for it — but when you click Save, the break is thrown away. It is never written to the database, so it does not exist after you reload.
    - **Fix:** Update handleSave to include hasBreak/breakStart/breakEnd per day, extend the updateStaffSchedule action's Zod schema to accept breaks, and create StaffBreak rows (prisma.staffBreak.create) tied to each created StaffSchedule. The DB model and availability engine already support this, so it is a focused 1-2 hour wiring fix, not a build.

- [ ] ⬜ missing · **[Salon workflow polish]** Staff breaks (c): does the calendar VISUALLY show breaks?
    - **Where:** `src/components/calendar/staff-column.tsx renders working-hours shading (266-290) and full-day-off shading (292-306) but has NO break overlay (grep for`
    - **Plain:** The calendar shows shaded zones for before/after working hours and full days off, but it draws nothing for a mid-day break (e.g. a lunch gap). The break data also is not loaded into the calendar at all.
    - **Fix:** Add breaks to the getStaff list query's staffSchedules.select, then add a break-shading overlay block in staff-column.tsx (mirror the existing working-hours shading). Do this after item (a) so there is real data to render.

- [ ] 🟨 partial · **[Salon workflow polish]** Unavailable time rendered on calendar (breaks / time-off / closed shading)
    - **Where:** `src/components/calendar/staff-column.tsx:266-306 renders before-work, after-work, and full-day-off diagonal shading driven by real staff.workingHours `
    - **Plain:** The calendar correctly grays out the hours a staff member is not scheduled to work and full days off. It does NOT visually show approved vacation/sick days, partial time-off, or breaks — so a manager could book over an approved day off without a visual warning on the calendar.
    - **Fix:** Pass approved StaffTimeOff and breaks into the calendar and add shading overlays for each. Partial fix; treat as polish unless founders rely on visible time-off.

- [ ] 🟨 partial · **[Salon workflow polish]** Quick appointment status actions on cards (check-in/start/complete without opening detail)
    - **Where:** `Status actions exist but ONLY inside the detail sheet: src/components/calendar/appointment-detail-sheet.tsx:369-441 (Start Service, Complete, Mark No-`
    - **Plain:** You can change an appointment's status (check in, start, complete, no-show) and it really saves — but you must click the appointment open first. There is no one-click check-in directly on the calendar card or a right-click menu.
    - **Fix:** Add a hover toolbar or right-click context menu on appointment-block.tsx calling the existing updateAppointmentStatus action. Backend already works, so this is a UI-only enhancement.

- [ ] 🟨 partial · **[Salon workflow polish]** Today / front-desk panel grouped by status
    - **Where:** `src/app/(dashboard)/dashboard/client.tsx:270-313 renders a 'Today's Schedule' card filtered to today (line 79 isSameDay) showing a flat chronological `
    - **Plain:** There is a today-only schedule list on the dashboard, but it is a simple time-ordered list. It is not a front-desk board that separates who's waiting, who's in service, and who's done.
    - **Fix:** Group todayAppointments by status into labeled sections/columns. Data is already loaded; this is a presentational change.


## P3 — Later (2 action items)

- [ ] 🟨 partial · **[SMS off & fake-feature hunt]** Misc 'coming soon' toast stubs (help center, notifications page, supplier contact, dashboard appt view/edit, client file download)
    - **Where:** `src/components/dashboard/header.tsx:153 'Help center coming soon'; notification-dropdown.tsx:201 'Notifications page coming soon'; inventory/supplier-`
    - **Plain:** Several minor buttons across the app pop a 'coming soon' or fake-success toast and don't do anything yet.
    - **Fix:** These are low-stakes polish items, but the fake 'Downloading {file}' toast (client-notes-tab) is mildly deceptive — relabel or hide it. Audit each before public launch (P1) but not blocking for a beta salon.

- [ ] ⬜ missing · **[Salon workflow polish]** Running-late detection
    - **Where:** `No running-late logic anywhere — grep for runningLate/isLate/overdue/minutes late across src/ returns no relevant matches. The schema has checkedInAt `
    - **Plain:** Nothing in the app notices when a client is past their start time and hasn't checked in. There is no late badge or alert.
    - **Fix:** Compute (now > startTime && status in [confirmed,pending]) on the calendar/dashboard cards and show a 'X min late' badge. Small front-end-only addition; low priority for beta.


## ✅ Verified working — no action needed (34 items)

_These were probed against real code and confirmed genuinely implemented. This is the trustworthy core._

- **[Core flows & launch safety]** login (NextAuth credentials) — Logging in works with real password checking and brute-force lockout, and correctly attaches the user's salon to their session.
- **[Core flows & launch safety]** password reset (token expiry, single-use) — Forgot-password emails a 1-hour, one-time-use reset link that truly resets the password and cannot be replayed.
- **[Core flows & launch safety]** onboarding for a new salon — The new-salon setup wizard genuinely saves business details, hours, and services and marks the salon as set up.
- **[Core flows & launch safety]** staff creation (actions/staff.ts) — Adding a staff member works and they become bookable on the calendar.
- **[Core flows & launch safety]** service creation (actions/services.ts) — Creating a service works and saves it (price, duration, assigned staff) to the database.
- **[Core flows & launch safety]** business hours (configured + enforced) — The salon's open/close hours are saved and actually limit which time slots clients can book.
- **[Core flows & launch safety]** public booking (actions/public-booking.ts, /book/[businessSlug], api/bookings, api/availability) — A client on the public booking page can book a real appointment into the salon's calendar, with protection against two people grabbing the same slot.
- **[Core flows & launch safety]** booking confirmation email (does submitting a booking send one?) — Submitting a booking does fire a confirmation email with a manage link, provided the email key is set in production.
- **[Core flows & launch safety]** manage booking link (/book/manage/[bookingReference], booking-reference.ts) — The manage link opens a page with the client's appointment details, and the reference is random enough that strangers can't guess others' bookings.
- **[Core flows & launch safety]** cancel booking flow (client-facing + dashboard) — A client can cancel their own appointment from the manage link (verified by email), and the salon can cancel from the dashboard.
- **[Core flows & launch safety]** dashboard shows appointments correctly (real data, not mock) — The dashboard shows the salon's real appointments and stats from the database, not placeholder data.
- **[Core flows & launch safety]** register (src/lib/actions/register.ts, src/app/register) — Signing up creates the account, business, location, and owner-as-stylist, then logs them in and sends them into onboarding.
- **[Email reliability]** Resend integration wired (RESEND_API_KEY usage) — The connection to Resend (the email-sending service) is set up correctly and gracefully skips sending if the key is missing instead of crashing.
- **[Email reliability]** Password reset email actually sends in the reset flow — When a user requests a password reset, a real email with a secure 1-hour link is actually sent.
- **[Email reliability]** Staff invitation email actually sends — Inviting a staff member sends them a real email with a working 'Accept Invitation' link.
- **[Email reliability]** Appointment confirmation email actually sends — Every way an appointment can be booked sends the client a real confirmation email with the booking details and reference code.
- **[Email reliability]** Reschedule email actually sends — When staff reschedule an appointment, the client gets a real email showing the old and new times.
- **[Email reliability]** Cancellation email actually sends — Cancelling an appointment — by staff or by the client online — sends a real cancellation email.
- **[Email reliability]** Receipt email actually sends after checkout/payment — After a client pays at checkout, a real itemized receipt email is sent to them.
- **[Email reliability]** Welcome email on registration — New signups get a welcome email, but its body talks about booking appointments and leaving reviews, which is client-facing copy aimed at the wrong audience (the salon owner).
- **[Email reliability]** Email templates present and not placeholder/lorem — All the email designs are real, branded, and professional — no placeholder text.
- **[Legal, trust & support]** Privacy Policy page (src/app/privacy) — real content vs placeholder; covers data collection, multi-tenant data, deletion — The Privacy Policy is real and thorough — it correctly distinguishes your salon customers' data from their clients' data, names your vendors, and lists data rights. Content quality is good; the gap is that the deletion/export rights it promises aren't actually built yet.
- **[Monitoring, backups, prod safety]** Health endpoint (api/health) — what does it actually check? — The health-check URL genuinely verifies the database is reachable and returns a clear up/down signal — it is real, not a fake 'always returns OK' endpoint. It only checks the database though, not Stripe or email.
- **[SAL Payments (Stripe Connect)]** Webhook signature verification with raw body before processing — The webhook correctly proves each message really came from Stripe (using the untouched raw message) before trusting it — the critical security gate is done right.
- **[SAL Payments (Stripe Connect)]** Webhook activates business ONLY when charges_enabled AND payouts_enabled — A salon is only marked ready to take payments once Stripe confirms it can both charge cards and receive payouts — exactly the safe condition.
- **[SAL Payments (Stripe Connect)]** Checkout REFUSES online payment if salon has not activated SAL Payments — The online-payment API correctly blocks any salon that hasn't finished Stripe setup, so you can't take a card payment with nowhere for the money to go.
- **[SAL Payments (Stripe Connect)]** Failed payments update SAL payment records — When a card payment fails or returns the wrong amount, SAL correctly marks it failed rather than leaving it looking pending or paid.
- **[SAL Payments (Stripe Connect)]** Payment errors shown clearly to users — When a payment goes wrong, the user sees a readable red error message rather than a silent failure (applies to the Stripe UI once it is wired in).
- **[SMS off & fake-feature hunt]** SMS hidden/disabled in Settings > Notifications — In settings, the SMS section is just an informational 'not available yet' box — there are no SMS controls a salon can flip on.
- **[SMS off & fake-feature hunt]** Marketing campaign creation forced to email-only (no SMS path) — When a salon creates a campaign in the dashboard, the only option is Email; the backend rejects any attempt to set SMS.
- **[SMS off & fake-feature hunt]** Automated-message SMS toggles disabled in UI + server blocks activation — Any pre-seeded SMS automation can't be switched on in the dashboard, and the server refuses to activate it too.
- **[SMS off & fake-feature hunt]** Receipts / customer notifications are email-only (no SMS channel) — Receipts go out by email and there is literally no code anywhere that sends a text message, so SMS can't accidentally fire.
- **[SMS off & fake-feature hunt]** Landing/marketing page does NOT claim a developer API or MCP — The public site does not promise an API/MCP/developer platform, so there's no overpromise to walk back. The API/MCP that exist are real and require authentication.
- **[Salon workflow polish]** Staff breaks (b): does booking/availability EXCLUDE break slots? — The booking engine itself correctly refuses to offer a slot that lands on a break. The logic is real and sound — the only problem is there is currently no way to create a break (item a), so this code path never has data to act on yet.

---

# Appendix: Security & Correctness Review

_Second independent review fleet (8 dimensions, 61 findings). Each finding adversarially re-verified before inclusion. Severity is post-verification. Many overlap the items above; this is the engineer-level detail._


## Multi-tenant isolation — 4 findings (1 high)

- **[HIGH]** stripe/dashboard-link trusts client-supplied Stripe accountId without ownership check (cross-tenant financial IDOR)
    - `src/app/api/stripe/dashboard-link/route.ts:14-22` — Do not accept accountId from the client. Resolve it server-side from the authenticated user's business: load business via getBusinessContext()/ownerId, read business.stripeAccountId, and call createDashboardLink(business.stripeAccountId). R
- **[MEDIUM]** Group participant add: clientId from request body not scoped to tenant (cross-tenant reference injection)
    - `src/app/api/v1/appointments/groups/[id]/participants/route.ts:39-41` — Before create, verify the client: assertClientOwned(parsed.data.clientId, ctx.businessId) (helper already exists in src/lib/ownership.ts) or prisma.client.findFirst({ where: { id: parsed.data.clientId, businessId: ctx.businessId } }) and re
- **[LOW]** Form submission accepts clientId/appointmentId without tenant validation (v1 route and server action)
    - `src/app/api/v1/forms/[id]/submit/route.ts:26-34` — Validate both references against the tenant before create: assertClientOwned(clientId, businessId) and, when appointmentId is present, prisma.appointment.findFirst({ where: { id: appointmentId, businessId } }) (return NOT_FOUND on miss). Ap
- **[LOW]** Waitlist 'book' action links an unvalidated appointmentId from the request body
    - `src/app/api/v1/waitlist/[id]/book/route.ts:21-23` — Before the update, verify prisma.appointment.findFirst({ where: { id: parsed.data.appointmentId, businessId: ctx.businessId } }) and return NOT_FOUND if it does not belong to the tenant.

## API auth & input validation — 5 findings (1 high)

- **[HIGH]** OAuth Dynamic Client Registration is fully open with no redirect_uri scheme validation
    - `src/app/api/oauth/register/route.ts:5-69` — Validate each redirect_uri: require it parse as a valid absolute URL, enforce https (allow http only for localhost loopback per RFC 8252), reject 'javascript:'/'data:' and fragments. Consider gating open registration behind an admin/session
- **[MEDIUM]** forms/[id]/submit does not scope clientId/appointmentId to the caller's tenant
    - `src/app/api/v1/forms/[id]/submit/route.ts:23-34` — Before creating the submission, validate the client (and appointment, if present) with findFirst({ where: scopedWhere(ctx, { id: clientId }) }) and return 404 if not owned, mirroring the pattern used in /api/bookings POST.
- **[LOW]** Public /api/availability has no rate limiting (enumeration & spam)
    - `src/app/api/availability/route.ts:34-66` — Apply per-IP rate limiting to public GET routes (availability/search). Prefer a shared/distributed limiter for serverless. Consider returning a uniform NOT_FOUND for cross-resource probes to reduce existence-oracle enumeration.
- **[LOW]** In-memory rate limiter is per-instance and ineffective on serverless
    - `src/lib/rate-limit.ts:11-21` — Replace with a shared store (Upstash Redis / @vercel/kv) so counters are global across instances. At minimum document that current limits are best-effort and add platform-level (WAF) rate limiting for /login, /api/oauth/*, and public bookin
- **[LOW]** OAuth token endpoint validates redirect_uri only when present in the request
    - `src/app/api/oauth/token/route.ts:55-57` — Require redirect_uri at the token endpoint when one was bound to the code, and reject (invalid_grant) if it is missing or mismatched.

## Booking engine & concurrency — 10 findings (2 high)

- **[HIGH]** BOOKING-CONCURRENCY-001 unfixed at callsite #4: v1 POST /api/v1/appointments has no advisory lock (read-then-write race remains)
    - `src/app/api/v1/appointments/route.ts:143-194` — Add `import { lockStaffSchedule } from "@/lib/db/advisory-lock"` and call `await lockStaffSchedule(tx, ctx.businessId, staffId)` as the first statement inside the $transaction callback, before the findFirst. grep confirms lockStaffSchedule 
- **[HIGH]** BOOKING-CONCURRENCY-001 partially unfixed: v1 PATCH ?action=reschedule has no advisory lock
    - `src/app/api/v1/appointments/[id]/route.ts:101-133` — Mirror appointments.ts:321-327: compute the sorted unique staffIds and `await lockStaffSchedule(tx, ctx.businessId, sid)` for each before the conflict loop.
- **[MEDIUM]** createAppointment / createPublicBooking / group / recurring create paths do NOT validate working hours, breaks, or time-off
    - `src/lib/actions/appointments.ts:81-133` — Call assertSlotAllowed(tx, staffId, locationId, startTime, endTime) inside the create transactions (after the lock) for createAppointment, createPublicBooking, group, and recurring, matching the reschedule path. This closes the 'book during
- **[MEDIUM]** createAppointment, createPublicBooking, and recurring create do not verify the staff member actually performs the service
    - `src/lib/actions/appointments.ts:62-66` — Add a staffServices.some({ serviceId, isActive: true }) condition to the staff lookup in createAppointment, createPublicBooking, and createRecurringAppointment, matching the v1 and /api/bookings routes, so a staff member can only be booked 
- **[MEDIUM]** Recurring series generation: no advisory lock and DST/clock-shift drift in occurrence times
    - `src/lib/actions/recurring.ts:90-136` — Wrap the action-layer recurring create in a $transaction with lockStaffSchedule + per-occurrence conflict check (mirror the v1 recurring route) and verify staffServices. For DST, normalize each occurrence's wall-clock time after the date ar
- **[MEDIUM]** resizeAppointment and /api/bookings POST lack the advisory lock (residual double-booking race)
    - `src/lib/actions/appointments.ts:446-479` — Add lockStaffSchedule to resizeAppointment's transaction (key on the lead staffId) and to /api/bookings POST (lock + re-check conflict for each service's staffId inside the create transaction, not via isSlotAvailable outside it).
- **[MEDIUM]** BOOKING-EXCLUSION-CONSTRAINT-001 not implemented — no DB-level overlap guarantee exists
    - `prisma/schema.prisma:773-804` — Prioritize completing the lock on all write paths immediately (cheap, two lines each), then schedule the EXCLUSION-CONSTRAINT work (btree_gist + generated tstzrange + partial EXCLUDE ignoring cancelled/no_show, with a pre-migration overlap 
- **[MEDIUM]** Availability and slot-validation use server-local time (getDay/setHours), not business timezone — off-by-a-day and wrong-window bugs
    - `src/lib/availability.ts:37,294-298` — Resolve the business/location timezone and perform day-of-week, day-boundary, and time-of-day composition in that timezone (e.g. via date-fns-tz) rather than the server's local zone. Store/use a location timezone field and apply it consiste
- **[LOW]** Availability existing-appointment query treats no_show as still-blocking and uses inclusive day-boundary that drops boundary-spanning appointments
    - `src/lib/availability.ts:87-102` — Change the status filter to notIn ['cancelled','no_show'] to match all create/conflict paths, and change the day-window filter to an overlap test (startTime < endOfDay AND endTime > startOfDay) instead of full-containment so boundary-spanni
- **[LOW]** Waitlist promotion (bookFromWaitlist) does no validation and is not atomic with appointment creation
    - `src/lib/actions/waitlist.ts:92-112` — Verify the target appointment exists and is scoped to businessId (and ideally matches the entry's client/service/staff), guard the transition to only fire from waiting/notified, and ideally create the appointment + promote the entry in one 

## Prisma schema & data integrity — 10 findings (4 high)

- **[HIGH]** OAuth authorization code can be replayed (non-atomic check-then-mark-used)
    - `src/app/api/oauth/token/route.ts:46-77` — Make consumption atomic: run the mark-used + token-create in prisma.$transaction, and mark the code used with a conditional update that only succeeds if still unused, e.g. `updateMany({ where: { id, usedAt: null }, data: { usedAt: new Date(
- **[HIGH]** Recurring appointment series created without a transaction (partial-write series)
    - `src/lib/actions/recurring.ts:91-132` — Wrap the entire occurrence loop in prisma.$transaction(async (tx) => { ... }) so the whole series commits or rolls back atomically. Note this also skips the lockStaffSchedule/conflict check that the single-appointment path uses, so recurrin
- **[HIGH]** Group booking creates appointment + service + N participants without a transaction
    - `src/lib/actions/recurring.ts:234-278` — Wrap all writes in prisma.$transaction and use createMany for participants. Add the staff conflict check/advisory lock as in the other booking paths.
- **[HIGH]** Checkout sells products but never decrements inventory
    - `src/lib/actions/checkout.ts:115-160` — Inside the same transaction, for each product item decrement ProductInventory.quantity at the sale location and insert an InventoryTransaction (type: sale, negative quantityChange, quantityAfter). Guard against negative resulting stock.
- **[MEDIUM]** Stock adjustment splits inventory update and ledger row across two non-transactional writes
    - `src/lib/actions/products.ts:113-135` — Wrap both writes in prisma.$transaction. Prefer an atomic { quantity: { increment: adjustment } } update and read the returned value for quantityAfter, with a CHECK or post-validation that quantity >= 0 (a DB CHECK constraint on product_inv
- **[MEDIUM]** WaitlistEntry references clients/services/staff/appointments with no foreign keys
    - `prisma/schema.prisma:1476-1499` — Add proper relations (client Client @relation(...), service Service?, staff Staff?, appointment Appointment?) with appropriate onDelete (Cascade for client, SetNull for service/staff/appointment) and @@index on clientId/serviceId/staffId.
- **[MEDIUM]** Public booking find-or-create client has no unique constraint to prevent duplicates
    - `src/lib/actions/public-booking.ts:87-105` — Add a partial unique constraint on (businessId, lower(email)) where email is not null (via raw migration, since Prisma can't express lower()/partial directly), and/or use prisma upsert on that unique target.
- **[LOW]** AppointmentService conflict query has no index on the time columns it filters
    - `prisma/schema.prisma:799-802` — Add @@index([staffId, startTime, endTime]) on AppointmentService (a range-friendly composite). Long term consider a GiST exclusion constraint on the time range for true DB-level overlap prevention.
- **[LOW]** GiftCard has no unique link / GiftCard code lacks business scoping; no redemption ledger
    - `prisma/schema.prisma:932-955` — Implement gift-card redemption inside the payment $transaction: look up by code scoped to businessId, verify isActive/expiresAt/balance, and decrement currentBalance with an atomic guarded update; record a redemption ledger row. Until imple
- **[LOW]** Membership creation/decrement not transactional; nextBillingDate set to start date
    - `src/lib/actions/memberships.ts:122-152` — Compute nextBillingDate as startDate + one billing cycle. Add @@unique on Membership for (clientId, planId) limited to active status (partial index via raw migration), and decrement sessionsRemaining atomically within the booking transactio

## Server actions correctness — 12 findings (1 high)

- **[HIGH]** processPayment never decrements product inventory (stock math missing)
    - `src/lib/actions/checkout.ts:115-155` — Within the payment transaction, for each product item decrement productInventory.quantity (guarding against negatives) and record an inventoryTransaction of type 'sale'.
- **[MEDIUM]** submitForm trusts caller-supplied clientId/appointmentId without ownership check (cross-tenant write)
    - `src/lib/actions/forms.ts:116-143` — Call assertClientOwned(parsed.clientId, businessId) and, when present, verify the appointment belongs to businessId before creating the submission.
- **[MEDIUM]** addToWaitlist does not verify client/service/staff belong to the caller's business
    - `src/lib/actions/waitlist.ts:20-44` — Add assertClientOwned(parsed.clientId, businessId), and assertServicesOwned/assertStaffOwned for the optional ids before creating the entry (mirror the public-booking checks).
- **[MEDIUM]** createStaff and updateStaffServices attach serviceIds without ownership validation
    - `src/lib/actions/staff.ts:174-180,201-233` — Call assertServicesOwned(parsed.serviceIds, businessId) in both createStaff and updateStaffServices before inserting staffService rows.
- **[MEDIUM]** Recurring and group bookings skip double-booking and working-hours checks
    - `src/lib/actions/recurring.ts:90-136,236-279` — Wrap each occurrence in the same transaction + lockStaffSchedule + overlap conflict check (and assertSlotAllowed) used by createAppointment; for series, decide whether to skip or fail conflicting occurrences explicitly.
- **[MEDIUM]** createPublicBooking ignores working hours, time off, and business booking settings
    - `src/lib/actions/public-booking.ts:108-170` — Load getBookingSettings(businessId) and enforce minLeadTime/maxAdvanceBooking; call assertSlotAllowed for the slot; reject past start times. Mirror the working-hours enforcement already present in rescheduleAppointment.
- **[MEDIUM]** updateAppointmentStatus performs no status-transition validation
    - `src/lib/actions/appointments.ts:189-265` — Define allowed transitions (e.g. completed/cancelled/no_show are terminal), reject illegal ones, clear obsolete timestamps when changing state, and re-check slot conflicts when re-activating a cancelled appointment.
- **[MEDIUM]** acceptInvitation does not bind token email to invitation and can re-link existing users
    - `src/lib/actions/invitations.ts:168-277` — Validate payload.email===invitation.email and payload.businessId===invitation.businessId; do not mutate an existing active user's global role on invitation acceptance (membership/role should be per-business, or at minimum never downgrade an
- **[MEDIUM]** Password reset relies on NEXTAUTH_SECRET which may be undefined at module load
    - `src/lib/actions/password-reset.ts:12-14; src/lib/actions/invitations.ts:13` — Fail fast if process.env.NEXTAUTH_SECRET is missing or short (throw at module init), or read through a validated env module. Ensure the same secret is required in deployment.
- **[MEDIUM]** In-memory rate limiter is ineffective on serverless/multi-instance deployments
    - `src/lib/rate-limit.ts:11-50` — Back the limiter with a shared store (e.g. @upstash/ratelimit / Redis) as the file's own comment recommends, before relying on it for auth-sensitive flows.
- **[LOW]** Many actions return raw exception messages to the client (internal leak)
    - `src/lib/actions/clients.ts:138,156; src/lib/actions/services.ts:161,181,197; src/lib/actions/invitations.ts:134,162,275,313,352; src/lib/actions/appointments.ts:263,414,495` — Log the real error server-side and return a generic message (e.g. 'Something went wrong') for unrecognized errors, as register.ts and checkout.ts already do for the unknown-error branch.
- **[LOW]** createPublicBooking is not idempotent and can race-create duplicate clients
    - `src/lib/actions/public-booking.ts:88-106; src/lib/actions/clients.ts (createClient)` — Use prisma.client.upsert on a (businessId,email) unique constraint, or add the constraint at the DB level so concurrent creates collapse to one row.

## Config, secrets & deploy safety — 7 findings (1 high)

- **[HIGH]** Database seed creates an owner account with the password literally 'password'
    - `/tmp/sal-review-main/prisma/seed.ts:68-81,658` — Never run this seed against production. Guard it: refuse to run if NODE_ENV==='production' or if DATABASE_URL is not localhost. For any demo data needed in prod, generate a random password (or require it via env) and do not log credentials.
- **[MEDIUM]** Stripe publishable-key variable name mismatch between .env.example and code — live checkout will silently fail
    - `/tmp/sal-review-main/.env.example:48 vs src/components/checkout/stripe-payment.tsx:16` — Rename the .env.example entry to `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (and remove/rename the obsolete STRIPE_PUBLIC_KEY) so the documented var matches code and the validator. Run `npm run check:env` against the real production env before la
- **[LOW]** No live secrets are committed to the repository (clean)
    - `/tmp/sal-review-main/.gitignore:1, git history` — No action needed. Keep secrets in Vercel Production env vars (which the launch checklist confirms is the practice). Continue to never commit real .env files.
- **[LOW]** Env validation script (check:env) is not wired into the build or any pre-deploy gate
    - `/tmp/sal-review-main/package.json:7,11` — Add a pre-deploy gate: either `"build": "node scripts/validate-env.mjs && prisma generate && next build"` (guarded to only run in production/CI) or a Vercel Ignored Build Step / CI step that runs check:env. Document it in the launch checkli
- **[LOW]** Real Supabase project URL/ref committed in .env.example and docs/OVERVIEW.md
    - `/tmp/sal-review-main/.env.example:18, docs/OVERVIEW.md:273` — Replace with a placeholder like `https://YOUR-PROJECT-REF.supabase.co` in .env.example and the doc. Ensure Supabase Row Level Security and network restrictions are enabled since the project ref is effectively public. (Low because the URL is
- **[LOW]** Public, unauthenticated OAuth Dynamic Client Registration endpoint with no rate limiting
    - `/tmp/sal-review-main/src/app/api/oauth/register/route.ts:5-56, src/middleware.ts:26` — Add rate limiting (e.g. Vercel WAF rule or per-IP throttle) to /api/oauth/register and consider a TTL/cleanup for unused clients. Reconsider granting blanket admin role to OAuth tokens; scope tokens to least privilege. Add an audit/cap on c
- **[LOW]** next.config.mjs is safe — no ignoreBuildErrors/ignoreDuringBuilds, good security headers, but CSP allows 'unsafe-inline' scripts
    - `/tmp/sal-review-main/next.config.mjs:7-37` — Tighten CSP by removing 'unsafe-inline' from script-src and adopting a nonce-based CSP (Next.js supports nonces via middleware) once feasible. Optionally narrow img-src https: to specific hosts. Headers and build-error settings are good as-

## Stripe & checkout — 5 findings (0 high)

- **[MEDIUM]** Tax and tip are trusted from the client — server never recomputes tax from TAX_RATE, allowing underpayment / tax fraud
    - `src/lib/actions/checkout.ts:30-32, src/lib/checkout/record-checkout.ts:87, src/app/api/v1/checkout/route.ts:76` — Compute tax server-side as Math.round((subtotal - discount) * TAX_RATE * 100)/100 inside recordCheckout / processPayment / the v1 route, and either ignore the client-supplied tax or reject the request if it disagrees beyond a rounding toler
- **[MEDIUM]** Gift card payment method accepts payment with zero balance enforcement — no redemption, no balance deduction, no double-spend protection
    - `src/lib/checkout/record-checkout.ts:162-177, src/components/checkout/payment-dialog.tsx:381-386` — Either remove 'gift_card' from the accepted PaymentMethod enums until implemented, or implement redemption inside the checkout transaction: lock the GiftCard row (SELECT ... FOR UPDATE / serializable tx), verify isActive && !expired && curr
- **[MEDIUM]** payment_intent.succeeded handler flips appointment to 'confirmed' instead of 'completed' and never re-validates the amount path is the only success source
    - `src/app/api/stripe/webhook/route.ts:110-118; src/app/api/stripe/create-payment-intent/route.ts:121-138` — Route the webhook success handler through the same recordCheckout side-effect writer (or replicate client-total/loyalty/commission/inventory updates) and use a consistent terminal status so online and in-person payments produce identical le
- **[MEDIUM]** dashboard-link route accepts an arbitrary accountId from the request body without verifying ownership
    - `src/app/api/stripe/dashboard-link/route.ts:12-22` — Look up the caller's business (where ownerId/members include session.user.id) and assert business.stripeAccountId === accountId before creating the login link; never accept the account id from the client.
- **[LOW]** Connect onboarding refresh re-uses an existing Stripe account without re-checking the business is still owned/valid scoping path
    - `src/app/api/stripe/connect/route.ts:13-50` — Derive businessName and email from the looked-up business record rather than trusting the request body, so the Stripe account profile cannot be seeded with attacker-controlled values.

## Frontend & React quality — 8 findings (0 high)

- **[MEDIUM]** Notification read-state is never persisted (toast-only / local-only stub flow)
    - `src/components/dashboard/notification-dropdown.tsx:97-111,201` — Add a server action (e.g. markNotificationRead/markAllRead) called from these handlers, or accept that read-state is ephemeral and remove the unread badge. Wire 'View All' to a real route or remove it.
- **[MEDIUM]** Recurring & group-booking inputs are collected but never submitted (dead UI)
    - `src/components/calendar/new-appointment-dialog.tsx:218-236` — Either extend createAppointment to accept and act on recurrence/group params, or hide those controls until the backend supports them so the UI doesn't promise behavior it doesn't deliver.
- **[MEDIUM]** Header 'select all' checkbox indeterminate state is silently broken
    - `src/app/(dashboard)/clients/client.tsx:299-304` — Pass `checked={allSelected ? true : someSelected ? "indeterminate" : false}` and style the indeterminate indicator, instead of the unsupported boolean prop.
- **[MEDIUM]** Numerous primary actions are toast-only stubs (dead buttons)
    - `src/app/(dashboard)/clients/client.tsx:424-431` — Wire these to real actions or, at minimum, change the misleading success toasts to neutral 'coming soon' info toasts and visually mark unimplemented actions as disabled/badged so users aren't told an action succeeded when nothing happened.
- **[LOW]** Staggered list animations scale delay with index, causing multi-second reveal on large lists
    - `src/app/(dashboard)/clients/client.tsx:89,343` — Cap the stagger (e.g. `delay: Math.min(index, 12) * 0.03`) or use a parent `staggerChildren` with a max, and disable per-item entrance animation beyond the first viewport. For large tables also consider virtualization.
- **[LOW]** Notifications and search data eagerly fetched on every dashboard navigation
    - `src/components/dashboard/notification-dropdown.tsx:67-93` — Defer the fetch until the dropdown is opened (like CommandMenu's `if (!open) return`), or hoist notifications to a server component / shared provider so they aren't refetched on every page.
- **[LOW]** Header session via client useSession adds a client round-trip and unauth flash
    - `src/components/dashboard/header.tsx:1,30` — Fetch the user in the server layout via `auth()` and pass name/email/avatar down as props, or keep useSession but render a stable skeleton. Confirm no secret-bearing fields beyond name/email are exposed to the client session.
- **[LOW]** Dead form abstraction: react-hook-form/zod wrapper exists but no form uses it; validation is hand-rolled and unshared
    - `src/components/ui/form.tsx:125` — Either delete the unused ui/form.tsx to reduce confusion, or adopt it with shared zod schemas (define schemas in lib and import in both the server action and the client form) so client validation provably matches server validation.