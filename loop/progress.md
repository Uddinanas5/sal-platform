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

## Heartbeat iteration 10 (Jul 8) — recurring bookings are now all-or-nothing
- Fixed `L-024`: creating a **repeating appointment** (e.g. a standing weekly cut)
  via the AI tool used to book each week separately — so if week 4 hit a conflict,
  weeks 1–3 were already on the calendar while the caller was told "nothing was
  booked." Now the whole series books in one shot: if any week can't be booked,
  none are (matching how the dashboard already works). Proven with 2 tests.
- **Flagged `L-028` for you (didn't guess):** the code contradicts itself on whether
  "un-cancelling" an appointment is allowed — the dashboard route forbids it, the
  server/API/AI paths allow it. Deciding which is correct is a product call, so I
  left it for you rather than pick a side.

## Heartbeat iteration 11 (Jul 8) — standing appointments survive daylight-saving
- Fixed `L-025`: a **standing weekly appointment** (say a 9 AM Monday cut) used to
  quietly shift to 10 AM after the clocks change, because the repeat math ran on the
  server's clock, not the shop's. Now it advances in the **shop's timezone**, so 9 AM
  stays 9 AM across daylight-saving — and "monthly" now means the same day next month,
  not a flat 30 days. Extracted a small tested helper and proved it against the real
  spring-forward date. (`L-026` is the same helper wired into the AI tool — a quick
  follow-up.)

## Heartbeat iteration 12 (Jul 8) — the AI recurring tool is now consistent too
- Finished `L-026`: the AI/MCP "book a repeating appointment" tool now uses the same
  DST-safe helper as the dashboard, so it no longer drifts across daylight-saving and
  its "monthly" is a real calendar month (it used to be a flat 30 days). Both
  recurring paths are now atomic *and* timezone-correct, proven end-to-end.

## Heartbeat iteration 13 (Jul 8) — a removed service can no longer be booked
- Fixed `L-031`: two API booking routes (group + recurring) looked up the service
  without excluding **soft-deleted** ones, so an API caller could still book a
  service you'd removed. Now both scope it out (matching every other path). Proven
  with a test on both routes.
- **Deferred `L-027` to you (turnover buffers):** the fix touches the safety-critical
  double-booking engine AND involves a real product call — how two back-to-back
  appointments' buffers should combine (add them, or take the larger?). Not
  something to change on an unattended tick; flagged for a supervised pass.
- **Spotted a 3rd copy of the daylight-saving bug** while in there (the API recurring
  *route*, on top of the two already fixed) — filed as `L-033`, same one-line-ish
  fix using the helper.

## Heartbeat iteration 18 (Jul 9) — auth audit + fixed a cross-tenant privilege escalation
- Ran a deep security audit of **login / sessions / permissions / onboarding** — 11
  findings, all 11 held up under adversarial review (the highest hit-rate of the
  three audits). Fixed the worst one on the spot:
- **The big one (P1):** the API route that changes a team member's role rewrote a
  *global* role field with no cross-shop check — so **one shop's owner could
  silently make a shared staff member an admin at another shop.** The dashboard
  already guarded this; the API and AI-tool paths didn't. Now all three share one
  guard (so it can't drift apart again), proven with tests.
- **7 more real findings queued (`L-034`–`L-040`):** a password reset doesn't kick
  out a stolen session; an attacker can lock an owner out of their account
  repeatedly; a just-demoted admin keeps admin visibility for a while; a couple of
  ways to probe which emails have accounts; and account deletion doesn't fully
  revoke access. None are shop-ending, but all are real — good fuel for coming ticks.

## ⚠️ Caught a second gate blind spot (and closed it)
This heartbeat opened with the health check RED — a *type* error in last run's test
had slipped through, because the scoreboard's main check runs the tests (which don't
type-check) but not the type-checker itself; only the quick "smoke" check did. Fixed
the test **and** made the scoreboard type-check first, so a broken build can't show
green anymore. (That's now two self-caught blind spots — the loop is genuinely
policing itself.) The planned login-system audit moves to the next tick.

## Heartbeat iteration 17 (Jul 9) — booking list shows the right day; booking backlog CLOSED
- Fixed `L-030`: the appointments-list API filtered by the *server's* calendar day,
  not the shop's, so near midnight a non-UTC shop could see the wrong day's list.
  Now it uses the shop's timezone (proven with a test). Last fixable booking bug.
- **The loop has now closed both deep audits (payments + booking) — 21 verified
  findings fixed this session.** Everything left in the queue needs *you* (merge, the
  Next.js/CVE call, product decisions) or *infrastructure/dependencies* the loop
  can't self-serve. So the next heartbeat will either run a **fresh audit of the
  auth/login/onboarding area** (the obvious not-yet-reviewed part) to generate new
  fuel, or simply report that it's waiting on you.

## Heartbeat iteration 16 (Jul 9) — un-cancelling now clears the "no-show" mark
- Fixed `L-032`: when you restore a cancelled/no-show appointment, it used to keep
  its old "no-show" / "cancelled" stamps, so it still looked like a no-show to any
  report or fee later keyed on that. Now restoring properly clears those stamps —
  in all three places it can happen (dashboard, API, and the AI tool). Proven with a
  test. (These three copies of the same logic are now begging to be merged into one
  shared helper — noted for a cleanup pass.)

## Heartbeat iteration 17 (Jul 9) — closed a "charge the client twice" gap before it can bite
- Fixed `L-017`: the **online card-payment** path (the one that runs when you turn on
  SAL Payments and take a card online) didn't check whether the appointment had
  **already been paid**. It had a safety net that only covered repeat clicks within
  the *same hour* — so an hour later, the same appointment could be sent to the card
  a **second time**. The three in-person checkout paths already had this check; the
  online one was the odd one out. Now it does the same check first: if the
  appointment is already paid, it refuses and charges nothing.
- **Timing matters:** this path is switched *off* in the beta (online payments aren't
  live yet), so no client was ever affected — but it's exactly the kind of thing you
  fix *before* flipping the switch, not after. I also double-checked there's no other
  online-charge path hiding elsewhere (there isn't — one entry point, now guarded).
- **Honest footnote:** I logged one narrower leftover (`L-041`, low priority): the
  new check catches an *already-completed* payment, but not two half-finished ones
  started in different hours. The clean fix for that belongs with the go-live payment
  work, and I noted exactly why rather than bolting on something that could lock a
  real client out of paying. Scoreboard green: 626 tests, 15/15 rules, types clean.

## Heartbeat iteration 16 (Jul 9) — "delete my account" now actually cuts off access
- Fixed `L-040`: when an owner requested account deletion, the app cancelled their
  subscription and logged the request — but any **API key or app-connection token
  they'd handed out kept working**, so a leaked key could still read the shop's data
  after they asked to be deleted. Now, in the **same all-or-nothing step** as the
  cancellation, every API key and connected-app token for that shop is switched off
  immediately.
- Kept it **surgical and safe**: it only touches *that shop's* keys — a person who
  also works at another salon isn't logged out everywhere (the same cross-tenant
  trap we closed for role changes). Proven by two new tests (revokes both on
  deletion; revokes nothing if the caller wasn't allowed to delete).
- **Why this one now:** it's a self-contained server action, so it's cleanly
  testable and low-risk. The three bigger auth items left (a stolen login surviving
  a password reset, a login-lockout abuse angle, and a demoted admin keeping their
  old view for a few days) each need a more careful dedicated pass — not an
  unattended tick. Full scoreboard green: 623 tests, 15/15 rules, types clean.

## Heartbeat iteration 15 (Jul 9) — far-future booking limit fixed for Dubai-style shops
- Fixed `L-029`: the "you can book up to N days ahead" limit was measured on the
  server's clock, not the shop's — so for a shop **ahead of UTC (like Dubai)**, a
  valid slot the booking page had just offered on the last allowed day could be
  rejected. Now it uses the shop's local calendar day (matching the page), with a
  test for the exact Dubai boundary case. Directly relevant to your Dubai shop.

## ⚠️ Important: caught a false "green" (and fixed the gate that allowed it)
While pulling numbers for a review, I ran the FULL test suite directly and found
**12 tests were actually failing** — even though the loop's scoreboard had been
showing green. Cause: an earlier fix (L-015, "charge the booked price") added a new
database call that three older test files didn't account for. The scoreboard missed
it because it only failed on 15 specific "business rule" tests, not on every test.
**Fixed both:** the 3 tests now pass (609/609 green), and I tightened the scoreboard
so it now fails on ANY failing test. Honest lesson — this is exactly the "looks green
but isn't" trap the loop is designed to avoid; now it actually catches it.

## Heartbeat iteration 14 (Jul 8) — daylight-saving bug now fully closed
- Fixed `L-033`, the last of three copies of the recurring daylight-saving bug (the
  API route). All three ways of creating a repeating appointment — dashboard, API,
  and AI tool — now share **one tested helper**, so a standing appointment holds its
  time across the clock change everywhere. Proven end-to-end on the real API handler.

## Next
- Booking fuel remaining: `L-029`/`L-030` (a couple of timezone day-boundary
  off-by-ones on the far-future booking limit and a list filter), `L-032` (stale
  no-show flags after un-cancelling). `L-027` (buffers) and `L-028` (un-cancel
  policy) await your product calls.
- Highest leverage still yours: merge PR #45, the Next.js/CVE call, and the infra
  gates (staging/restore/observability/live-Stripe).
