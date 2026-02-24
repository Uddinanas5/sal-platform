"use server"

import { z } from "zod"
import { SignJWT, jwtVerify } from "jose"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { requireMinRole } from "@/lib/auth-utils"
import { sendEmail } from "@/lib/email"
import { staffInvitationEmail } from "@/lib/email-templates"
import { hasRole } from "@/lib/permissions"

const SECRET = new TextEncoder().encode(process.env.NEXTAUTH_SECRET)
const APP_URL = process.env.NEXTAUTH_URL || "http://localhost:3000"
const INVITE_TTL_HOURS = 72

type ActionResult<T = void> = { success: true; data: T } | { success: false; error: string }

const sendInvitationSchema = z.object({
  email: z.string().email("Valid email is required"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  role: z.enum(["staff", "admin"]),
})

const acceptInvitationSchema = z.object({
  token: z.string().min(1, "Token is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
})

const updateTeamMemberRoleSchema = z.object({
  targetUserId: z.string().uuid(),
  newRole: z.enum(["staff", "admin"]),
})

// ─── Send Invitation ─────────────────────────────────────────────────────────

export async function sendInvitation(data: {
  email: string
  firstName: string
  lastName: string
  role: "staff" | "admin"
}): Promise<ActionResult<{ invitationId: string }>> {
  try {
    const parsed = sendInvitationSchema.parse(data)
    const ctx = await requireMinRole("admin")
    const { businessId, userId, role: inviterRole } = ctx

    // Only owner can invite admins
    if (parsed.role === "admin" && !hasRole(inviterRole, "owner")) {
      return { success: false, error: "Only the owner can invite admins" }
    }

    const email = parsed.email.toLowerCase().trim()

    // Get business name and inviter name for the email
    const [business, inviter] = await Promise.all([
      prisma.business.findUnique({ where: { id: businessId }, select: { name: true } }),
      prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true } }),
    ])
    if (!business) return { success: false, error: "Business not found" }
    if (!inviter) return { success: false, error: "Inviter not found" }

    // Check no active staff with this email in this business
    const existingStaff = await prisma.staff.findFirst({
      where: {
        user: { email },
        primaryLocation: { businessId },
        isActive: true,
        deletedAt: null,
      },
    })
    if (existingStaff) {
      return { success: false, error: "A staff member with this email already exists in this business" }
    }

    // Revoke any existing pending invitation for this email
    await prisma.staffInvitation.updateMany({
      where: {
        businessId,
        email,
        acceptedAt: null,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    })

    const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000)

    const invitation = await prisma.staffInvitation.create({
      data: {
        businessId,
        email,
        firstName: parsed.firstName,
        lastName: parsed.lastName,
        role: parsed.role,
        invitedById: userId,
        expiresAt,
      },
    })

    const token = await new SignJWT({
      purpose: "staff-invite",
      invitationId: invitation.id,
      email,
      businessId,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime(`${INVITE_TTL_HOURS}h`)
      .sign(SECRET)

    const acceptUrl = `${APP_URL}/accept-invitation?token=${token}`
    const inviterName = `${inviter.firstName} ${inviter.lastName}`
    const inviteeName = `${parsed.firstName} ${parsed.lastName}`

    await sendEmail({
      to: email,
      subject: `You're invited to join ${business.name} on SAL`,
      html: staffInvitationEmail({
        inviteeName,
        inviterName,
        businessName: business.name,
        role: parsed.role,
        acceptUrl,
        expiresInHours: INVITE_TTL_HOURS,
      }),
    })

    revalidatePath("/settings")
    return { success: true, data: { invitationId: invitation.id } }
  } catch (e) {
    if (e instanceof z.ZodError) return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    console.error("sendInvitation error:", e)
    return { success: false, error: (e as Error).message }
  }
}

// ─── Revoke Invitation ────────────────────────────────────────────────────────

export async function revokeInvitation(invitationId: string): Promise<ActionResult> {
  try {
    z.string().uuid().parse(invitationId)
    const { businessId } = await requireMinRole("admin")

    const invitation = await prisma.staffInvitation.findUnique({ where: { id: invitationId } })
    if (!invitation || invitation.businessId !== businessId) {
      return { success: false, error: "Invitation not found" }
    }
    if (invitation.acceptedAt) return { success: false, error: "Invitation already accepted" }
    if (invitation.revokedAt) return { success: false, error: "Invitation already revoked" }

    await prisma.staffInvitation.update({
      where: { id: invitationId },
      data: { revokedAt: new Date() },
    })

    revalidatePath("/settings")
    return { success: true, data: undefined }
  } catch (e) {
    if (e instanceof z.ZodError) return { success: false, error: "Invalid invitation ID" }
    console.error("revokeInvitation error:", e)
    return { success: false, error: (e as Error).message }
  }
}

// ─── Accept Invitation ────────────────────────────────────────────────────────

export async function acceptInvitation(data: {
  token: string
  password: string
}): Promise<ActionResult<{ redirectUrl: string }>> {
  try {
    const parsed = acceptInvitationSchema.parse(data)

    // Verify token
    let payload: { purpose: string; invitationId: string; email: string; businessId: string }
    try {
      const result = await jwtVerify(parsed.token, SECRET)
      payload = result.payload as typeof payload
    } catch {
      return { success: false, error: "Invalid or expired invitation link" }
    }

    if (payload.purpose !== "staff-invite") {
      return { success: false, error: "Invalid invitation link" }
    }

    // Load invitation
    const invitation = await prisma.staffInvitation.findUnique({
      where: { id: payload.invitationId },
      include: { business: { select: { name: true } } },
    })

    if (!invitation) return { success: false, error: "Invitation not found" }
    if (invitation.revokedAt) return { success: false, error: "This invitation has been revoked" }
    if (invitation.acceptedAt) return { success: false, error: "This invitation has already been accepted" }
    if (invitation.expiresAt < new Date()) return { success: false, error: "This invitation has expired" }

    const passwordHash = await bcrypt.hash(parsed.password, 12)
    const email = invitation.email.toLowerCase().trim()

    await prisma.$transaction(async (tx) => {
      // 1. Find or create user
      let user = await tx.user.findUnique({ where: { email } })

      if (user) {
        if (!user.passwordHash) {
          // No password yet — set password and update role
          await tx.user.update({
            where: { id: user.id },
            data: { passwordHash, role: invitation.role, status: "active" },
          })
        } else {
          // Has password already — update role only
          await tx.user.update({
            where: { id: user.id },
            data: { role: invitation.role },
          })
        }
      } else {
        user = await tx.user.create({
          data: {
            email,
            passwordHash,
            firstName: invitation.firstName,
            lastName: invitation.lastName,
            role: invitation.role,
            status: "active",
          },
        })
      }

      // 2. Find or create staff profile
      const location = await tx.location.findFirst({
        where: { businessId: invitation.businessId },
      })
      if (!location) throw new Error("Business has no location configured")

      const existingStaff = await tx.staff.findFirst({
        where: { userId: user.id, locationId: location.id },
      })

      if (existingStaff) {
        await tx.staff.update({
          where: { id: existingStaff.id },
          data: { isActive: true, deletedAt: null },
        })
      } else {
        await tx.staff.create({
          data: {
            userId: user.id,
            locationId: location.id,
            isActive: true,
          },
        })
      }

      // 3. Mark invitation accepted
      await tx.staffInvitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      })
    })

    return { success: true, data: { redirectUrl: "/login?invited=1" } }
  } catch (e) {
    if (e instanceof z.ZodError) return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    console.error("acceptInvitation error:", e)
    return { success: false, error: (e as Error).message }
  }
}

// ─── Update Team Member Role ──────────────────────────────────────────────────

export async function updateTeamMemberRole(data: {
  targetUserId: string
  newRole: "staff" | "admin"
}): Promise<ActionResult> {
  try {
    const parsed = updateTeamMemberRoleSchema.parse(data)
    const { businessId, userId } = await requireMinRole("owner")

    if (parsed.targetUserId === userId) {
      return { success: false, error: "You cannot change your own role" }
    }

    const targetUser = await prisma.user.findUnique({ where: { id: parsed.targetUserId } })
    if (!targetUser) return { success: false, error: "User not found" }
    if (targetUser.role === "owner") return { success: false, error: "Cannot change another owner's role" }

    // Verify user has a staff profile in this business
    const staffProfile = await prisma.staff.findFirst({
      where: { userId: parsed.targetUserId, primaryLocation: { businessId } },
    })
    if (!staffProfile) return { success: false, error: "User is not a member of this business" }

    await prisma.user.update({
      where: { id: parsed.targetUserId },
      data: { role: parsed.newRole },
    })

    revalidatePath("/settings")
    return { success: true, data: undefined }
  } catch (e) {
    if (e instanceof z.ZodError) return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    console.error("updateTeamMemberRole error:", e)
    return { success: false, error: (e as Error).message }
  }
}

// ─── Remove Team Member ───────────────────────────────────────────────────────

export async function removeTeamMember(targetUserId: string): Promise<ActionResult> {
  try {
    z.string().uuid().parse(targetUserId)
    const { businessId, userId, role: callerRole } = await requireMinRole("admin")

    if (targetUserId === userId) {
      return { success: false, error: "You cannot remove yourself" }
    }

    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } })
    if (!targetUser) return { success: false, error: "User not found" }

    // Admins can only remove staff-role users; owners can remove anyone (not self, handled above)
    if (callerRole === "admin" && targetUser.role !== "staff") {
      return { success: false, error: "Admins can only remove staff-role members" }
    }

    // Verify user has a staff profile in this business
    const staffProfile = await prisma.staff.findFirst({
      where: { userId: targetUserId, primaryLocation: { businessId }, isActive: true },
    })
    if (!staffProfile) return { success: false, error: "User is not an active member of this business" }

    await prisma.staff.update({
      where: { id: staffProfile.id },
      data: { isActive: false, deletedAt: new Date() },
    })

    revalidatePath("/settings")
    return { success: true, data: undefined }
  } catch (e) {
    if (e instanceof z.ZodError) return { success: false, error: "Invalid user ID" }
    console.error("removeTeamMember error:", e)
    return { success: false, error: (e as Error).message }
  }
}
