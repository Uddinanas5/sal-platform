# SAL Test Backlog

Queue of regression tests to write. Tester owns this file (append-only, like
bug-log.md). Coder picks items up and writes the test, then marks `[DONE in <commit>]`.

**The rule going forward:** every bug fix and every feature PR ships with a test
that would FAIL on the old code and PASS on the new. No test, no merge-ready.

Run the suite with `pnpm test`. Tests live in `tests/`, named `*.test.ts`.

Format per entry:
```
## <area> — <what to cover>
- **Why**: <the bug/regression this guards against>
- **Target**: <file/function under test>
- **Cases**: <the specific inputs/states to assert>
- **DB needed**: yes (needs Prisma mock/fixture) | no (pure logic)
- **Status**: open | [DONE in <commit>]
```

---

## date overflow guard — parseYmd
- **Why**: `new Date('2026-06-31')` silently rolled to Jul 1, shifting booking query windows.
- **Target**: src/lib/date-utils.ts `parseYmd`
- **Cases**: valid date, Feb 30 / Apr 31 / Sep 31 reject, month 13/00 reject, slashes/unpadded reject, leap-year 2028-02-29 vs 2027-02-29.
- **DB needed**: no
- **Status**: [DONE in <first test commit>]

## checkout error contract — CHECKOUT_ERROR_CODES + error classes
- **Why**: dashboard action, v1 route, and MCP tool all branch on these code strings; drift breaks all three silently.
- **Target**: src/lib/checkout/resolve-payroll-period.ts
- **Cases**: code string values stable; each error class carries matching `.code` and payload.
- **DB needed**: no
- **Status**: [DONE in <first test commit>]

---
## OPEN — high priority (the P0 security fixes — these are the ones that matter most)

## cross-tenant write guard — services POST
- **Why**: P1 — businessId was taken from request body, letting a user create services under another tenant. Fixed to source from session/ctx.
- **Target**: src/app/api/services/route.ts (POST), src/lib/actions/services.ts
- **Cases**: body businessId is IGNORED; service is created under ctx.businessId only; cross-tenant categoryId/serviceIds rejected as 400.
- **DB needed**: yes — mock Prisma (`vi.mock`) and getBusinessContext; assert the `create` call's data.businessId equals the session business, not the body.
- **Status**: open

## cross-tenant write guard — staff serviceIds
- **Why**: P1 — admin could link their staff to another tenant's service via FK passthrough.
- **Target**: src/app/api/v1/staff/route.ts (POST)
- **Cases**: serviceIds from another business rejected (INVALID_SERVICE_IDS); user→staff→staffService wrapped in a tx (mid-loop failure orphans nothing).
- **DB needed**: yes — mock Prisma; assert the tenant `count` guard runs before createMany and that a failure rolls back the user row.
- **Status**: open

## checkout price tampering — processPayment
- **Why**: P0 — handler trusted wire prices/totals; user could mint a payment at attacker-chosen amount and inflate loyalty tier.
- **Target**: src/lib/actions/checkout.ts processPayment / record-checkout.ts
- **Cases**: client-sent price/subtotal/total are ignored; amount recomputed from server-side product.retailPrice scoped by businessId+deletedAt; empty cart (items < 1) rejected; discount > subtotal rejected; loyalty increment uses server amount.
- **DB needed**: yes — mock Prisma product/service lookups; feed a payload with inflated prices and assert the persisted amount equals the server recomputation.
- **Status**: open

## working-hours + time-off guard — reschedule/resize
- **Why**: GAP-001 — a drag could save an appointment outside staff working hours or during approved PTO.
- **Target**: src/lib/actions/appointments.ts `assertSlotAllowed`
- **Cases**: start/end inside the StaffSchedule window passes; ending exactly at close passes (inclusive boundary); start before open / end after close rejects (OUTSIDE_WORKING_HOURS); overlap with approved StaffTimeOff (full-day and partial) rejects.
- **DB needed**: yes — mock the schedule + time-off rows; OR refactor assertSlotAllowed to take plain data so it can be unit-tested without a DB (preferred — note this in the PR).
- **Status**: open

## public error contract — no Prisma leak to anonymous callers
- **Why**: P2 — public API routes leaked raw Prisma/TLS error strings on 500.
- **Target**: src/lib/api/public-error (withSafeErrors wrapper)
- **Cases**: a thrown Prisma error surfaces as a generic `{ error: "Internal server error" }` with no ORM/driver text; real cause is logged, not returned.
- **DB needed**: no — pass a throwing handler into withSafeErrors and assert the sanitized response shape.
- **Status**: open
