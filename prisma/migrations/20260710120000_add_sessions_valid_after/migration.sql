-- L-034: server-side session invalidation watermark.
-- JWT/session tokens issued before this instant are rejected, so a password reset
-- or "log out everywhere" kills a stolen 7-day session immediately.
ALTER TABLE "users" ADD COLUMN "sessions_valid_after" TIMESTAMPTZ;
