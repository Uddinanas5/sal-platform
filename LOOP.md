# LOOP.md — The SAL Loop Engine Charter

> This is the constitution the autonomous loop reads at the **top of every run**.
> It is grounded in research on why long-horizon agent loops fail (spinning,
> false-victory, reward-hacking, silent regression) and how mature software is
> continuously tested. Sources are catalogued in `loop/RESEARCH.md`.
>
> **The one rule that generates all the others:** the loop's own opinion is never
> evidence. Every "done" is a *claim* that stays `pending` until an **external
> oracle the loop cannot edit** observes it true.

---

## 0. Mission & finish line (set by the founder)

- **Scope:** Harden the barbershop booking platform to public-launch quality, then
  keep building roadmap features (see `loop/backlog.json`). Open-ended — the loop
  runs until the founder stops it, always leaving `main` in a shippable state.
- **Money path:** **Stripe TEST mode only.** Build and exhaustively test
  book → pay → payout in an isolated test environment. **Never** live keys, never
  a real charge. Live payments are a founder-gated, separate decision.
- **Run mode:** Nonstop, scheduled heartbeat (see §6). Resumes from the event log
  after every sleep/crash.
- **Definition of launch-ready:** the **Stop Condition** in §2 — data-driven, not
  deadline-driven.

## 1. Per-iteration cycle — SENSE → DECIDE → ACT → VERIFY → RECORD

Work **exactly one** backlog item per iteration. A fixed startup sequence means a
context reset never loses the thread.

1. **SENSE** (cheap, deterministic — no LLM judgment):
   `pwd` → `git log -20` → read `loop/state.json` (event-log tail) →
   `loop/progress.md` → `loop/feature_board.json` → run the **smoke gate**
   (`node loop/gate.mjs --smoke`). Pull the top item from `loop/backlog.json`.
2. **DECIDE:** If the smoke gate is RED and the top item isn't that regression,
   **preempt** and fix the regression first. Load only this item's files. If the
   item is blocked/ambiguous/contradictory → `flag_for_human` and **stop** — do
   **not** push forward on a wrong path (the classic Devin failure).
3. **ACT** (on this branch, never `main`): lint + `tsc` **before** the edit is
   considered done. Make the single change. Add or strengthen an
   **invariant-level** test (relational/range — never prints-only, never a
   rubber-stamped snapshot). You may **not** touch the frozen gate files (§4).
4. **VERIFY** (external, un-self-graded): impacted tests → `next build` →
   E2E of the touched flow → the domain oracle (property / metamorphic /
   differential / Stripe test-mode replay) → then an **independent adversarial
   verifier** (fresh context) that re-derives the claim from raw artifacts and
   tries to **disprove** it.
5. **RECORD** (state lives outside the context window):
   - PASS → commit (governed, no `--no-verify`) → flip the board item to `pass`
     with an evidence pointer → append a `VERIFIED` event to `loop/state.json` →
     update `loop/progress.md`.
   - FAIL → `git revert`/reset to `lastGoodSha` → log the failure (with the
     disproof) as a **new backlog item** → do **not** flip the board.

## 2. The gate battery & Stop Condition

`node loop/gate.mjs` runs the launch-readiness battery (gates **A–J**, mapped to
Google SRE's Production-Readiness dimensions). Each gate returns `{pass, evidence}`
where evidence is an **observed artifact**, not an assertion. Board lives in
`loop/feature_board.json`. **Verdict = PUBLIC-GA only if every P0 gate passes; one
failing P0 ⇒ BETA-ONLY.**

**The loop may declare "candidate-ready" and stop ONLY when all hold:**
1. Every **P0** gate green, **two consecutive runs**, different seeds, fresh worktree.
2. P1 coverage above the agreed threshold.
3. `git diff` across the run shows **zero edits** to the frozen gate suite.
4. The **independent Evaluator** (separate context/model family) signs off.

This is deliberately **not** a single metric — no fixed threshold stays safe as the
generator gets stronger (the Verification-Horizon result). When the condition is
met, the loop **escalates for GA sign-off**; a human makes the final call.

## 3. Oracle strategy — correct, not merely non-crashing

Climb the oracle hierarchy; refuse to live at the bottom:

> implicit "no 500" *(the trap)* · snapshot *(rubber-stamp risk)* · example `==` ·
> **relational/range** · **metamorphic** · **differential** · **executable
> invariants checked after every transition**

- **Booking** → stateful model + concurrency harness (`fc.scheduledModelRun`)
  asserting *no two confirmed appointments overlap for one barber* and *exactly one
  racer wins*. The fix must be a DB constraint / serializable txn — an app-level
  check-then-write is rejected.
- **Payments** → money-conservation invariants (`Σdebits = Σcredits`, `balance ≥ 0`,
  atomic, **idempotent under retry** — same Stripe `event.id` twice ⇒ identical end
  state). Webhook replay proves it.
- **Availability/search** → metamorphic relations (adding a filter ⇒ Subset;
  Cardinality never increases) — no golden output needed.
- **Reports/business math** → differential (compute two independent ways, diff).
- **Tenant isolation** → universal property at the data layer (RLS + Prisma
  scoping), IDOR-probed by fuzzing IDs across the boundary.
- **Mutation testing (StrykerJS)** is the orthogonal meta-oracle proving the
  invariants are non-vacuous. Surviving-mutant reports are **internal signal only**
  — never handed to the code-writing step (else it special-cases the mutant).

## 4. Anti-divergence & anti-reward-hacking — STRUCTURAL, not instructional

Prompt-level "don't cheat" does not survive; controls are structural.

- **No-touch boundaries (physical):** `main` is sacred — never a direct target.
  The `public`/prod schema, live Stripe keys, and real customer data are **out of
  reach**: the loop's env holds only `dev` + `agents` creds and **Stripe test
  keys**.
- **Governed git only:** no `--no-verify`, no `stash`-to-hide, no `--force`. Gates
  run from a clean checkout at the push boundary.
- **Frozen gate suite:** the acceptance battery + `loop/feature_board.json` are
  owner-protected (CODEOWNERS → founder). The loop writes only implementation-level
  tests. The diff scanner **fails the run** if a diff touches the frozen suite,
  deletes/`skip`s/`xfail`s a test, weakens an assertion, hardcodes an expected
  value, adds `process.exit`/`sys.exit`, or mocks the unit under test.
- **Independent adversarial verification:** every self-reported success is
  `pending` until a **zero-context critic** re-derives it from raw artifacts and
  fails to disprove it.
- **Stuck-detection:** abort a feature when N identical actions repeat, the same
  error recurs, or redundant reads pile up → **reconsider or escalate**, never push
  the same plan harder.
- **val-vs-holdout gap = first-class alarm:** if the loop's own green board diverges
  from the frozen suite, **halt and escalate** — that gap *is* the reward-hacking
  signature.
- **Context hygiene:** observation-masking over summarization; compact before the
  >50% context-rot zone.

## 5. Backlog engine — fuel & loop-until-dry

`loop/backlog.json` is a priority queue.
**Priority = gate severity (P0 > P1 > P2) × blast radius × evidence strength.**
Failing P0 gates always jump the line. Work comes from, in order of authority:
red gates → adversarial disproofs → shrunk property counterexamples → surviving
mutants → coverage-ratchet misses. **When the queue runs dry, generate more:** a
fresh Playwright crawl of every UI-advertised feature vs real DB side-effects (this
codebase's known "fake/inert done" risk), a fresh IDOR/tenant sweep, the
next-lowest-mutation module, the metamorphic frontier on new endpoints, longer
soak/chaos, or a dispatched research task. The spec is a **living contract** —
behavior changes update `feature_board.json` in the same commit.

## 6. Cadence, cost & escalation

| Layer | Trigger | Scope |
|---|---|---|
| Inner | self-paced within a run | impacted tests + `tsc` + lint + patch-coverage ratchet |
| **Heartbeat** | scheduled every 6h (cron) | one backlog item, full VERIFY incl. adversarial critic |
| Nightly | cron | full suite + mutation (rotating module) + k6 soak + full battery |
| Deploy-time | PR CI green | can-i-deploy gate + preview canary metric watch + auto-rollback |

Cap iterations **and** tokens **and** wall-clock per feature; on any cap or stuck
signal → checkpoint the event log, commit clean, exit. The next fire resumes.

**Escalate to the founder (Telegram @uddinanas5 / push) when:**
- Any **irreversible / money-moving / prod** step is reached — Stripe **live** mode,
  real customers, a **prod DB** change, a prod migration. *(Prod customer data is a
  hard red line: never touched without explicit go-ahead.)*
- The val-vs-holdout alarm fires, or the loop flags a contradictory/impossible spec.
- A gate stays red after M reverts (a real blocker, not spin).
- A missing credential or a **product/business decision** the loop can't make (§7).
- Two consecutive clean runs → "candidate-ready, request GA sign-off."

North-star = **DORA stability** (change-failure-rate ~5%, recovery <1h), not merely
green tests.

## 7. What the loop needs from the founder

- **Stripe TEST keys** (secret + webhook signing) for a preview/dev env — *never
  live*. **This is the current hard blocker for Gate B (payments).** Enter via CLI
  `!` prompt or the Stripe dashboard; the loop verifies existence only, never prints
  the key.
- `dev` + `agents` DB connection strings (locked-down `sal_agent` role, no `public`).
- An error-tracker DSN (Sentry) + an observability endpoint (Gates C/D/F).
- A CI/Vercel **preview** + a **staging** env mirroring prod.
- Product decisions the loop can't make: correct commission/pricing numbers, SLO
  targets, GA feature scope, and the **final GA go-live + first live charge**.

**Autonomy charter:**
- ✅ May: branch, edit non-prod code, run tests/E2E/soak/chaos against `dev`+`agents`,
  open PRs, revert its own work, generate backlog, self-improve loop tooling behind
  the frozen gate.
- ⛔ Never: touch `main` directly, touch `public`/prod DB, use live Stripe keys,
  charge real cards, edit the frozen gate suite, use `--no-verify`, or self-certify
  a gate.
- 🚦 Pause for confirmation: any live-mode / real-customer / irreversible action, any
  shared-env migration, any credential change.
