import { Resend } from "resend"

const apiKey = process.env.RESEND_API_KEY
if (!apiKey) {
  console.warn("RESEND_API_KEY not set — emails will not be sent")
}
export const resend = apiKey ? new Resend(apiKey) : null

// Default reply-to so a client hitting "Reply" reaches a monitored inbox
// instead of the no-reply sender. Callers can override (e.g. pass the salon's
// own email on client-facing booking mail so replies reach the salon).
const DEFAULT_REPLY_TO = process.env.EMAIL_REPLY_TO || "support@meetsal.ai"

// Helper to send emails with error handling
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
  if (!resend) {
    console.warn("Email skipped (Resend not configured):", subject)
    return { success: false, error: "Email service not configured" }
  }
  try {
    const { data, error } = await resend.emails.send({
      // EMAIL_FROM must be a sender on a Resend-verified domain (meetsal.ai).
      // The fallback is only for local/dev; production sets EMAIL_FROM in Vercel.
      from: process.env.EMAIL_FROM || "SAL <noreply@meetsal.ai>",
      to,
      replyTo: replyTo || DEFAULT_REPLY_TO,
      subject,
      html,
    })
    if (error) {
      console.error("Email send error:", error)
      return { success: false, error }
    }
    return { success: true, data }
  } catch (e) {
    console.error("Email error:", e)
    return { success: false, error: e }
  }
}
