import * as Sentry from "@sentry/nextjs"
import { scrubEvent } from "@/lib/sentry-scrub"

// Browser Sentry init. Uses the PUBLIC DSN; no-op when absent. Session replay is
// OFF (privacy + bundle size) — error monitoring only. Client errors are sent via
// the same-origin tunnel (next.config tunnelRoute) so the strict CSP/adblockers
// don't drop them.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  beforeSend: scrubEvent,
})
