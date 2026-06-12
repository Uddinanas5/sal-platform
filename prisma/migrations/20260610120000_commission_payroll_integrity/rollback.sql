-- Rollback for 20260610120000_commission_payroll_integrity.
-- Reverts the commissions.appointment_id FK to ON DELETE CASCADE and drops the
-- composite index. Schema-scoped + idempotent, same as the forward migration.
-- NOTE: reverting to CASCADE re-introduces the payroll-data-loss footgun; only
-- use to undo a bad deploy, not as a steady state.

DO $$
DECLARE
  cns oid := (SELECT oid FROM pg_namespace WHERE nspname = current_schema());
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'commissions_appointment_id_fkey'
      AND connamespace = cns
      AND confdeltype = 'n'
  ) THEN
    ALTER TABLE "commissions" DROP CONSTRAINT "commissions_appointment_id_fkey";
    ALTER TABLE "commissions"
      ADD CONSTRAINT "commissions_appointment_id_fkey"
      FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DROP INDEX IF EXISTS "commissions_staff_id_created_at_idx";
