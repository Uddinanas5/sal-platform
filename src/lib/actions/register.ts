"use server"

import { z } from "zod"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { rateLimit } from "@/lib/rate-limit"

type RegisterResult =
  | { success: true }
  | { success: false; error: string }

const registerBusinessSchema = z.object({
  businessName: z.string().trim().min(1, "Business name is required"),
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  email: z.string().email("Valid email is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
})

export async function registerBusiness(data: {
  businessName: string
  firstName: string
  lastName: string
  email: string
  password: string
}): Promise<RegisterResult> {
  try {
    const parsed = registerBusinessSchema.parse(data)

    // Rate limit: 3 registrations per email per hour
    const rl = rateLimit(`register:${parsed.email.toLowerCase().trim()}`, 3, 60 * 60 * 1000)
    if (rl.limited) {
      return { success: false, error: "Too many attempts. Please try again later." }
    }

    // Check if email is already in use
    const existingUser = await prisma.user.findUnique({
      where: { email: parsed.email.toLowerCase() },
    })
    if (existingUser) {
      return { success: false, error: "An account with this email already exists" }
    }

    // Hash password
    const passwordHash = await bcrypt.hash(parsed.password, 12)

    // Generate a URL-safe slug from business name
    const baseSlug = parsed.businessName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
    const slugSuffix = Math.random().toString(36).substring(2, 8)
    const slug = `${baseSlug}-${slugSuffix}`

    // Create user, business, and location in a transaction
    await prisma.$transaction(async (tx) => {
      // Create the user
      const user = await tx.user.create({
        data: {
          email: parsed.email.toLowerCase(),
          passwordHash,
          firstName: parsed.firstName.trim(),
          lastName: parsed.lastName.trim(),
          role: "owner",
          status: "active",
        },
      })

      // Create the business
      const business = await tx.business.create({
        data: {
          ownerId: user.id,
          name: parsed.businessName.trim(),
          slug,
          email: parsed.email.toLowerCase(),
          subscriptionTier: "free",
          subscriptionStatus: "active",
        },
      })

      // Create the primary location
      const locationSlug = `${baseSlug}-main-${slugSuffix}`
      await tx.location.create({
        data: {
          businessId: business.id,
          name: parsed.businessName.trim(),
          slug: locationSlug,
          addressLine1: "",
          city: "",
          country: "US",
          isPrimary: true,
          isActive: true,
        },
      })
    })

    return { success: true }
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    }
    console.error("Registration error:", e)
    return { success: false, error: "Something went wrong. Please try again." }
  }
}
