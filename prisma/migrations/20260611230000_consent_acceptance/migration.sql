-- Consent-acceptance proof columns (adversarial ToS review, findings #4 & #13).
--
-- 1. users.tos_accepted_at + users.tos_version — WHEN a user affirmatively
--    accepted the Terms of Service and WHICH revision (TOS_VERSION from
--    src/lib/tos-version.ts, e.g. "2026-06-11"). Written at registration by
--    src/lib/actions/register.ts. Without these, the signup checkbox proved
--    nothing: it only enabled the submit button and saved no record.
-- 2. appointments.policy_accepted_at — WHEN the booking client confirmed a
--    public booking with the business's real cancellation policy displayed
--    above the Confirm button (createPublicBooking only). This is the
--    "cancellation-policy consent" evidence ToS §7 tells merchants to provide
--    in a dispute — it now actually exists in the database.
--
-- All three columns are NULLABLE with no default: NULL means "no recorded
-- acceptance" (pre-existing accounts / internal-API-MCP bookings where no
-- policy is shown). Nothing is backfilled — we never fabricate consent.
--
-- House pattern: additive + idempotent + schema-scoped (lands cleanly in
-- public / dev / agents schemas, no-ops on re-run). Rollback in rollback.sql.

-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tos_accepted_at" TIMESTAMPTZ;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tos_version" VARCHAR(20);

-- AlterTable
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "policy_accepted_at" TIMESTAMPTZ;
