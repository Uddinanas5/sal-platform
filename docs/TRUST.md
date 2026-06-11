# SAL Trust Board

**Overall: 🟢 HEALTHY** · generated 2026-06-11 06:01 UTC · run `npm run trust` to refresh.

> How to read this: 🟢 = proven safe by an automatic test. 🔴 = needs attention.
> You do not need to read code — read this board.

## The numbers
- **Tests:** 498/498 passing
- **Business rules proven (invariants):** 13/13 green
- **Possible "fake button" candidates to review:** 6 (a watchlist, not necessarily bugs)
- **Error monitoring (Sentry):** 🟢 wired
- **Abuse protection (rate limiting):** 🟢 wired

## Business rules — each one a promise to your customers
| | Rule | What proves it |
| :--: | --- | --- |
| 🟢 | One salon can't see another's data | 18 test file(s) pass |
| 🟢 | Two clients can't take the same slot | 3 test file(s) pass |
| 🟢 | Prices/tax come from the server, not the browser | 1 test file(s) pass |
| 🟢 | Every sale records staff commission/payroll | 1 test file(s) pass |
| 🟢 | Deleting an appointment never wipes payroll | 1 test file(s) pass |
| 🟢 | A retry can't charge a card twice | 1 test file(s) pass |
| 🟢 | Stripe can replay events without corrupting state | 2 test file(s) pass |
| 🟢 | Unpaid salons are gated correctly (no false lockout) | 1 test file(s) pass |
| 🟢 | Times are right in the salon's timezone | 3 test file(s) pass |
| 🟢 | No session = no data, no writes | 1 test file(s) pass |
| 🟢 | Error reports never leak client data/secrets | 1 test file(s) pass |
| 🟢 | A slow email never breaks a booking/checkout | 1 test file(s) pass |
| 🟢 | Login/booking are rate-limited (abuse protection) | 1 test file(s) pass |

## Sacred zones (a mistake here ends the business — change only with proof)
| | Zone | File |
| :--: | --- | --- |
| 🟢 | Booking/availability engine | `src/lib/availability.ts` |
| 🟢 | Checkout single-writer | `src/lib/checkout/record-checkout.ts` |
| 🟢 | Tenancy primitives | `src/lib/api/ownership.ts` |
| 🟢 | Auth | `src/lib/auth.ts` |
| 🟢 | Stripe webhook | `src/app/api/stripe/webhook/route.ts` |

## What this board does NOT prove (needs a human / real infra)
- Real email deliverability (Resend DNS), real Stripe live charges + disputes, a live 2-tenant browser probe, real production load, and a proven backup-restore. See `docs/PRODUCTION_READINESS.md`.
