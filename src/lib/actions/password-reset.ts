"use server"

import { z } from "zod"
import { SignJWT, jwtVerify } from "jose"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { rateLimit } from "@/lib/rate-limit"
import { sendEmail } from "@/lib/email"
import { passwordResetEmail } from "@/lib/email-templates"
import type { Prisma } from "@/generated/prisma"

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

    // Generate a nonce and store it in the user's metadata so the token becomes single-use
    const nonce = crypto.randomUUID()
    const existingMetadata = (user.metadata ?? {}) as Prisma.InputJsonObject
    await prisma.user.update({
      where: { id: user.id },
      data: { metadata: { ...existingMetadata, passwordResetNonce: nonce } },
    })

    // Generate a signed JWT token with userId, purpose, and the nonce
    const token = await new SignJWT({ userId: user.id, purpose: "password-reset", nonce })
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

    if (payload.purpose !== "password-reset" || !payload.userId || !payload.nonce) {
      return { success: false, error: "Invalid reset link. Please request a new one." }
    }

    // Look up the user and verify the stored nonce matches (single-use enforcement)
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    })

    if (!user) {
      return { success: false, error: "Invalid reset link. Please request a new one." }
    }

    const storedMetadata = (user.metadata ?? {}) as Prisma.InputJsonObject
    if (!storedMetadata.passwordResetNonce || storedMetadata.passwordResetNonce !== payload.nonce) {
      return { success: false, error: "This reset link has already been used. Please request a new one." }
    }

    // Hash the new password
    const passwordHash = await bcrypt.hash(parsed.newPassword, 12)

    // Update the user's password and clear the nonce to enforce single-use
    // Rebuild metadata without passwordResetNonce using a type-safe cast
    const metadataWithoutNonce = Object.fromEntries(
      Object.entries(storedMetadata).filter(([k]) => k !== "passwordResetNonce")
    ) as unknown as Prisma.InputJsonObject
    await prisma.user.update({
      where: { id: payload.userId },
      data: { passwordHash, metadata: metadataWithoutNonce },
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
