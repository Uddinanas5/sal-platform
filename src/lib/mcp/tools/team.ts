import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { type ApiContext } from "@/lib/api/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { SignJWT } from "jose"

function isAdmin(ctx: ApiContext): boolean { return ["admin", "owner"].includes(ctx.role) }
function isOwner(ctx: ApiContext): boolean { return ctx.role === "owner" }
function ok(data: unknown) { return { content: [{ type: "text" as const, text: JSON.stringify(data) }] } }
function err(message: string) { return { content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }], isError: true as const } }

const INVITE_TTL_HOURS = 72

function getInviteSecret(): Uint8Array {
  if (!process.env.NEXTAUTH_SECRET) {
    throw new Error("NEXTAUTH_SECRET is required to create invitations")
  }
  return new TextEncoder().encode(process.env.NEXTAUTH_SECRET)
}

export function registerTeamTools(server: McpServer, ctx: ApiContext) {
  server.tool("list-team", "List active team members (admin required)", {}, async () => {
    if (!isAdmin(ctx)) return err("Insufficient permissions")
    // Get users who have active staff records in this business
    const staffRecords = await prisma.staff.findMany({
      where: { primaryLocation: { businessId: ctx.businessId }, isActive: true, deletedAt: null },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, role: true, phone: true } },
      },
    })
    return ok(staffRecords.map((s) => s.user))
  })

  server.tool(
    "remove-team-member",
    "Remove a team member from the business (admin required)",
    { userId: z.string().uuid().describe("User ID of the team member") },
    async ({ userId }) => {
      if (!isAdmin(ctx)) return err("Insufficient permissions")
      if (userId === ctx.userId) return err("Cannot remove yourself")
      await prisma.staff.updateMany({
        where: { userId, primaryLocation: { businessId: ctx.businessId } },
        data: { isActive: false, deletedAt: new Date() },
      })
      return ok({ removed: true })
    }
  )

  server.tool(
    "update-team-member-role",
    "Update a team member's role (owner only). Roles: staff, admin",
    {
      targetUserId: z.string().uuid().describe("User ID of the team member"),
      // Mirror the REST team route: owner is NOT assignable via the API surface.
      newRole: z.enum(["staff", "admin"]).describe("New role to assign"),
    },
    async ({ targetUserId, newRole }) => {
      if (!isOwner(ctx)) return err("Insufficient permissions: owner only")
      if (targetUserId === ctx.userId) return err("Cannot change your own role")
      const targetStaff = await prisma.staff.findFirst({
        where: { userId: targetUserId, primaryLocation: { businessId: ctx.businessId }, isActive: true },
        include: { user: { select: { role: true } } },
      })
      if (!targetStaff) return err("Team member not found")
      // Same guard as the REST route: cannot change another owner's role.
      if (targetStaff.user.role === "owner") return err("Cannot change another owner's role")
      await prisma.user.update({ where: { id: targetUserId }, data: { role: newRole } })
      return ok({ userId: targetUserId, newRole })
    }
  )

  server.tool("list-invitations", "List pending staff invitations (admin required)", {}, async () => {
    if (!isAdmin(ctx)) return err("Insufficient permissions")
    const invitations = await prisma.staffInvitation.findMany({
      where: { businessId: ctx.businessId, acceptedAt: null, revokedAt: null, expiresAt: { gte: new Date() } },
      orderBy: { createdAt: "desc" },
    })
    return ok(invitations)
  })

  server.tool(
    "invite-team-member",
    "Send an invitation to a new staff member (admin required). Roles: staff, admin",
    {
      email: z.string().email().describe("Invitee email address"),
      firstName: z.string().min(1).describe("Invitee first name"),
      lastName: z.string().min(1).describe("Invitee last name"),
      role: z.enum(["staff", "admin"]).describe("Role to assign"),
    },
    async ({ email, firstName, lastName, role }) => {
      if (!isAdmin(ctx)) return err("Insufficient permissions")
      if (role === "admin" && !isOwner(ctx)) return err("Only the owner can invite admins")

      const normalizedEmail = email.toLowerCase().trim()
      const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } })
      if (existing) return err("A user with this email already exists")

      const pendingInvitation = await prisma.staffInvitation.findFirst({
        where: { email: normalizedEmail, businessId: ctx.businessId, acceptedAt: null, revokedAt: null, expiresAt: { gte: new Date() } },
      })
      if (pendingInvitation) return err("An invitation is already pending for this email")

      const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000)

      const invitation = await prisma.staffInvitation.create({
        data: {
          businessId: ctx.businessId,
          email: normalizedEmail,
          firstName,
          lastName,
          role,
          invitedById: ctx.userId,
          expiresAt,
        },
      })

      // Generate token for the invitation link
      const token = await new SignJWT({
        purpose: "staff-invite",
        invitationId: invitation.id,
        email: normalizedEmail,
        businessId: ctx.businessId,
      })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime(`${INVITE_TTL_HOURS}h`)
        .sign(getInviteSecret())

      const acceptUrl = `${process.env.NEXTAUTH_URL ?? ""}/accept-invitation?token=${token}`
      return ok({ id: invitation.id, email: normalizedEmail, firstName, lastName, role, acceptUrl })
    }
  )

  server.tool(
    "revoke-invitation",
    "Revoke a pending staff invitation (admin required)",
    { id: z.string().uuid().describe("Invitation ID") },
    async ({ id }) => {
      if (!isAdmin(ctx)) return err("Insufficient permissions")
      const invitation = await prisma.staffInvitation.findFirst({ where: { id, businessId: ctx.businessId } })
      if (!invitation) return err("Invitation not found")
      await prisma.staffInvitation.update({ where: { id }, data: { revokedAt: new Date() } })
      return ok({ revoked: true })
    }
  )
}
