"use server"

import { z } from "zod"
import { SignJWT, jwtVerify } from "jose"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { rateLimit } from "@/lib/rate-limit"
import { sendEmail } from "@/lib/email"
import { passwordResetEmail } from "@/lib/email-templates"

const SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET
)

const APP_URL = process.env.NEXTAUTH_URL || "http://localhost:3000"

type ActionResult = { success: true } | { success: false; error: string }

const requestPasswordResetSchema = z.object({
  email: z.string().email("Valid email is required"),
})

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
})

export async function requestPasswordReset(email: string): Promise<ActionResult> {
  try {
    const parsed = requestPasswordResetSchema.parse({ email })

    // Rate limit: 3 reset requests per email per hour
    const rl = rateLimit(`reset:${parsed.email.toLowerCase().trim()}`, 3, 60 * 60 * 1000)
    if (rl.limited) {
      return { success: true } // Silent — don't reveal rate limiting to prevent enumeration
    }

    // Always return success to prevent email enumeration
    const user = await prisma.user.findUnique({
      where: { email: parsed.email.toLowerCase().trim() },
    })

    if (!user) {
      // Don't reveal whether the email exists
      return { success: true }
    }

    // Generate a signed JWT token with userId and purpose
    const token = await new SignJWT({ userId: user.id, purpose: "password-reset" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(SECRET)

    const resetUrl = `${APP_URL}/reset-password?token=${token}`

    const name = user.firstName || "there"

    await sendEmail({
      to: user.email,
      subject: "Reset Your Password - SAL Platform",
      html: passwordResetEmail({ name, resetUrl }),
    })

    return { success: true }
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    }
    console.error("Password reset request error:", e)
    return { success: false, error: "An unexpected error occurred. Please try again." }
  }
}

export async function resetPassword(
  token: string,
  newPassword: string
): Promise<ActionResult> {
  try {
    const parsed = resetPasswordSchema.parse({ token, newPassword })

    // Verify the JWT token
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let payload: any
    try {
      const result = await jwtVerify(parsed.token, SECRET)
      payload = result.payload
    } catch {
      return { success: false, error: "Invalid or expired reset link. Please request a new one." }
    }

    if (payload.purpose !== "password-reset" || !payload.userId) {
      return { success: false, error: "Invalid reset link. Please request a new one." }
    }

    // Hash the new password
    const passwordHash = await bcrypt.hash(parsed.newPassword, 12)

    // Update the user's password
    await prisma.user.update({
      where: { id: payload.userId },
      data: { passwordHash },
    })

    return { success: true }
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    }
    console.error("Password reset error:", e)
    return { success: false, error: "An unexpected error occurred. Please try again." }
  }
}
