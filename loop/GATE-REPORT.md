# Gate Report — PENDING

_generated 2026-07-09T06:25:45.721Z · run `node loop/gate.mjs`_

**Verdict: PENDING** — PUBLIC-GA requires every P0 check green.

- pass: 14 · fail: 0 · pending: 19 · blocked: 0
- checks run this pass: 13 (no-DB set — add `--with-db` for golden path / soak / e2e / restore)

## P0 status (a single red here = not launchable)
- 🟢 A.1 — Cross-tenant reads: seed as Shop A, auth as Shop B, every read/list/report returns 0 rows of A (404/403)
- 🟢 A.2 — Cross-tenant mutations: Shop B cannot update/cancel A's appointment by guessing id
- 🟢 A.3 — Query helpers refuse a missing businessId (no cross-tenant fallback)
- ⚪️ A.4 — tenant_id derives from the server session only; X-Tenant-ID / body / query overrides are ignored
- ⚪️ A.5 — Every $queryRaw/$executeRaw carries an explicit tenant predicate
- 🟢 B.1 — No Stripe secret key in repo or non-Production env
- 🟢 B.2 — Commission is non-zero and correct on a real end-to-end checkout (guards the $0-commission bug)
- 🟢 B.3 — Webhook idempotent: replay same event.id twice ⇒ single side-effect (no double charge/booking/SMS)
- 🟢 B.4 — Price tampering rejected; totals recomputed server-side
- ⚪️ B.5 — Live E2E book→pay→webhook→DB row against Stripe TEST mode
- 🟢 C.1 — Error tracker (Sentry) wired for server + client exceptions
- ⚪️ C.2 — Structured logs carry requestId + shopId on every line
- ⚪️ C.3 — Symptom alerts (booking-fail, checkout-fail, 5xx, auth-spike) each with a runbook and a real page path
- ⚪️ E.1 — CI green (build + typecheck + lint + tests) blocks merge to main
- 🟢 E.2 — Migrations use expand-and-contract (no destructive drop in the same deploy)
- ⚪️ E.3 — Rollback tested: deploy N → N+1 → revert to N in staging
- ⚪️ G.1 — Server-side authorization on every mutating path (no client trust)
- ⚪️ G.2 — Auth edge cases: account enumeration, session fixation, password-reset abuse/rate-limit
- ⚪️ G.3 — No secrets in source; deps/SAST show no unaddressed critical/high CVE
- ⚪️ G.4 — TLS + HSTS + CSP + security headers set
- ⚪️ H.1 — Automated backups enabled with defined retention
- ⚪️ H.2 — ACTUAL restore into scratch env verified (row counts, app boots)
- 🟢 H.3 — Tenant deletion removes rows + cache + files with no residue
- 🟢 J.1 — Golden path against real DB: signup→configure→public books→confirmation→checkout w/ commission→dashboard/reports
- 🟢 J.2 — Business invariants (15-rule board) all green
- 🟢 J.3 — Every UI-advertised feature actually does something (no fake/inert 'done' features)
- ⚪️ J.4 — Public booking golden-path E2E green in a real browser
- ⚪️ J.5 — Owner appointment + checkout E2E green in a real browser

## This run
- ✅ A.1 [P0] exit 0
- ✅ A.2 [P0] exit 0
- ✅ A.3 [P0] exit 0
- ✅ B.1 [P0] .env gitignored+untracked; no live/real secret in tracked files
- ✅ B.2 [P0] exit 0
- ✅ B.3 [P0] exit 0
- ✅ B.4 [P0] exit 0
- ✅ C.1 [P0] present: sentry.server.config.ts
- ✅ E.2 [P0] exit 0
- ✅ F.2 [P1] present: src/lib/rate-limit.ts
- ✅ H.3 [P0] exit 0
- ✅ J.2 [P0] exit 0
- ✅ J.3 [P0] exit 0
