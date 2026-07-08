-- Server-side idempotency key for checkouts.
--
-- A retried or duplicated checkout (network retry, double-submit, an external
-- API/MCP client that resends on timeout) that carries the SAME key must not
-- double-record the sale — double charge, double gift-card spend, or duplicate
-- commission / inventory / loyalty rows. recordCheckout does a fast-path lookup
-- on this key and returns the original payment; this UNIQUE index is the
-- authoritative guard for a true-concurrent duplicate (the loser's INSERT fails
-- and its transaction rolls back, so no second sale is recorded).
--
-- Nullable + unique per business: Postgres treats NULLs as DISTINCT, so existing
-- rows, cash sales, and any checkout that omits a key are entirely unaffected.

ALTER TABLE "payments" ADD COLUMN "idempotency_key" VARCHAR(100);

CREATE UNIQUE INDEX "payments_business_id_idempotency_key_key"
  ON "payments" ("business_id", "idempotency_key");
