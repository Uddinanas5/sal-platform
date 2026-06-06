-- Billing event-ordering guard (additive + idempotent).
--
-- Adds businesses.last_billing_event_at: a per-tenant watermark of the latest
-- Stripe billing event (event.created) we have successfully applied to
-- subscription_status. The webhook uses it as a staleness guard so a stale,
-- out-of-order downgrade (e.g. an invoice.payment_failed delivered AFTER a
-- card-retry success re-activates the salon) cannot overwrite a fresher state
-- and re-flip a fully-current, paying salon back to past_due.
--
-- Nullable with no default: NULL means "no billing event applied yet", so the
-- first billing event for any existing business always passes the guard.

-- AlterTable
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "last_billing_event_at" TIMESTAMPTZ;
