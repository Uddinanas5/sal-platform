import * as Sentry from "@sentry/nextjs"
import { scrubEvent } from "@/lib/sentry-scrub"

// Server (Node runtime) Sentry init. No-op when SENTRY_DSN is absent, so dev/CI
// /tests never send. Error monitoring only — no session replay.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN),
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  beforeSend: scrubEvent,
})
