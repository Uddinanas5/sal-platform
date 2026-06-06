-- Service bundles / packages. Idempotent guards so environments that already
-- received this table via `prisma db push` (dev/agents schemas) no-op cleanly.

-- CreateTable
CREATE TABLE IF NOT EXISTS "service_bundles" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "service_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "original_price" DECIMAL(10,2) NOT NULL,
    "bundle_price" DECIMAL(10,2) NOT NULL,
    "discount_percent" DECIMAL(5,2),
    "validity_days" INTEGER,
    "max_redemptions" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "service_bundles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "service_bundles_business_id_idx" ON "service_bundles"("business_id");

-- AddForeignKey (guarded: ADD CONSTRAINT has no IF NOT EXISTS)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'service_bundles_business_id_fkey' AND connamespace = (SELECT oid FROM pg_namespace WHERE nspname = current_schema())) THEN
    ALTER TABLE "service_bundles" ADD CONSTRAINT "service_bundles_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
