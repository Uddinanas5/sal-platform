-- Commission payroll integrity (Phase 3A CRITICAL + Phase 4E perf).
--
-- (1) FK behavior change: commissions.appointment_id was ON DELETE CASCADE, so
--     deleting an Appointment silently destroyed its Commission/payroll rows. A
--     Commission self-contains gross/rate/amount/period/status, so it must
--     SURVIVE the appointment. Switch to ON DELETE SET NULL (drop only the link).
-- (2) Add the composite index serving the payroll read (staffId IN + createdAt
--     range + order-by-createdAt).
--
-- Both guards are SCHEMA-SCOPED (connamespace = current_schema()) + idempotent,
-- matching the house pattern, so this lands in whatever schema it runs against
-- (public / dev / agents / a rehearsal copy) and cleanly no-ops on re-run.
-- Rollback SQL is in rollback.sql alongside this file.

-- (1) appointment_id FK: ON DELETE CASCADE -> ON DELETE SET NULL.
-- confdeltype 'c' = CASCADE (the broken state); 'n' = SET NULL (the target).
DO $$
DECLARE
  cns oid := (SELECT oid FROM pg_namespace WHERE nspname = current_schema());
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'commissions_appointment_id_fkey'
      AND connamespace = cns
      AND confdeltype = 'c'
  ) THEN
    ALTER TABLE "commissions" DROP CONSTRAINT "commissions_appointment_id_fkey";
    ALTER TABLE "commissions"
      ADD CONSTRAINT "commissions_appointment_id_fkey"
      FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- (2) Composite index for payroll reads.
-- sal:safety-assured commissions is a small early-stage table; the brief write
-- lock from a non-CONCURRENT CREATE INDEX is acceptable here. Switch to
-- CONCURRENTLY (outside a txn) if the table grows large before this deploys.
CREATE INDEX IF NOT EXISTS "commissions_staff_id_created_at_idx"
  ON "commissions"("staff_id", "created_at");
