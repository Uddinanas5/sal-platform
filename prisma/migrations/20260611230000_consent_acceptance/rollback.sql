-- Rollback for 20260611230000_consent_acceptance.
--
-- Drops the consent-proof columns. NOTE: this destroys the recorded ToS
-- acceptances and cancellation-policy consents — legal evidence that cannot be
-- reconstructed afterwards. Only use to undo a bad deploy, never as a steady
-- state; export the columns first if any non-NULL rows exist.
--
-- Schema-scoped + idempotent, matching the forward migration.

ALTER TABLE "users" DROP COLUMN IF EXISTS "tos_accepted_at";
ALTER TABLE "users" DROP COLUMN IF EXISTS "tos_version";

ALTER TABLE "appointments" DROP COLUMN IF EXISTS "policy_accepted_at";
