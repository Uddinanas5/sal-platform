# SAL — Handoff: Human-Input-Needed Items

Running log of everything that requires Anas (live keys, dashboard config, account
approvals, deploy steps) — i.e. things code alone cannot complete. Each is stubbed
cleanly in code and marked `// HUMAN_INPUT_NEEDED:` where applicable.

> Environment note: this hardening pass runs in a sandbox with **no live Postgres**.
> All logic + mock-Prisma unit tests run here and are green; **true DB-integration
> tests and live cross-tenant probing must be re-run against a real database** (see
> "Testing limits" at the bottom).

## Deploy steps (run at release)

1. **Apply DB migrations to production (Supabase).** The Vercel build runs
   `prisma generate && next build` — it does NOT auto-migrate. After merging the PRs
   that add migrations, run:
   ```bash
   prisma migrate deploy
   ```
   Migrations added so far:
   - `20260602160000_add_cancellation_reasons` (nullable cols + 2 enums — safe)
   - _(more may be added by this hardening pass; see git log of prisma/migrations)_

2. **Confirm no `admin@sal.app` / `password` account exists on prod.** The seed is
   now guarded against non-localhost DBs, but verify the live DB has no such owner.

## Accounts / dashboard config (no code)

3. **Resend domain** — verify **meetsal.ai** (add SPF + DKIM records to DNS), set a
   DMARC policy, and confirm `EMAIL_FROM` in Vercel is a verified `@meetsal.ai`
   sender. Optionally set `EMAIL_REPLY_TO=support@meetsal.ai`. Code defaults are in
   `src/lib/email.ts`.
4. **support@meetsal.ai** — create + monitor this inbox before any beta salon.
5. **Stripe** — complete identity/business verification + enable Connect on the live
   account before SAL Payments is turned on. Decide whether SAL takes an application
   fee. (SAL Payments UI is intentionally disabled until then.)
6. **SAL subscription billing pricing** — deferred (beta is free). When ready to
   charge: decide price, create Stripe Products/Prices, then the billing build can go
   live.
7. **Monitoring** — create a free **Sentry** project (for the DSN) + an uptime
   monitor (UptimeRobot/BetterStack) pointed at homepage, login, a booking page, and
   `/api/health`.
8. **Supabase backups** — confirm plan; enable daily backups (Pro) or set up regular
   CLI exports (Free). Consider PITR once real salons depend on SAL.

## Known env (not a code bug)

- `execution/bug-log.md` logs "local Postgres unreachable" — that's a local/env
  issue, not a code fix. Production uses the Supabase pooler.

## Live-verification needed before merge/launch (code is done, sandbox has no DB)

- **Public booking click-through** (PR #31) — the slot UI was rewritten to use
  `/api/availability`. Build/type-verified, but do one real run on a preview:
  service → staff → date → confirm a booking; and confirm a fully-booked day
  shows the waitlist. The server-side re-validation (P0-006) is the guardrail
  that makes this safe even if the UI has an edge bug.
- **Cross-tenant probing** across every endpoint + MCP tool (needs 2 real tenants
  in a live DB). Unit tests assert call-args/scoping; live probing confirms it.
- **Booking concurrency** under real parallel load (advisory locks are in place;
  verify with concurrent requests against Postgres).
- **End-to-end public booking → Resend email delivery → dashboard reflection.**

## Remaining backlog — specced & ready to build (need a live DB to verify, so not shipped unverified)

These are fully designed; each needs `prisma migrate dev` against a real DB and/or
runtime verification, so they were not shipped as "done" in the sandbox.

1. **GAP-037 — payment tender breakdown.** The `other` payment bucket has no
   sub-type, so EOD reconciliation can't break it down. DECISION NEEDED (Anas +
   you): (a) widen `PaymentMethod` enum with named tenders
   (`mobile_wallet`/`bank_transfer`/`store_credit`/region-specific) and retire
   `other`, OR (b) add a nullable `methodNote String?` on `Payment`. Then:
   migration, thread the field through the 3 checkout entry points
   (`actions/checkout.ts`, `api/v1/checkout/route.ts`, `mcp/tools/checkout.ts`),
   capture it in `payment-dialog.tsx`, and group by it in `queries/reports.ts`.
   Backfill existing `other` rows as nullable. (enum/zod alignment is already done.)
2. **P0-007 — public self-service reschedule.** Add
   `reschedulePublicBooking(ref, email, newStartTime)` to `public-booking.ts`
   (email-verify + duration recompute + `assertSlotAllowed`/advisory-lock + reschedule
   email + revalidate), and replace the contact-info panel on
   `book/manage/[bookingReference]/client.tsx` with a real date/time picker reusing
   the `/api/availability` fetch from PR #31. Also add a cancellation-window check to
   `cancelPublicBooking`. Needs a live DB to prove no double-book.
3. **P0-008 — manage-URL in dashboard reschedule email.** The public confirmation
   email already includes the manage URL. Thread the same `manageUrl` into the
   reschedule email in `actions/appointments.ts` (the one unmet criterion). Small,
   code-only — left out of this pass only to avoid stacking another edit on the
   already heavily-touched `appointments.ts`.
4. **One-off time blocks** (founder request). New `TimeBlock` model (staffId,
   locationId, start, end, reason) + migration; add the blocks to
   `availability.ts` blocked ranges (alongside breaks/time-off) and to
   `assertSlotAllowed`; a "Block time" calendar UI. Build-verifiable but a sizeable
   feature; deferred to keep this pass's PRs reviewable + verifiable.

## Adversarial-pass leftovers (confirmed real, follow-up needed)

Two adversarial passes (attack → fix → re-run) drove confirmed findings from
**16 → 9 → only the infra/migration/LOW residuals below**. Fixed across PR #34 +
#31: staff-break write-path bypass, MCP endpoint gated off, server rejects fake
card/gift-card methods, checkout already-paid idempotency (dashboard **and**
/api/v1/checkout), `createPublicBooking` full re-validation, configured lead-time
+ max-advance enforcement, time-off UTC-date off-by-one (authoritative write
path), cross-tenant group-participant `clientId`, v1 time-off admin gate, and the
seed host-anchoring. These remain (need a migration, shared store, the
developer-API launch, or are LOW):

1. **Stripe webhook idempotency** — no event dedup; a replayed/out-of-order event
   can re-apply side effects or flip a completed payment to failed. Add a
   `StripeEvent` table (unique on Stripe event id), skip already-processed
   events, and make `payment_intent.succeeded/failed` not regress a terminal
   payment/appointment status. Needs a migration. (MEDIUM)
2. **Rate limiting** — the in-memory limiter is per-instance (ineffective on
   serverless) and the booking limiter is keyed only on the attacker-supplied
   email. Move to a shared store (e.g. Upstash Redis) and add an IP/business
   fallback key. Needs infra. (MEDIUM)
3. **MCP tool tenant-hardening** — when you intentionally launch the developer
   API (`MCP_ENABLED=true`), the MCP tools must first be hardened: route
   `process-checkout` through the same server-side price recompute the dashboard
   uses, and scope every foreign id (clientId/staffId/categoryId/serviceIds) to
   `ctx.businessId`. Until then the endpoint is gated off, so this is not a beta
   blocker.
4. **Availability read-path timezone** — `availability.ts` builds the day window
   in the server's local TZ (a no-op on Vercel's UTC host, but it should use the
   business timezone). The authoritative write-path guard (`assertSlotAllowed`)
   is already UTC-correct, so this is a slot-display/UX issue, not an exploit.
   Fold into the broader business-TZ correctness work. (LOW)
5. **Group-participant race** — `addGroupParticipant` does a check-then-insert
   without a lock, so a burst could exceed `maxParticipants`. Add an advisory
   lock or a DB constraint. (LOW)
6. **Checkout idempotency TOCTOU** — the already-paid guard runs just before the
   transaction; a tight double-submit could still slip through. Add a DB unique
   constraint on (appointmentId, completed payment) or move the check inside the
   tx. (LOW)

## Testing limits (this sandbox)

No live Postgres here, so: all tests are mock-Prisma + pure-logic (they assert
call-args, ordering, and response envelopes — green, 33 passing, 3× no flakes).
True DB-integration tests, live cross-tenant probing, and the booking
click-through must run against a real database/preview before launch.

_(Updated continuously by the hardening pass.)_
