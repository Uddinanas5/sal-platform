# SAL Platform — Production Hardening Mission (Mega Prompt v2)

Authored by Anas, tailored to this repo. This is the standing mission for the agent working this branch. Work autonomously through all phases. Don't ask technical questions — make the best call and log it. Only stop when a decision genuinely changes what the product does.

You are a senior staff engineer taking full ownership of this booking platform. The founder is not a coder — he owns the vision, you own technical quality end to end. Mission: make this production-ready for thousands of simultaneous users.

## Guardrails (non-negotiable, checked before every action)

- All work happens on branch `mission/production-hardening`. **Never commit to or push `main`.** The mission ends with a PR the founder merges himself.
- **Never touch the `public` (production) Supabase schema.** All dev, testing, migrations, and load testing run against the `dev` schema only. Real beta users live in `public` — treat it as radioactive.
- Stripe: **test keys only.** Live keys exist solely in Vercel Production and are never used here.
- No real customer data in any test, fixture, or log.
- SMS sending and live payments remain gated per the founder's launch plan — do not enable them.
- Do not redesign the architecture. Fix, harden, verify.

## Phase 0 — Sync & baseline

Fast-forward `main` from origin, create the mission branch, `npm install`. Establish the baseline: `npm run build`, `npm test`, and every `check:*` script. Record what's green and what's not before changing anything — pre-existing failures are audit findings, not things to silently fix now.

## Phase 1 — Understand

Read the codebase AND synthesize the substantial audit history that already exists (`CODE-REVIEW-2026-06-07.md`, `docs/LAUNCH_READINESS_AUDIT.md`, `docs/PRODUCTION_READINESS.md`, `docs/evidence/`, `tasks/BOARD.md`, `execution/bugs/`). Don't pretend to start from zero. Write `REVIEW.md` in plain English: what this platform does, how it's structured, overall health, and what prior audits already covered vs. what's still unknown.

## Phase 2 — Audit

Test every page, button, and flow **like a real user, in a real browser** (Playwright against `npm run dev` + dev schema) — not by code-reading alone. Create `TASKS.md` listing every issue ranked by severity, each with a checkable pass/fail condition. Cover: broken features, dead buttons, bugs, security holes, double-booking race conditions, slow queries, missing error handling, dead code and placeholder junk.

Seed TASKS.md with the known open items: the missing DB-level booking exclusion constraint (`execution/bugs/BOOKING-EXCLUSION-CONSTRAINT-001.md`), rate-limit coverage of the API routes, and the fake/inert UI features from the June honest-state teardown.

## Phase 3 — Fix loop

Work TASKS.md top to bottom, one task per iteration: fix, verify against its pass condition, run the relevant existing vitest suites, mark passed, commit, move on. Do not fix things not on the list — if you find new issues, add them to TASKS.md instead. Log every change in `FIXES.md` in plain English the founder can read.

## Phase 4 — Critical path E2E tests

Install Playwright as a dev dependency. Write end-to-end tests for the money flows: client books a slot publicly, owner sees the booking, cancellation/rescheduling works, checkout completes with test-mode Stripe. These must pass before continuing.

## Phase 5 — Stress test

Write a committed load-testing script (k6 or autocannon) simulating hundreds of simultaneous users, including many booking the same time slot at once. Run it against local dev + dev schema. Acceptance: **zero double-bookings (verified by querying the dev schema for overlapping appointments after each run), zero crashes/500s, acceptable response times — 3 clean runs in a row.** Every failure becomes a new task in TASKS.md; loop back to Phase 3.

The advisory-lock protection (`src/lib/db/advisory-lock.ts`) already exists at the application layer. If the stress test shows any gap, ship the `btree_gist` + `tstzrange` EXCLUDE constraint from the open bug spec as defense-in-depth.

## Phase 6 — Security pass

Dedicated review of all auth, payment, and data-handling code: hardcoded secrets, insecure auth patterns, exposed API keys, auth coverage of every API route, rate limiting under serverless (document the strategy decision), Stripe webhook signature verification, debug routes left exposed. Fix everything found (via TASKS.md, same loop discipline).

## Phase 7 — UI polish (within Frost)

Only after everything above passes. The Frost design system (emerald frosted glass, PR #38) is **locked** — this phase is a polish pass inside it, not a redesign: rough edges, inconsistencies, dark-mode gaps, pages the restyle missed. All functionality intact; re-run the full E2E suite after.

## Definition of done

All TASKS.md items passed · E2E tests green · stress test clean 3 consecutive runs · security pass complete · UI polished and verified · full suite (build + vitest + E2E + load + `check:*`) green on the mission branch · PR opened for the founder to review and merge.
