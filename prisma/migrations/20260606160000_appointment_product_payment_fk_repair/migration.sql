-- Repair: add appointment_products.payment_id FK where it is missing.
--
-- Migration 20260606140000 added the payment_id column + a guarded FK, but its
-- guard checked pg_constraint by NAME ONLY (no schema scoping). Because the dev
-- and rehearsal schemas in the same database already held a constraint of that
-- name, the database-wide existence check matched and the FK was SKIPPED on the
-- target (public) schema — leaving the column without its FK in production.
--
-- This migration re-adds it with a SCHEMA-SCOPED guard (connamespace =
-- current_schema()), so it lands in whatever schema the migration runs against
-- and cleanly no-ops where the FK already exists. Same fix pattern already used
-- by the invitations/oauth and service_bundles migrations.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'appointment_products_payment_id_fkey'
      AND connamespace = (SELECT oid FROM pg_namespace WHERE nspname = current_schema())
  ) THEN
    ALTER TABLE "appointment_products"
      ADD CONSTRAINT "appointment_products_payment_id_fkey"
      FOREIGN KEY ("payment_id") REFERENCES "payments"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
