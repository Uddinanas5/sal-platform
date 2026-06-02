# SAL Production Release Checklist

A short, repeatable process so every deploy is verified. Written for a
non-technical founder — you can run these yourself or hand them to whoever
ships the code.

## Before you promote a build to production

1. **CI is green.** The pull request shows a passing ✅ **CI** check
   (lint + type-check + tests + build all passed). Never merge a red PR.

2. **Run the launch safety gate locally** (this also checks production env vars):

   ```bash
   npm run check:launch
   ```

   It runs, in order: production env validation → lint → type-check → tests →
   build, and prints a clear pass/fail summary. If it says **"Safe to ship,"**
   you're good. If anything fails, stop and fix it.

   > CI (`.github/workflows/ci.yml`) runs the same code checks (lint,
   > type-check, tests, build) on every PR, minus the production env step —
   > CI intentionally has no production secrets. `check:launch` is the
   > human-run gate that adds the env check before an actual deploy.

3. **Smoke-test the real flow on the deployed Preview URL** (Vercel creates one
   per PR):
   - Register a throwaway salon → finish onboarding.
   - Open the public booking link → book an appointment.
   - Confirm the appointment shows on the dashboard.
   - Confirm the confirmation email arrives.
   - Cancel the appointment.

   If all five work, the core product is healthy.

## Promote

4. Merge the PR to `main`. Vercel deploys `main` to production automatically.

5. **Watch the deploy.** In Vercel, confirm the production deployment finished
   without errors, then load https://www.meetsal.ai and log in.

## If something is wrong after deploy (rollback)

6. In the Vercel dashboard → **Deployments**, find the previous known-good
   production deployment and click **"Promote to Production"** (instant rollback,
   no rebuild). Then investigate the bad deploy on a branch.

7. If money or data could be affected, see the incident runbook
   (to be added in the monitoring/backups PR) before doing anything else.

## Notes

- `main` is sacred: never push directly to it. All changes go through a PR with
  a passing CI check.
- Environment variables live in Vercel (Production / Preview / Development
  scopes). `npm run check:env` validates the production set.
