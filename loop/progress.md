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

## Next
- Work `L-002` (interleaved-concurrency booking oracle), then `L-003`/`L-004`
  (tenant guards), then the L-016 checkout-idempotency epic.
