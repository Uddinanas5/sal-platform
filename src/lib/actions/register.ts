"use server"

import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { rateLimit } from "@/lib/rate-limit"

type RegisterResult =
  | { success: true }
  | { success: false; error: string }

export async function registerBusiness(data: {
  businessName: string
  firstName: string
  lastName: string
  email: string
  password: string
}): Promise<RegisterResult> {
  try {
    // Rate limit: 3 registrations per email per hour
    const rl = rateLimit(`register:${data.email.toLowerCase().trim()}`, 3, 60 * 60 * 1000)
    if (rl.limited) {
      return { success: false, error: "Too many attempts. Please try again later." }
    }

    // Validate inputs
    if (!data.businessName.trim()) {
      return { success: false, error: "Business name is required" }
    }
    if (!data.firstName.trim()) {
      return { success: false, error: "First name is required" }
    }
    if (!data.lastName.trim()) {
      return { success: false, error: "Last name is required" }
    }
    if (!data.email.trim()) {
      return { success: false, error: "Email is required" }
    }
    if (data.password.length < 8) {
      return { success: false, error: "Password must be at least 8 characters" }
    }

    // Check if email is already in use
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    })
    if (existingUser) {
      return { success: false, error: "An account with this email already exists" }
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, 12)

    // Generate a URL-safe slug from business name
    const baseSlug = data.businessName
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
          email: data.email.toLowerCase(),
          passwordHash,
          firstName: data.firstName.trim(),
          lastName: data.lastName.trim(),
          role: "owner",
          status: "active",
        },
      })

      // Create the business
      const business = await tx.business.create({
        data: {
          ownerId: user.id,
          name: data.businessName.trim(),
          slug,
          email: data.email.toLowerCase(),
          subscriptionTier: "free",
          subscriptionStatus: "active",
        },
      })

      // Create the primary location
      const locationSlug = `${baseSlug}-main-${slugSuffix}`
      await tx.location.create({
        data: {
          businessId: business.id,
          name: data.businessName.trim(),
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
  } catch (error) {
    console.error("Registration error:", error)
    return { success: false, error: "Something went wrong. Please try again." }
  }
}
