import { Resend } from "resend"

export const resend = new Resend(process.env.RESEND_API_KEY)

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
