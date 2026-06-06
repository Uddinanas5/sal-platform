-- Phase-2/3 foundations (all additive + idempotent):
--   1. stripe_events — webhook idempotency ledger
--   2. payments.method_note — GAP-037 sub-tender note for "other" payments
--   3. businesses.stripe_customer_id / stripe_subscription_id / billing_exempt
--      — SAL subscription billing (the salon paying SAL)

-- CreateTable
CREATE TABLE IF NOT EXISTS "stripe_events" (
    "id" VARCHAR(255) NOT NULL,
    "type" VARCHAR(100) NOT NULL,
    "processed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stripe_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "stripe_events_type_idx" ON "stripe_events"("type");

-- AlterTable
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "method_note" VARCHAR(100);

-- AlterTable
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "stripe_customer_id" VARCHAR(255);
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "stripe_subscription_id" VARCHAR(255);
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "billing_exempt" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex (unique on the new business columns)
CREATE UNIQUE INDEX IF NOT EXISTS "businesses_stripe_customer_id_key" ON "businesses"("stripe_customer_id");
CREATE UNIQUE INDEX IF NOT EXISTS "businesses_stripe_subscription_id_key" ON "businesses"("stripe_subscription_id");
