-- Rollback for 20260611210000_payment_status_disputed.
--
-- Postgres cannot DROP a single enum value, so rolling back means rebuilding
-- the type without 'disputed'. That is only safe when NO payments row still
-- uses the value — the guard below fails LOUDLY (and leaves everything intact)
-- if any do. Re-point those rows first (manually, with founder sign-off:
-- a disputed payment is money-at-risk state) and re-run.
--
-- Schema-scoped: run with the same search_path / ?schema= as the forward
-- migration so the right "PaymentStatus" type is rebuilt.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "payments" WHERE "status"::text = 'disputed') THEN
    RAISE EXCEPTION 'Cannot roll back: payments rows still have status=disputed. Resolve them first.';
  END IF;
END $$;

ALTER TYPE "PaymentStatus" RENAME TO "PaymentStatus_old";
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'completed', 'failed', 'refunded');
ALTER TABLE "payments"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "PaymentStatus" USING ("status"::text::"PaymentStatus"),
  ALTER COLUMN "status" SET DEFAULT 'pending';
DROP TYPE "PaymentStatus_old";
