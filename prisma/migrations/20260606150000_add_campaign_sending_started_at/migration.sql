-- Campaign send-recovery watermark (additive + idempotent).
--
-- Adds campaigns.sending_started_at: the instant a manual campaign send began.
-- sendCampaign / sendCampaignCore stamps it alongside status="sending" and the
-- send loop's final write flips status to "sent". If the process crashes or the
-- serverless function times out mid-send, the catch-block revert may not run and
-- the row would otherwise be stranded in "sending" forever (no re-send, no edit
-- allowed). This watermark lets sendCampaign + updateCampaign treat a "sending"
-- row older than the recovery window as ABANDONED and therefore re-sendable /
-- editable — closing the "permanently stuck in sending" failure mode.
--
-- Nullable with no default: NULL means "never started sending", so existing
-- draft/scheduled/sent rows are unaffected.

-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "sending_started_at" TIMESTAMPTZ;
