import type { ErrorEvent, EventHint } from "@sentry/nextjs"

// PII / secret scrubber for every Sentry event. SAL handles real client data
// (names, emails, phones) and secrets (Stripe keys, signatures, cron secret), so
// NOTHING sensitive may leave the building. We DROP request bodies wholesale,
// redact sensitive headers/keys anywhere in the event, and reduce the user to an
// opaque id. Useful debugging context (requestId, businessId, route) survives.

const SENSITIVE_HEADERS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "stripe-signature",
  "x-cron-secret",
  "x-api-key",
])

// Key names that should be redacted wherever they appear (case-insensitive).
const SENSITIVE_KEY =
  /(authorization|cookie|password|secret|token|api[_-]?key|card|cvc|cvv|email|phone|ssn|dsn|signature)/i

function redactDeep(value: unknown, depth = 0): void {
  if (depth > 6 || value === null || typeof value !== "object") return
  const obj = value as Record<string, unknown>
  for (const key of Object.keys(obj)) {
    if (SENSITIVE_KEY.test(key)) {
      obj[key] = "[Redacted]"
      continue
    }
    redactDeep(obj[key], depth + 1)
  }
}

export function scrubEvent(event: ErrorEvent, _hint?: EventHint): ErrorEvent {
  void _hint
  if (event.request) {
    // Request body + cookies can carry raw PII / tokens — drop entirely.
    delete event.request.data
    delete event.request.cookies
    delete event.request.query_string // query may carry tokens
    if (event.request.headers) {
      for (const name of Object.keys(event.request.headers)) {
        if (SENSITIVE_HEADERS.has(name.toLowerCase())) {
          event.request.headers[name] = "[Redacted]"
        }
      }
    }
  }
  // Reduce the user to an opaque id (no email / ip / username).
  if (event.user) {
    event.user = event.user.id ? { id: String(event.user.id) } : {}
  }
  // Redact sensitive keys anywhere in extra / contexts / tags.
  redactDeep(event.extra)
  redactDeep(event.contexts)
  redactDeep(event.tags)
  return event
}
