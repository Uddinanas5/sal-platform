# SAL SaaS Launch Checklist

Last updated: 2026-05-31

This is the plain-English launch plan for SAL. The goal is to get SAL into a real beta with salons safely, then add payments and SMS when those accounts are ready.

## Current Verdict

SAL is close enough for a controlled booking/email beta, but not ready for a full paid SaaS launch yet.

The code builds, lint passes, and the launch safety script passes. Production is live at https://www.meetsal.ai, and Vercel has production database, auth, and email variables configured.

The biggest missing items are:

- A full live smoke test with a real test salon account.
- Stripe live keys and webhook setup before online payments can be offered.
- Resend domain/delivery proof before relying on email for customers.
- SMS provider and compliance setup before SMS can be offered.
- Final legal/support/business operations before inviting real paying customers.

## Launch Mode Recommendation

Start with a private beta:

- 3 to 5 salons only.
- Booking, calendar, clients, services, staff, and email enabled.
- Online payments disabled until Stripe is connected and tested.
- SMS disabled until Twilio or another provider is connected and compliance is complete.
- Beta users report issues directly to one support inbox.

This avoids blocking the whole launch on Stripe/SMS while still letting real salons validate the core product.

## What Is Already In Good Shape

- Production site is live on Vercel.
- Health endpoint is responding.
- `pnpm build` passes.
- `pnpm lint` passes.
- `pnpm check:launch` passes.
- Booking write paths have database locking checks.
- Public booking references use cryptographic randomness.
- Checkout totals are recalculated server-side.
- Stripe webhook code validates amount and currency before completing records.
- API key auth handles the `sal_` prefix correctly.
- Staff invitation and password reset secrets fail closed if auth secrets are missing.
- Staff appointment access is restricted for non-admin staff.
- Public booking cancellation checks the booking email and cancellation window.

## Launch Blockers

### 1. Live Smoke Test

Status: Required before inviting beta users.

We need to test SAL like a real salon owner and customer:

- Register a salon owner.
- Complete onboarding.
- Add at least one service.
- Add at least one staff member.
- Set staff schedule and business hours.
- Open the public booking link.
- Book an appointment as a customer.
- Confirm the appointment appears in the dashboard/calendar.
- Reschedule the appointment.
- Cancel the appointment.
- Confirm booking management works from the public manage-booking link.
- Confirm emails are received.

Needed from owner:

- Business name.
- Owner name.
- Owner email.
- Temporary password.
- Services.
- Staff names.
- Business hours.
- Preferred booking slug.

### 2. Stripe Payments

Status: Not ready until Stripe access is available.

Missing Vercel production variables:

- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

Required Stripe setup:

- Create or access the Stripe account.
- Use live API keys, not test keys, for production.
- Configure webhook endpoint:

```text
https://www.meetsal.ai/api/stripe/webhook
```

- Copy the `whsec_...` webhook signing secret into Vercel.
- Run a preview test first.
- Run a production payment test with a real small transaction.
- Confirm payment ledger, receipt, and webhook completion.

Beta decision:

- Keep online payments disabled until this is complete.
- Allow salons to collect payment in person during beta.

### 3. Email Delivery

Status: Configured, but must be proven.

Vercel has:

- `RESEND_API_KEY`
- `EMAIL_FROM`

Still required:

- Confirm the Resend sending domain is verified.
- Confirm SPF/DKIM records are active.
- Strongly consider DMARC for better deliverability.
- Send real emails to Gmail, Outlook, and iCloud if possible.
- Test password reset email.
- Test staff invitation email.
- Test booking confirmation email.
- Test booking cancellation email.
- Confirm email sender name and address look professional.

### 4. SMS

Status: Not ready. Keep disabled.

Required before enabling:

- Pick SMS provider, likely Twilio.
- Buy or configure sending number.
- Complete A2P 10DLC registration for US business texting.
- Add explicit customer opt-in language.
- Add opt-out handling such as STOP/HELP.
- Store consent and source of consent.
- Add message logs and failure handling.
- Test deliverability.

Beta decision:

- Do not offer SMS in beta.
- Use email only.

### 5. Legal Pages

Status: Must be reviewed before real customers.

Required:

- Privacy Policy.
- Terms of Service.
- Cancellation/refund policy.
- Acceptable use language.
- Data deletion request process.
- Support contact.
- Company/contact information.

Important: SAL stores client names, emails, phone numbers, appointment history, and business data. That makes privacy and data handling real, not optional.

### 6. Support Operations

Status: Needed for beta.

Required:

- Create a support inbox, for example `support@meetsal.ai`.
- Decide who answers support.
- Create a simple bug-report template.
- Track issues in GitHub or a spreadsheet.
- Define emergency contact flow if booking breaks.
- Define response expectations for beta users.

### 7. Monitoring And Backups

Status: Needs confirmation.

Required:

- Confirm database backups are enabled in Supabase.
- Confirm Vercel deployment/error visibility.
- Confirm Resend email failure visibility.
- Add simple manual daily check during beta:
  - site loads
  - login works
  - public booking works
  - email sends
  - health endpoint works
- Decide how to roll back a bad Vercel deployment.

### 8. Product Scope Cleanup

Status: Some surfaces should be hidden or labeled during beta.

Areas to review:

- Marketing campaigns.
- Automated messages.
- Memberships/gift cards.
- Reviews.
- Inventory suppliers.
- Reports/PDF export.
- API/MCP access.
- Checkout wallet/gift card flows.

Decision rule:

- If a feature is not fully tested, either hide it from beta users or mark it as beta/internal.
- Do not let beta salons depend on SMS or online payments until they are actually connected.

### 9. Security Checklist

Status: Core code improved, but operational checks remain.

Required:

- Rotate any secret/token that may have been pasted into chat or terminal output.
- Confirm production secrets exist only in Vercel/Supabase/Stripe/Resend dashboards, not committed files.
- Confirm `.env.local` and similar secret files are gitignored.
- Confirm every admin/staff action is scoped to the current business.
- Confirm staff users cannot see other businesses.
- Confirm public booking cannot expose private notes.
- Confirm API keys can be revoked.
- Confirm password reset and invite links expire.
- Confirm rate limiting on login and sensitive flows.

### 10. Beta Success Criteria

SAL is ready to invite the first beta salon when all of these are true:

- Owner can register/login.
- Owner can complete onboarding.
- Owner can create services.
- Owner can invite or create staff.
- Staff schedule works.
- Public booking page works.
- Customer can book successfully.
- Owner can view, reschedule, cancel, and complete appointment.
- Customer receives email confirmation.
- Customer can manage/cancel booking using the booking reference flow.
- No untested payment/SMS promises are visible.
- Support inbox is ready.
- Privacy/terms pages are acceptable for beta.

## Exact Next Steps

### Step 1: Provide Test Salon Details

Send these details so we can run the live smoke test:

```text
Business name:
Owner name:
Owner email:
Temporary password:
Services:
Staff names:
Business hours:
Preferred booking slug:
```

Use a temporary password only.

### Step 2: Run Live Smoke Test

Run through the whole live product with the test salon. Record every issue as:

```text
Issue:
Page:
Steps to reproduce:
Expected:
Actual:
Severity:
```

### Step 3: Fix Beta Blockers

Fix anything that blocks:

- login
- onboarding
- service creation
- staff setup
- public booking
- appointment visibility
- cancellation/reschedule
- email delivery

### Step 4: Prepare Beta Invite

Before inviting salons:

- Decide beta pricing: free, discounted, or paid.
- Create a short onboarding call script.
- Create support email.
- Prepare a simple known-limitations note:
  - payments not enabled yet
  - SMS not enabled yet
  - beta users should report issues quickly

### Step 5: Add Stripe Later

When Stripe access is available:

- Add live Stripe keys to Vercel.
- Add webhook endpoint.
- Redeploy.
- Test a real small payment.
- Only then enable payments for beta salons.

### Step 6: Add SMS Later

When SMS access and compliance are ready:

- Add SMS provider.
- Add consent language.
- Add opt-out handling.
- Add logs and failure handling.
- Test with internal users first.
- Enable for one beta salon before broad release.

## Research References

- Stripe Connect docs: https://docs.stripe.com/connect
- Stripe webhooks docs: https://docs.stripe.com/webhooks
- Resend domain verification docs: https://resend.com/docs/dashboard/domains/introduction
- Twilio A2P 10DLC docs: https://www.twilio.com/docs/messaging/compliance/a2p-10dlc
- Vercel environment variable docs: https://vercel.com/docs/environment-variables
- FTC Protecting Personal Information guide: https://www.ftc.gov/business-guidance/resources/protecting-personal-information-guide-business
- OWASP Authorization Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html
