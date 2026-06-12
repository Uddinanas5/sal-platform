# Loop 8 — Adversarial ToS review fixes (amendments to PR #42)

**Date:** 2026-06-12
**Branch:** `loop/disputes` (PR #42 — amends the loop-7 dispute work in place)
**Source:** ~/SAL-ToS-Review-Memo.md — 3-lens adversarial review of ToS §7
(chargebacks), deduped. NOT legal advice; lawyer items deliberately excluded.

## Finding → fix table

| Memo finding | Fix | Where |
| --- | --- | --- |
| #4 — ToS acceptance never persisted (checkbox only gated the button) | `User.tosAcceptedAt` + `User.tosVersion` written at registration; acceptance validated SERVER-side (zod `refine`, a crafted request can't skip it); `TOS_VERSION` constant is the single source of truth and also renders the /terms "Last updated" line, so page and record can never drift | `prisma/schema.prisma`, `prisma/migrations/20260611230000_consent_acceptance/` (+ `rollback.sql`), `src/lib/tos-version.ts`, `src/lib/actions/register.ts`, `src/app/register/page.tsx`, `src/app/terms/page.tsx` |
| #5 — "Respond in Stripe" CTA sent merchants to their Express dashboard, where the dispute does NOT exist (destination charges live on SAL's platform account) | Banner CTA is now a **mailto to SAL support**; copy: reply with your evidence — **we submit it to the card network for you**. Support address resolved server-side via new `getSupportEmail()` (`SUPPORT_EMAIL` → `EMAIL_REPLY_TO` → `support@meetsal.ai`), the SAME resolver used as reply-to on the owner dispute email, so both paths land in one inbox | `src/components/dashboard/dashboard-layout.tsx`, `src/app/(dashboard)/layout.tsx`, `src/lib/email.ts`, `.env.example` |
| #10 — ToS promised "we will notify you … by email" but only ALERT_EMAIL (founder) was emailed | Business OWNER now emailed on dispute **created** (act now: reply with evidence) and **closed** (won/lost/other outcome copy); founder ALERT_EMAIL copy kept on every applied event; owner path is post-DB best-effort (own try/catch — a lookup failure can never 500 the webhook, because a Stripe retry would be swallowed as stale by the watermark and lose the notice forever); not sent on `updated` (status churn = noise) nor for orphans (no business) | `src/lib/billing/disputes.ts` |
| #13 — Booking page claimed "you agree to the cancellation policy" with no policy shown or logged | Confirm step now displays the business's REAL cancellation window (the same `cancellationWindow` enum `cancelPublicBooking` enforces) above the Confirm button, and `createPublicBooking` stamps `Appointment.policyAcceptedAt` — the "cancellation-policy consent" evidence ToS §7 references now actually exists. NULL for internal/API/MCP bookings (no policy shown there; consent is never fabricated) | `src/app/book/[businessSlug]/page.tsx`, `client.tsx`, `src/lib/actions/public-booking.ts`, same migration as #4 |
| #2 — recovery waterfall missing (Patch 1) | Setoff against any amounts payable, transfer reversal to "the Stripe connected account associated with your business", card-on-file debit, pay-on-demand invoice (7 days), collection costs, withhold-while-pending with release-on-win; $15 fee collection now phrased as merchant **authorization** via the same methods | `src/app/terms/page.tsx` §7 |
| #1 — nothing survived cancellation (Patch 2) | Survival sentence in §7 + matching sentence in §9 (Sections 6, 7, 10 survive; pre-termination payments stay the business's responsibility) | `src/app/terms/page.tsx` §7, §9 |
| #5 (ToS side) — evidence clause assigned merchants a job they cannot do (Patch 3) | Merchant provides evidence to SAL by SAL's (possibly earlier) deadline; merchant authorizes SAL to submit to the processor; missed-deadline consequence stated; reasonable-efforts notice; non-receipt no relief; no outcome guarantee | `src/app/terms/page.tsx` §7 |
| Quick fixes (LOW/MEDIUM) | "standard practice" sentence deleted; "connected payment account" → "the Stripe connected account associated with your business"; win/lost defined as the card-network/issuer decision as reported by Stripe; scope broadened to ANY disputed/reversed payment (not just "clients"); Stripe Connected Account Agreement flow-down sentence (#6); beta waiver = designated beta accounts, ends with ≥30 days' written notice (#8); currency-of-recovery sentence | `src/app/terms/page.tsx` §7 |

**Deliberately NOT done (lawyer's list, per the memo):** governing law/venue
(#3), Bill 96 / French version, abusive-clause restructuring (Quebec C.c.Q.
arts. 1435-1437, #7/#15/#16), termination/refund-policy changes. The /terms
header comment documents this for future sessions.

## Tests added/extended

- `tests/register-tos-acceptance.test.ts` (NEW, 3 cases): registration
  persists `tosAcceptedAt` (real timestamp) + `tosVersion === TOS_VERSION`;
  `agreedToTerms:false` rejected server-side with zero side effects;
  `TOS_VERSION` ISO-shaped and `formatTosVersion` renders timezone-independently
  (string math, no `new Date("YYYY-MM-DD")` — survives `test:tz`).
- `tests/stripe-dispute-webhook.test.ts` (extended, 9 → 11 cases): created →
  founder + OWNER email (reply-to = support inbox, "reply with your evidence",
  "your own Stripe dashboard" honesty); updated → founder only (no owner
  lookup); closed/won → "resolved in your favor" owner copy; closed/lost →
  "Dispute lost" + "comes out of your payouts"; orphan → founder only;
  ALERT_EMAIL unset → owner email still fires; NEW: owner-lookup DB failure is
  caught/logged and the webhook still 200s; NEW: owner without email = logged
  skip.
- `tests/booking-safety-waitlist.test.ts` (extended): public-funnel
  appointment create stamps `policyAcceptedAt` as a real Date.

## Gate results (all green)

| Gate | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS — no warnings or errors |
| `npm test` | PASS — 575/575 (82 files; 569 before this loop, +6 new) |
| `npm run test:tz` | PASS — 575/575 under TZ=UTC AND TZ=America/New_York |
| `npm run check:invariants` | PASS — 16/16 invariants GREEN |
| `npm run check:fake-success` | PASS — 6 advisory notes, all pre-existing, none from this change |
| `node scripts/check-migrations.mjs` | PASS — new migration is ADD COLUMN (nullable, no default, no index): no risky SQL |
| `npm run build` | PASS — compiled, all pages |

## Migration rehearsal (dev schema ONLY)

```text
TEST TARGET: Supabase (sal_agent role) — local migration rehearsal only
DATABASE SCHEMA: dev (isolated; sal_agent has NO production/public access)
LIVE PRODUCTION URL? no
```

- `npx prisma migrate status` → exactly one pending:
  `20260611230000_consent_acceptance`.
- `npx prisma migrate deploy` → "All migrations have been successfully
  applied."
- Post-deploy verification (information_schema DO-block, fails loud):
  `dev.users.tos_accepted_at`, `dev.users.tos_version`,
  `dev.appointments.policy_accepted_at` all present.
- **Rollback rehearsed for real:** `rollback.sql` executed (search_path pinned
  to `dev`) → all 3 columns verified GONE → forward `migration.sql` re-applied
  → all 3 columns verified restored.
- **Idempotency proven:** forward migration run a second time on the
  already-migrated schema — clean no-op (`ADD COLUMN IF NOT EXISTS`).
- Final `npx prisma migrate status` → "Database schema is up to date!"
- Columns are nullable with NO default and NO backfill: NULL = "no recorded
  acceptance" (pre-existing accounts / non-public-funnel bookings). Consent is
  never fabricated.

## What I could NOT verify

- Real owner inbox delivery of the new dispute emails (Resend not exercised in
  tests; sendEmail contract is mocked). Verified instead: recipient resolution
  (Business.owner relation), reply-to convergence with the banner CTA, and the
  never-500 webhook property under lookup failure.
- `SUPPORT_EMAIL` is optional and unset everywhere today — the fallback chain
  lands on `support@meetsal.ai` (the existing sendEmail default reply-to).
  HUMAN_INPUT_NEEDED: confirm that inbox is monitored, or set `SUPPORT_EMAIL`
  in Vercel.
- Quebec enforceability of any of the new clauses — explicitly a lawyer
  question (memo findings 3, 7, 15, 16 + the 8-point lawyer list).

## Founder to-dos (HUMAN_INPUT_NEEDED)

1. **Production migration**: `20260611230000_consent_acceptance` is additive +
   idempotent and rehearsed on `dev`, but per the constitution it does NOT run
   against `public` without your approval — it applies on the next prod deploy
   pipeline that runs `migrate deploy` (or run it manually after approving).
2. **Re-acceptance for existing accounts**: anyone registered BEFORE this
   ships has `tosAcceptedAt = NULL`. Per the memo, have Back Alive sign a
   one-page order form referencing "Terms of Service v. June 11, 2026" before
   June 19 — strongest, cheapest proof for tenant #1.
3. Optionally set **`SUPPORT_EMAIL`** in Vercel (falls back to
   `EMAIL_REPLY_TO`, then `support@meetsal.ai`).
4. The memo's **lawyer list** (governing law, Bill 96, abusive clauses,
   termination/refund) remains open by design.
