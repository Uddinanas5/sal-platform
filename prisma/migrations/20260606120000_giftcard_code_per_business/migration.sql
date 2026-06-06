-- Make gift_cards.code unique PER TENANT instead of globally.
--
-- GiftCard.code was @unique (a GLOBAL constraint across all businesses), so the
-- per-business duplicate pre-check in issueGiftCard could pass while the create
-- still hit a cross-tenant collision and surfaced a raw P2002. This mirrors
-- Discount.code, which is unique on (business_id, code).
--
-- Idempotent + guarded so re-running (or running against a DB that already has
-- the new shape) is a no-op. Codes are auto-generated and were historically
-- globally unique, so no backfill/dedup is required.

-- Drop the old GLOBAL unique index on (code) if it still exists.
DROP INDEX IF EXISTS "gift_cards_code_key";

-- Create the composite PER-TENANT unique index on (business_id, code).
CREATE UNIQUE INDEX IF NOT EXISTS "gift_cards_business_id_code_key" ON "gift_cards"("business_id", "code");
