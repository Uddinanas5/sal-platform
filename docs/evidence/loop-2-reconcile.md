# Loop 2 — Reconcile harden/production-readiness with main (frost UI merge)

**Date:** 2026-06-11
**Branch:** `harden/production-readiness` (PR #37)
**Trigger:** main received PR #38 (frost UI redesign, ~175 files, styling-only), which landed after #37 was opened.

## What was done

Merged `origin/main` (36215c3, the PR #38 merge commit) into `harden/production-readiness`
with `git merge` (not rebase — the branch is shared/pushed). Merge commit: `94e9080`.

## Conflicts

**None.** Git auto-merged all 175 files cleanly, including the anticipated
`src/app/layout.tsx` conflict — the hunks did not overlap:

- main's changes (dark-theme bootstrap `<script>` removed, `themeColor: "#062318"`) — kept, intact.
- harden's change (drop `icons:{}` metadata in favor of Next.js file-convention favicons:
  `src/app/favicon.ico`, `src/app/icon.svg`, `src/app/apple-icon.png`) — kept, intact.

## Frost-reversion check

`git diff origin/main --stat -- src/components src/app` after the merge:

- `src/components/**` — **zero diffs.** No frost styling reverted.
- `src/app/**` — only harden's own non-styling changes remain:
  - `api/_debug/sentry-test/route.ts` (new debug route)
  - `api/cron/dispatch/route.ts` (console.* → structured `getLog()`)
  - `api/stripe/create-payment-intent/route.ts` (hardening)
  - `global-error.tsx` (Sentry.captureException wiring — behavior, not styling)
  - `layout.tsx` (favicon metadata block only, see above)
  - `favicon.ico` / `icon.svg` / `apple-icon.png` (brand favicon assets)

## Gate results (on merged branch, all green)

| Gate | Result |
| --- | --- |
| `npm run typecheck` | PASS (after `npx prisma generate` in fresh worktree) |
| `npm run lint` | PASS — no warnings or errors |
| `npm test` | PASS — 538/538 (78 files) |
| `npm run test:tz` | PASS — 538/538 |
| `npm run check:invariants` | PASS — 15/15 invariants GREEN |
| `npm run check:fake-success` | PASS — 4 advisory notes, non-blocking |
| `npm run build` | PASS — production build succeeds |

No harden-branch test was affected by the frost UI changes (they assert behavior, not UI).

## Pre-existing CI failure found and fixed (not caused by the merge)

The branch's `verify` GitHub Action had been red since before this merge:
`tests/booking-dst.test.ts:112` failed on CI Linux with `expected '24:30' to be '00:30'`.
Root cause: the test helper `wallClockNY` used `hour12: false`, which on CI's ICU build
resolves to hourCycle `"h24"` (midnight renders as `24:30`). On macOS it resolves to
`"h23"`, so the suite passed locally. Fix: use `hourCycle: "h23"` explicitly — a
one-line, behavior-preserving test-helper change. No production code uses `hour12: false`
(verified by grep across `src/`, `tests/`, `scripts/`). Re-verified locally under default
TZ and `TZ=Pacific/Kiritimati` (11/11 pass).

## Notes for humans

- PR #39 (`loop/golden-path`) branched off harden and targets main; it should pick up
  this merge once the updated harden branch is merged into it (verified separately).
- The 4 `check:fake-success` advisory toasts (payment-dialog receipt, client tag removal,
  settings subscription, onboarding templates) predate this merge and remain advisory.
