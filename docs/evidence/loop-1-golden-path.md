# Evidence — Loop 1: One-Command Golden-Path Smoke (Phase 5C)

**Date:** 2026-06-11
**Branch:** `loop/golden-path` (off `harden/production-readiness`)
**Command:** `npm run test:golden`
**Money-Loop test:** this strengthens EVERY link at once — it is the one command that proves
Book → Show → Pay → Rebook-able (calendar) actually works on real code paths before each launch step.
The number that moves: launch-blocker count (Phase 5C) goes to zero, and any future regression
in booking/checkout/commission is caught in ~40 seconds instead of by a paying customer.

---

## What it is

`scripts/golden-path.mts` — a tsx script that exercises the REAL server-side code, in-process
(no HTTP, no mocks of business logic), against the **dev schema only**:

1. Creates a uniquely-tagged throwaway business + owner (`gp-smoke-<epoch>`), location, 7-day business hours.
2. Creates a service ($45 / 45min) + staff member (40% commission) + staff↔service link + 7-day working hours.
3. **BOOK** — resolves a real slot from the REAL availability engine (`getAvailability`), books it through the
   REAL public-booking action (`createPublicBooking`), then asserts the Appointment row in the DB:
   correct `businessId`, exact `startTime`, the booked service + staff, status `confirmed`, subtotal $45.
4. **SHOW** — persists check-in (status `checked_in` + `checkedInAt`) and asserts it.
   (The dashboard's `updateAppointmentStatus` action requires a NextAuth session, so the script mirrors
   its exact tenant-scoped write; the action itself is covered by the unit suite.)
5. **PAY** — runs a CASH checkout through the REAL single-writer `recordCheckout` wrapped in
   `prisma.$transaction` exactly as the dashboard action / v1 route / MCP tool wrap it, then asserts:
   - Payment row: completed cash payment, amount **$45.00**, tip **$5.00**, tax **$3.99** (flat TAX_RATE,
     independently computed in the script), total **$53.99**, currency USD, correct business/client/appointment.
   - **Commission ledger row exists — the $0-commission regression guard**: gross $45.00, rate 40%,
     amount **$18.00 > 0**, attributed to the performing staff member, status pending.
   - Appointment flipped to `completed` with `completedAt`.
   - Client lifetime totals (1 visit, $45 spent) + loyalty earn ledger (45 pts) reconcile.
   - An open PayrollPeriod was auto-bootstrapped by the first-ever checkout.
6. **CALENDAR** — the REAL `getAppointments` query for the appointment's salon-local day
   (`dayBoundsInZone`, America/New_York) surfaces the appointment with the right client/service/staff/status.
7. **EMAIL (dry-run)** — `RESEND_API_KEY` is force-deleted BEFORE any module loads, so the email layer's
   client is provably `null`; the confirmation-send path is invoked and asserted to skip gracefully
   (`{ success: false, error: "Email service not configured" }`). **Nothing can ever send.**
8. **CLEANUP** — targeted FK-ordered deletes scoped to the throwaway tenant, then an assertion that
   **zero** rows remain (business/users/appointments/payments). The dev schema is left as found.

Also wired:
- `package.json`: `"test:golden": "tsx scripts/golden-path.mts"`.
- `scripts/test-all.mjs`: new opt-in domain — `node scripts/test-all.mjs --with-db` runs GoldenPath as a
  blocking step (off by default so `test:all` stays runnable without a database).
- `.eslintrc.json`: added `"root": true` (project-root config should be root; without it, ESLint run from a
  git worktree nested under the repo walks up, loads the parent config too, and fails with a
  duplicate-`@next/next`-plugin conflict).

## Database safety (hard rules honored)

Before doing anything the script prints and enforces:

```
TEST TARGET: local golden-path smoke
DATABASE SCHEMA: dev
LIVE PRODUCTION URL? no
```

Hard-exits (exit 1, before any app module/Prisma connection) when:
- `DATABASE_URL` is missing, or its `schema=` param is missing (would default to `public`),
- schema is anything other than `dev` / `agents`,
- schema is `public`, or `VERCEL_ENV`/`NODE_ENV` is `production`.

Negative paths proven (captured run):

```
DATABASE SCHEMA: public
LIVE PRODUCTION URL? YES — ABORTING
❌ REFUSING TO RUN: DATABASE_URL / environment looks like PRODUCTION (schema=public).
exit (schema=public): 1
---
DATABASE SCHEMA: (none — defaults to public)
❌ REFUSING TO RUN: DATABASE_URL schema is "(none — defaults to public)" — only dev or agents are allowed.
exit (no schema): 1
```

## Captured run (dev schema, 2026-06-11)

```
TEST TARGET: local golden-path smoke
DATABASE SCHEMA: dev
LIVE PRODUCTION URL? no
RESEND_API_KEY not set — emails will not be sent

RUN TAG: gp-smoke-1781219027503
────────────────────────────────────────────────────────────

▶ 1. Business + owner (throwaway tenant)…
✅ 1. Business + owner (throwaway tenant) (5269ms) — business 0b8cd42a-c366-4d30-ad2c-95a842941067 (slug gp-smoke-1781219027503) + owner + location + 7d business hours

▶ 2. Service + staff + working hours…
✅ 2. Service + staff + working hours (3640ms) — service "Golden Cut" ($45/45min) + staff @ 40% commission + 7d schedule

▶ 3. BOOK — real public-booking action…
Email skipped (Resend not configured): Booking Confirmed - Golden Cut
createPublicBooking error: Error: Invariant: static generation store missing in revalidatePath /calendar
✅ 3. BOOK — real public-booking action (8971ms) — booked SAL-20EC3CF6D544DD82 @ 2026-06-13T13:00:00.000Z (status confirmed, subtotal $45)

▶ 4. SHOW — check-in persisted…
✅ 4. SHOW — check-in persisted (566ms) — client checked in at 2026-06-11T23:04:05.385Z

▶ 5. PAY — cash checkout via single-writer…
✅ 5. PAY — cash checkout via single-writer (9419ms) — payment PAY-20260611-B11226F1: $53.99 cash (tax $3.99, tip $5) → commission $18 @ 40% ledgered

▶ 6. Calendar query surfaces the appointment…
✅ 6. Calendar query surfaces the appointment (2862ms) — calendar query for 2026-06-13 returns the appointment (status completed)

▶ 7. Confirmation email path (dry-run)…
Email skipped (Resend not configured): Golden-path smoke — confirmation dry run
✅ 7. Confirmation email path (dry-run) (1ms) — confirmation email path attempted; skipped gracefully (Resend not configured — nothing sent)

▶ 8. CLEANUP — delete throwaway tenant…
✅ 8. CLEANUP — delete throwaway tenant (7249ms) — all throwaway data for gp-smoke-1781219027503 deleted; dev schema left as found

────────────────── Golden-path summary ──────────────────
✅ 1. Business + owner (throwaway tenant)         5269ms
✅ 2. Service + staff + working hours             3640ms
✅ 3. BOOK — real public-booking action           8971ms
✅ 4. SHOW — check-in persisted                    566ms
✅ 5. PAY — cash checkout via single-writer       9419ms
✅ 6. Calendar query surfaces the appointment     2862ms
✅ 7. Confirmation email path (dry-run)              1ms
✅ 8. CLEANUP — delete throwaway tenant           7249ms
─────────────────────────────────────────────────────────

✅ GOLDEN PATH PROVEN — Book → Show → Pay → Ledger → Calendar all real, on the dev schema.
```

Post-run leftover sweep (independent query): `leftover gp-smoke businesses: 0 | leftover gp-smoke users: 0`.

## Full proof-command results

| Check | Result |
| --- | --- |
| `npm run typecheck` | ✅ clean |
| `npm run lint` | ✅ clean (after `root: true` fix) |
| `npm test` | ✅ 538/538 across 78 files |
| `npm run test:tz` | ✅ 538/538 under UTC AND America/New_York |
| `npm run check:invariants` | ✅ 15/15 GREEN |
| `npm run check:fake-success` | ✅ pass (pre-existing advisory note in onboarding/client.tsx, untouched by this change) |
| `npm run test:golden` | ✅ 8/8 steps, exit 0 |
| Guard negative paths | ✅ exit 1 on `schema=public` and on missing schema |

## Findings (the loop working as intended)

1. **No money-loop bugs found on this run.** Booking, checkout totals ($45 + $3.99 tax + $5 tip = $53.99),
   commission ($18.00 @ 40% — non-zero), loyalty (45 pts), payroll-period bootstrap, and the calendar query
   all behaved exactly as specified. The June 9–10 ultra-review fixes on this branch lineage appear to hold
   for the cash golden path.
2. **Known quirk (pre-existing, documented, not papered over):** out of a Next request context,
   `createPublicBooking`'s post-commit `revalidatePath()` throws and the action's catch-all converts an
   ALREADY-COMMITTED booking into a generic `{ success: false }` return. In production (inside a request)
   this does not happen. The same masking is documented in `scripts/soak-test.mts`. The harness therefore
   treats the DB as the source of truth (asserting the Appointment row), and the captured stack trace above
   is expected output, not a failure. A possible future improvement to the action: run `revalidatePath` in
   its own try/catch so an infrastructure throw after commit can never mask a successful booking.
3. **Worktree lint conflict (fixed here):** the repo `.eslintrc.json` lacked `root: true`, so ESLint run from
   a nested checkout (e.g. agent git worktrees under `.claude/worktrees/`) double-loaded the Next plugin and
   failed. One-line additive fix; lint output is unchanged for normal checkouts.

## What I could NOT verify

- **Step 4 uses the real write, not the real action:** `updateAppointmentStatus` (check-in) requires a NextAuth
  session and cannot be invoked in-process without one; the script mirrors its exact tenant-scoped write.
  The action's own logic is covered by the existing unit suite, not by this harness.
- **Real email delivery:** the email step proves the send path is reached and degrades gracefully with no
  provider; it deliberately cannot prove Resend delivery (that requires the real key and a real send — the
  launch checklist's manual smoke covers that).
- **Card/Stripe checkout:** the golden path is CASH (beta policy). Stripe flows are covered by the webhook /
  payment-intent unit tests and the Stripe runbook, not this script.
- **Production schema behavior:** by design — the script refuses to run there. The `agents` schema is allowed
  by the guard but this run only exercised `dev`.
- **Concurrency:** single happy-path client only; contention/oversell remains `scripts/soak-test.mts` territory.
- **`revalidatePath` cache effects:** cannot be observed outside a running Next server.
