# SAL Launch Readiness

This document is the plain-English checklist for getting SAL ready to launch.

## What Has Been Hardened

- Appointment booking now uses database transaction locks so two people cannot book the same staff member into the same time slot.
- Public booking, dashboard booking, REST API booking, recurring booking, group booking, and MCP booking now share the same booking-safety rules.
- Booking references are now generated with cryptographic randomness instead of timestamp-style short random values.
- Public booking cancellation verifies the booking email and enforces the cancellation window.
- REST API keys now authenticate correctly with the `sal_` key prefix shown to customers.
- Checkout totals are calculated on the server from business-owned services/products instead of trusting browser-submitted prices.
- Stripe payment intents create a SAL payment ledger row, and Stripe webhooks validate amount and currency before completing payment records.
- Staff invitation and password reset tokens now fail closed if `NEXTAUTH_SECRET` is missing.
- Staff-level access is narrowed so staff can only manage appointments they are assigned to unless they are admin or owner.
- Tenant-owned IDs such as categories, products, resources, services, clients, and team members are validated against the current business before use.
- A launch safety script now checks the highest-risk protections:

```bash
pnpm check:launch
```

- A production environment preflight now checks required launch secrets and URL safety:

```bash
pnpm check:env
```

- Fresha-inspired guardrails now check risky migrations, transaction side effects, and database health:

```bash
pnpm check:migrations
pnpm check:transactions
pnpm check:db
```

See `docs/FRESHA_INSPIRED_GUARDRAILS.md`.

## Still Needed Before Real Customers

- Add real production environment values in Vercel or the hosting platform:
  - `DATABASE_URL`
  - `NEXTAUTH_SECRET`
  - `NEXTAUTH_URL`
  - `NEXT_PUBLIC_APP_URL`
  - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - `RESEND_API_KEY`
  - `EMAIL_FROM`
- Configure the Stripe webhook endpoint to point at:

```text
https://YOUR_DOMAIN/api/stripe/webhook
```

- Run a full staging smoke test:
  - Register a business.
  - Add staff, services, clients, and products.
  - Create, reschedule, cancel, and complete appointments.
  - Book through the public booking flow.
  - Process a checkout payment.
  - Confirm email delivery for booking confirmation, cancellation, invitations, and password reset.
  - Create and use a REST API key.

## Important Note

No software is literally 100% bulletproof. The goal for launch is that critical money, booking, authentication, and tenant-isolation paths are defensive, verified, and easy to re-check. At this point the codebase is materially safer, but it still needs real production credentials and live staging verification before taking paying customers.
