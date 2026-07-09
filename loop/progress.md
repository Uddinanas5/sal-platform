# Loop Progress — human-readable narrative

> This is written **for the founder**, not for the loop. It's the plain-English
> story of what the loop has done. The loop's ground truth is `state.json` +
> `feature_board.json` + git — not this file.

## Where we are
- **Bootstrap.** The loop engine is stood up: a charter (`LOOP.md`), a launch-readiness
  gate battery (`feature_board.json`, gates A–J), a priority backlog
  (`backlog.json`), and a runnable gate (`gate.mjs`). It wires into the platform's
  existing verification spine (`test:all`, `trust`, `check:*`, `test:golden`,
  `soak-test`) rather than reinventing it.
- **Verdict:** PENDING — the battery has not yet run against a database. Run
  `node loop/gate.mjs` (add `--with-db` once a `dev`/`agents` DB is reachable).

## Payments gate — UNBLOCKED (Jul 8)
- The **Stripe TEST keys were already in the local `.env`** all along (`sk_test_`
  secret + `whsec_` webhook + `pk_test_` publishable). `.env` is gitignored and not
  committed; the DB is on the `dev` schema. So the payments gate was never truly
  blocked.
- **Money path PROVEN** on the dev schema: golden-path book → check-in → pay →
  ledger → calendar all real, commission **$18 @ 40%** (non-zero, correctly
  ledgered). Gate `J.1` and `B.1` are now green from observed evidence.
- ⚠️ One caveat: `STRIPE_WEBHOOK_SECRET` is unusually long (len 70) — re-verify it
  matches the actual delivering endpoint when running the live test-mode webhook
  E2E (`npm run stripe:listen` prints the session signing secret).

## Where we are now
- **14 of 33 checks green; verdict PENDING** (correctly — not launch-ready yet).
- Remaining P0 work: A.4/A.5 (tenant-override + raw-SQL guards), B.5 (live
  test-mode webhook E2E), C.2/C.3 (structured logs + alerts), E.1/E.3 (CI gate +
  rollback drill), G.* (authz/auth/secrets/headers), H.1/H.2 (backups + restore),
  J.4/J.5 (browser E2E).

## Payments hardening — first real loop output (Jul 8)
A 20-agent adversarial audit swept the money subsystem: **15 findings raised, 11
confirmed** (4 rejected by the verifiers as not-real / unreachable — the anti-false-
positive discipline working). **6 fixed, full suite green (568/568):**
- 🟢 **P1** — a commission rounding check was tripping on legitimate half-cent
  commissions (e.g. a $45.30 cut at 25%) and **rolling back the whole sale** — the
  cashier literally couldn't ring it up. Fixed + regression test.
- 🟢 **P1** — a retried/out-of-order Stripe "succeeded" webhook could flip a
  **refunded** charge back to "completed" (counting a refund as revenue). Fixed +
  test.
- 🟢 **P2** — a stale "failed" webhook could clobber an already-completed payment.
  Fixed + test.
- 🟢 **P2×3** (fix shipped, tests queued as L-018) — public-booking stored tax
  inside the price (commission paid on tax); Quick-Sale lines ignored the shop's
  tax-off toggles; refunds didn't reverse the connected-account transfer.

**Queued (need a schema migration or are latent until payments go live):** L-015
(charge the booked price, not the later catalog price), L-016 (idempotency keys so a
retried walk-in/gift-card sale can't double-charge), L-017 (already-paid guard on the
online Connect charge).

## Heartbeat iteration (Jul 8) — Gate A.5 raw-SQL tenant guard
- Skipped `L-001` (the live Stripe test-mode E2E) — it needs a running dev server
  plus `stripe listen`, which a headless heartbeat can't stand up. It stays the top
  P0 for a hands-on session.
- Shipped `L-004`: a guard (`npm run check:rawsql`) that scans every hand-written
  SQL escape hatch and **fails the build unless it's provably tenant-safe** — the
  main way multi-tenant apps leak across shops. Today's codebase is clean (6 sites:
  the advisory locks are keyed by shop id, the health check reads no data). Its real
  job is to catch the *next* unsafe query before it ships. + a 7-test suite; full
  suite green **575/575**.
- The board still reads **PENDING**. A.5's board checkbox is left for you to flip
  (`L-019`) because it means editing the owner-protected gate file — the loop won't
  edit its own grader.

## Heartbeat iteration 2 (Jul 8) — Gate A.4 tenant-override
- Shipped `L-003`: a test proving a caller can't **impersonate another shop** by
  smuggling a `businessId` into the request body, the query string, or an
  `X-Tenant-ID` header — the route ignores all of it and stays scoped to the
  logged-in shop. (3 tests; full suite **578/578**.)
- Deferred `L-002` (the fuzzed-concurrency booking oracle): it needs a new library
  (`fast-check`) and the loop won't add dependencies on its own; the existing
  one-winner concurrency test already covers the core case.
- A.4's board checkbox joins A.5 in `L-019` for your review (both mean editing the
  owner-protected gate file).

## Heartbeat iteration 3 (Jul 8) — checkout idempotency (the double-charge fix)
- Shipped `L-016`, the biggest of the payment-audit findings: a retried or
  double-submitted **walk-in / gift-card** sale could previously charge twice or
  drain a gift card twice. Now every checkout can carry an **idempotency key** — a
  repeat with the same key returns the *original* sale instead of recording a new
  one, and a database uniqueness rule blocks a true simultaneous duplicate.
- This needed a **database migration** (a new column + uniqueness rule), which I
  applied to the safe **dev** database and then re-proved the whole money path
  end-to-end against it. The key is accepted on all three checkout paths (the
  dashboard, the public API — including the standard `Idempotency-Key` header — and
  the AI/MCP tool). 4 new tests; full suite **582**.
- One small follow-up (`L-020`): wire the dashboard's pay dialog to actually send a
  key, so the primary UI benefits too (the server side is ready; API/MCP clients
  already send their own).

## Heartbeat iteration 4 (Jul 8) — security headers locked (Gate G.4)
- The app's security headers (HSTS, a strict content-security-policy, clickjacking
  protection) were already set up well — but nothing *guarded* them, so a future
  edit could quietly drop protection. I moved the policy into a small tested module
  and added a test that **fails if HSTS, clickjacking protection, or the CSP are
  weakened** (e.g. someone allowing `eval` in production). Verified with a full
  production build. 5 new tests.
- Skipped `L-005` (per-shop logging): doing it right needs request-scoped context
  plumbing — more than one clean iteration; deferred.

## Heartbeat iteration 5 (Jul 8) — dependency-vulnerability gate (Gate G.3)
- Added a **dependency security gate** (`npm run check:audit`): it fails the build
  if any production dependency has a high/critical vulnerability that hasn't been
  triaged, and prints all of them transparently. 5 tests lock the logic.
- ⚠️ **It surfaced 4 real HIGH-severity CVEs today** (0 critical) — all
  denial-of-service / ReDoS / path-traversal class, not remote-code-execution or
  data-leak. They're documented + accepted-for-now in `audit-allowlist.json` so the
  gate is green, but the **real fix needs your decision** (see below) — tracked as
  `L-022`.
- **NEEDS YOU (`L-022`):** three are transitive and fixable via package overrides
  (a lockfile sync); the fourth is **Next.js itself**, whose only fix is a **major
  upgrade (14 → 16)** — a breaking change I won't do autonomously. This is the one
  thing this iteration is escalating.

## Heartbeat iteration 6 (Jul 8) — charge the booked price (payments #4)
- Fixed a real overcharge: if a shop **raised a service's price after a client
  booked**, checkout (via the API/AI path) was charging the *new, higher* price
  instead of the price the client actually booked — and the books didn't reconcile
  (revenue vs. commission were computed off different prices). Now checkout charges
  the **booked price snapshot**, matching what the client agreed to and what
  commission is paid on. Walk-in sales and products are unaffected.
- Verified end-to-end: the new database lookup is tenant-scoped, the money proof
  (golden path) passes on the real dev database, and a new test proves a $50 catalog
  price still charges the booked $40.

## Heartbeat iteration 7 (Jul 8) — paid down owed test debt
- Two earlier one-line payment fixes had shipped WITHOUT their own tests (I'd
  logged that debt honestly). Now they're locked with regression tests: refunds on
  Connect charges must claw back the salon's transfer (#11), and a "no sales tax"
  shop must not tax a Quick Sale line (#7). Both tests are written so that undoing
  the fix flips the result — real guards, not rubber stamps.
- The third (`/api/bookings` tax-exclusive price, #3) needs heavy route mocking for
  a one-liner already aligned to every other path — split to `L-023` (low priority).

## Heartbeat iteration 8 (Jul 8) — dashboard checkout is now retry-safe
- Completed the checkout double-charge protection end-to-end: the dashboard pay
  dialog now carries a per-sale key so a double-click or a network hiccup that
  retries can't charge twice — the server recognizes the repeat and returns the
  original sale. (The no-double-charge rule itself is already covered by tests;
  this connects the dashboard to it.)

## Convergence: the loop has done the code-only hardening it can
Eight iterations in, the backlog items that remain all need **something the loop
can't self-serve**:
- **You:** merge PR #45; the CVE remediation (`L-022`, incl. the Next.js 16 upgrade
  call).
- **Infrastructure:** a staging env (rollback drill), a real backup-restore, and a
  live Stripe `stripe listen` session (payments E2E).
- **A dependency approval:** `fast-check` for the fuzz-concurrency oracle.
- Or the loop **generates new findings** — a fresh adversarial audit of a subsystem
  not yet deeply reviewed (booking/availability, auth) — which is the natural next
  move when the curated backlog thins (LOOP.md §5).

## Heartbeat iteration 9 (Jul 8) — booking-engine audit refilled the backlog + fixed a double-booking
- The backlog was dry, so the loop ran a **deep audit of the booking engine** — the
  same find-then-adversarially-verify approach that caught 11 payment bugs. It found
  **10 real, verified booking bugs.**
- **Fixed the worst one immediately:** the AI-agent tool for changing an
  appointment's status could **un-cancel an appointment onto a slot someone else had
  already taken — a silent double-booking.** The dashboard and public API already
  block this; the AI/MCP path didn't. Now it re-checks and refuses, with a test that
  proves it. (This matters directly for your "connect your AI agent" feature.)
- **9 more filed as fresh work (`L-024`–`L-032`):** recurring bookings that aren't
  all-or-nothing, standing appointments drifting an hour across daylight-saving,
  turnover buffers not being reserved, a few timezone-boundary off-by-one-day
  issues, and a soft-deleted service still being bookable via the API. None are
  emergencies (mostly P2/P3), but they're real and now queued.

## Next
- The loop has fuel again (`L-024`–`L-032`) — future heartbeats can work these.
- Still the highest leverage, in your court: merge PR #45, the CVE/Next.js call,
  and the infra gates (staging/restore/observability/live-Stripe).
