import { Resend } from "resend"

const apiKey = process.env.RESEND_API_KEY
if (!apiKey) {
  console.warn("RESEND_API_KEY not set — emails will not be sent")
}
export const resend = apiKey ? new Resend(apiKey) : null

// Helper to send emails with error handling
export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string
  subject: string
  html: string
}) {
  if (!resend) {
    console.warn("Email skipped (Resend not configured):", subject)
    return { success: false, error: "Email service not configured" }
  }
  try {
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || "SAL Platform <noreply@salplatform.com>",
      to,
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
