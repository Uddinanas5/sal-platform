-- Product-sale line rows for standalone (no-appointment) checkouts (additive + idempotent).
--
-- Before this migration, checkout decremented inventory for product items but
-- never wrote an AppointmentProduct line, so reports.ts product-revenue and the
-- "Products" category bucket were structurally always $0 and every product sale
-- was mis-attributed to service revenue. The fix writes an AppointmentProduct
-- line at checkout for EVERY product sold.
--
-- A product can be sold WITHOUT an appointment (walk-in / POS quick sale), where
-- data.appointmentId is undefined. The existing column was NOT NULL, which would
-- have forced product lines to be gated to appointment-attached checkouts only.
-- Instead we relax it so a single line table covers both cases:
--   1. appointment_id is made NULLABLE (standalone product sale has no appointment).
--   2. payment_id is added (nullable FK to payments) so each product line ties back
--      to the Payment that collected it — reports can window product revenue by the
--      payment's createdAt, reconciling with the Payment ledger that backs Total
--      Revenue. businessId scoping for reports flows through the product relation
--      (products.business_id), which exists for every product row.
--
-- Idempotent: column drop-not-null is unconditional but safe to re-run; payment_id
-- add + FK + index all use IF NOT EXISTS / guarded DO blocks.

-- AlterTable: appointment_id becomes optional (standalone product sales).
ALTER TABLE "appointment_products" ALTER COLUMN "appointment_id" DROP NOT NULL;

-- AlterTable: link each product line to the Payment that collected it.
ALTER TABLE "appointment_products" ADD COLUMN IF NOT EXISTS "payment_id" UUID;

-- AddForeignKey (guarded — re-runnable).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'appointment_products_payment_id_fkey'
  ) THEN
    ALTER TABLE "appointment_products"
      ADD CONSTRAINT "appointment_products_payment_id_fkey"
      FOREIGN KEY ("payment_id") REFERENCES "payments"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "appointment_products_payment_id_idx" ON "appointment_products"("payment_id");
