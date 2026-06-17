-- Stripe dispute ledger (Phase 2B — chargeback handling).
--
-- One row per Stripe dispute, written exclusively by the charge.dispute.*
-- webhook handlers (src/lib/billing/disputes.ts). Key design points:
--   - id is the Stripe dispute id VERBATIM (du_... today, legacy dp_... still
--     exists) — varchar, never prefix-validated.
--   - status is varchar, NOT an enum: Stripe adds/retires dispute statuses
--     (charge_refunded is gone; prevented is new) and an unknown status must
--     be storable, never a constraint violation.
--   - business_id is NULLABLE: an orphan dispute (unknown payment_intent) is
--     still recorded so money-at-risk is never silently dropped.
--   - last_event_at is the per-row freshness watermark (Stripe event.created)
--     guarding out-of-order webhook delivery.
--   - fee_cents / fee_waived record the $15 dispute-fee policy (refunded if
--     the shop wins; WAIVED during beta). v1 is record-only — no auto-charge.
--
-- House pattern: idempotent + schema-scoped (lands cleanly in public / dev /
-- agents / rehearsal schemas, no-ops on re-run). Rollback in rollback.sql.
--
-- sal:safety-assured the two CREATE INDEX statements below are non-CONCURRENT
-- by design: they run in the same migration that creates this brand-new, empty
-- table, so there are zero rows and zero writers to block. (CONCURRENTLY also
-- cannot run inside Prisma's migration transaction.)

CREATE TABLE IF NOT EXISTS "disputes" (
    "id" VARCHAR(255) NOT NULL,
    "business_id" UUID,
    "payment_id" UUID,
    "payment_intent_id" VARCHAR(255),
    "charge_id" VARCHAR(255),
    "amount_cents" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "reason" VARCHAR(100),
    "status" VARCHAR(50) NOT NULL,
    "evidence_due_by" TIMESTAMPTZ,
    "fee_cents" INTEGER NOT NULL DEFAULT 1500,
    "fee_waived" BOOLEAN NOT NULL DEFAULT true,
    "last_event_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "disputes_business_id_status_idx"
  ON "disputes"("business_id", "status");

CREATE INDEX IF NOT EXISTS "disputes_payment_intent_id_idx"
  ON "disputes"("payment_intent_id");

-- FKs: ON DELETE SET NULL — a dispute record (money history) must SURVIVE the
-- deletion of its business/payment, exactly like the commissions precedent
-- (20260610120000). Guards are schema-scoped + idempotent.
DO $$
DECLARE
  cns oid := (SELECT oid FROM pg_namespace WHERE nspname = current_schema());
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'disputes_business_id_fkey' AND connamespace = cns
  ) THEN
    ALTER TABLE "disputes"
      ADD CONSTRAINT "disputes_business_id_fkey"
      FOREIGN KEY ("business_id") REFERENCES "businesses"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'disputes_payment_id_fkey' AND connamespace = cns
  ) THEN
    ALTER TABLE "disputes"
      ADD CONSTRAINT "disputes_payment_id_fkey"
      FOREIGN KEY ("payment_id") REFERENCES "payments"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
