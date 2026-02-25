import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { type ApiContext } from "@/lib/api/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { SignJWT } from "jose"

function isAdmin(ctx: ApiContext): boolean { return ["admin", "owner"].includes(ctx.role) }
function isOwner(ctx: ApiContext): boolean { return ctx.role === "owner" }
function ok(data: unknown) { return { content: [{ type: "text" as const, text: JSON.stringify(data) }] } }
function err(message: string) { return { content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }], isError: true as const } }

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
    "Update a team member's role (owner only). Roles: staff, admin, owner",
    {
      targetUserId: z.string().uuid().describe("User ID of the team member"),
      newRole: z.enum(["staff", "admin", "owner"]).describe("New role to assign"),
    },
    async ({ targetUserId, newRole }) => {
      if (!isOwner(ctx)) return err("Insufficient permissions: owner only")
      if (targetUserId === ctx.userId) return err("Cannot change your own role")
      const targetStaff = await prisma.staff.findFirst({
        where: { userId: targetUserId, primaryLocation: { businessId: ctx.businessId }, isActive: true },
      })
      if (!targetStaff) return err("Team member not found")
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

      const existing = await prisma.user.findUnique({ where: { email } })
      if (existing) return err("A user with this email already exists")

      const pendingInvitation = await prisma.staffInvitation.findFirst({
        where: { email, businessId: ctx.businessId, acceptedAt: null, revokedAt: null, expiresAt: { gte: new Date() } },
      })
      if (pendingInvitation) return err("An invitation is already pending for this email")

      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

      const invitation = await prisma.staffInvitation.create({
        data: {
          businessId: ctx.businessId,
          email,
          firstName,
          lastName,
          role,
          invitedById: ctx.userId,
          expiresAt,
        },
      })

      // Generate token for the invitation link
      const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET ?? "secret")
      const token = await new SignJWT({ invitationId: invitation.id, email, businessId: ctx.businessId, role })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("7d")
        .sign(secret)

      const acceptUrl = `${process.env.NEXTAUTH_URL ?? ""}/accept-invitation?token=${token}`
      return ok({ id: invitation.id, email, firstName, lastName, role, acceptUrl })
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
