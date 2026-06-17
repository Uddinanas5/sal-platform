-- Rollback for 20260611211000_create_disputes.
--
-- Drops the disputes ledger. NOTE: this destroys recorded chargeback history —
-- only use to undo a bad deploy, never as a steady state. If any row exists,
-- export it first (disputes are reconstructable from the Stripe dashboard, but
-- the businessId/paymentId attribution is ours alone).
--
-- Schema-scoped + idempotent, matching the forward migration.

DROP TABLE IF EXISTS "disputes";
