import { Resend } from "resend"
import { assertOutsideTransaction } from "@/lib/db/transaction-side-effects"

const apiKey = process.env.RESEND_API_KEY
if (!apiKey) {
  console.warn("RESEND_API_KEY not set — emails will not be sent")
}
export const resend = apiKey ? new Resend(apiKey) : null

// Default reply-to so a client hitting "Reply" reaches a monitored inbox
// instead of the no-reply sender. Callers can override (e.g. pass the salon's
// own email on client-facing booking mail so replies reach the salon).
const DEFAULT_REPLY_TO = process.env.EMAIL_REPLY_TO || "support@meetsal.ai"

const EMAIL_TIMEOUT_MS = Number(process.env.EMAIL_TIMEOUT_MS) || 8000
const EMAIL_MAX_RETRIES = 2
const EMAIL_BACKOFF_BASE_MS = 250

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/** Race a promise against a timeout that rejects (the underlying send keeps running). */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("email_timeout")), ms)),
  ])
}

/**
 * Transient vs terminal. Retry network throws/timeouts and 429/5xx; do NOT retry
 * a 4xx (e.g. invalid recipient) — it won't recover. Resend returns errors as an
 * object with `name`/`statusCode`; network/timeout surface as thrown Errors.
 */
function isRetryable(err: unknown): boolean {
  const status = (err as { statusCode?: number; status?: number })?.statusCode ?? (err as { status?: number })?.status
  if (typeof status === "number") return status === 429 || status >= 500
  return true // thrown network/timeout error
}

// Helper to send emails with timeout + bounded retry. NEVER throws — email is a
// best-effort, post-commit side effect (assertOutsideTransaction enforces it),
// so a slow/failing provider must not break the booking/checkout request.
export async function sendEmail({
  to,
  subject,
  html,
  replyTo,
}: {
  to: string
  subject: string
  html: string
  replyTo?: string
}) {
  assertOutsideTransaction("sendEmail")

  if (!resend) {
    console.warn("Email skipped (Resend not configured):", subject)
    return { success: false, error: "Email service not configured" }
  }

  let lastError: unknown = "Email failed"
  for (let attempt = 0; attempt <= EMAIL_MAX_RETRIES; attempt++) {
    if (attempt > 0) await sleep(EMAIL_BACKOFF_BASE_MS * 2 ** (attempt - 1))
    try {
      const { data, error } = await withTimeout(
        resend.emails.send({
          // EMAIL_FROM must be a sender on a Resend-verified domain (meetsal.ai).
          // The fallback is only for local/dev; production sets EMAIL_FROM in Vercel.
          from: process.env.EMAIL_FROM || "SAL <noreply@meetsal.ai>",
          to,
          replyTo: replyTo || DEFAULT_REPLY_TO,
          subject,
          html,
        }),
        EMAIL_TIMEOUT_MS,
      )
      if (error) {
        lastError = error
        if (isRetryable(error) && attempt < EMAIL_MAX_RETRIES) continue
        console.error("Email send error:", error)
        return { success: false, error }
      }
      return { success: true, data }
    } catch (e) {
      lastError = e
      if (attempt < EMAIL_MAX_RETRIES) continue // network/timeout — retry
      console.error("Email error:", e)
      return { success: false, error: e }
    }
  }
  return { success: false, error: lastError }
}
