"use server"

import { SignJWT, jwtVerify } from "jose"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"
import { passwordResetEmail } from "@/lib/email-templates"

const SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET
)

const APP_URL = process.env.NEXTAUTH_URL || "http://localhost:3000"

type ActionResult = { success: true } | { success: false; error: string }

export async function requestPasswordReset(email: string): Promise<ActionResult> {
  try {
    // Always return success to prevent email enumeration
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
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
    console.error("Password reset request error:", e)
    return { success: false, error: "An unexpected error occurred. Please try again." }
  }
}

export async function resetPassword(
  token: string,
  newPassword: string
): Promise<ActionResult> {
  try {
    // Verify the JWT token
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let payload: any
    try {
      const result = await jwtVerify(token, SECRET)
      payload = result.payload
    } catch {
      return { success: false, error: "Invalid or expired reset link. Please request a new one." }
    }

    if (payload.purpose !== "password-reset" || !payload.userId) {
      return { success: false, error: "Invalid reset link. Please request a new one." }
    }

    // Validate password strength
    if (newPassword.length < 8) {
      return { success: false, error: "Password must be at least 8 characters long." }
    }

    // Hash the new password
    const passwordHash = await bcrypt.hash(newPassword, 12)

    // Update the user's password
    await prisma.user.update({
      where: { id: payload.userId },
      data: { passwordHash },
    })

    return { success: true }
  } catch (e) {
    console.error("Password reset error:", e)
    return { success: false, error: "An unexpected error occurred. Please try again." }
  }
}
