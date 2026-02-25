import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { type ApiContext } from "@/lib/api/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

function isAdmin(ctx: ApiContext): boolean { return ["admin", "owner"].includes(ctx.role) }
function ok(data: unknown) { return { content: [{ type: "text" as const, text: JSON.stringify(data) }] } }
function err(message: string) { return { content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }], isError: true as const } }

export function registerMembershipTools(server: McpServer, ctx: ApiContext) {
  // Plans
  server.tool("list-membership-plans", "List membership plans (admin required)", {}, async () => {
    if (!isAdmin(ctx)) return err("Insufficient permissions")
    const plans = await prisma.membershipPlan.findMany({
      where: { businessId: ctx.businessId },
      orderBy: { price: "asc" },
    })
    return ok(plans)
  })

  server.tool(
    "create-membership-plan",
    "Create a membership plan (admin required). Billing cycles: monthly, quarterly, yearly, one_time",
    {
      name: z.string().min(1).describe("Plan name"),
      description: z.string().optional().describe("Plan description"),
      price: z.number().nonnegative().describe("Price per billing cycle"),
      billingCycle: z.enum(["monthly", "quarterly", "yearly", "one_time"]).describe("Billing frequency"),
      sessionsIncluded: z.number().int().nonnegative().optional().describe("Number of sessions included per cycle"),
      discountPercent: z.number().nonnegative().max(100).optional().describe("Discount % on additional services"),
    },
    async ({ name, description, price, billingCycle, sessionsIncluded, discountPercent }) => {
      if (!isAdmin(ctx)) return err("Insufficient permissions")
      const plan = await prisma.membershipPlan.create({
        data: {
          businessId: ctx.businessId,
          name,
          description,
          price,
          billingCycle,
          sessionsIncluded,
          discountPercent,
          isActive: true,
        },
      })
      return ok(plan)
    }
  )

  server.tool(
    "update-membership-plan",
    "Update a membership plan (admin required)",
    {
      id: z.string().uuid().describe("Plan ID"),
      name: z.string().optional(),
      description: z.string().optional(),
      price: z.number().nonnegative().optional(),
      sessionsIncluded: z.number().int().nonnegative().optional(),
      discountPercent: z.number().nonnegative().max(100).optional(),
      isActive: z.boolean().optional(),
    },
    async ({ id, ...data }) => {
      if (!isAdmin(ctx)) return err("Insufficient permissions")
      const existing = await prisma.membershipPlan.findFirst({ where: { id, businessId: ctx.businessId } })
      if (!existing) return err("Plan not found")
      const plan = await prisma.membershipPlan.update({ where: { id }, data })
      return ok(plan)
    }
  )

  server.tool(
    "delete-membership-plan",
    "Delete a membership plan (admin required)",
    { id: z.string().uuid().describe("Plan ID") },
    async ({ id }) => {
      if (!isAdmin(ctx)) return err("Insufficient permissions")
      const existing = await prisma.membershipPlan.findFirst({ where: { id, businessId: ctx.businessId } })
      if (!existing) return err("Plan not found")
      await prisma.membershipPlan.delete({ where: { id } })
      return ok({ deleted: true })
    }
  )

  // Subscriptions
  server.tool("list-memberships", "List member subscriptions (admin required)", {}, async () => {
    if (!isAdmin(ctx)) return err("Insufficient permissions")
    const memberships = await prisma.membership.findMany({
      where: { plan: { businessId: ctx.businessId } },
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        plan: { select: { id: true, name: true, price: true } },
      },
      orderBy: { startDate: "desc" },
    })
    return ok(memberships)
  })

  server.tool(
    "create-membership",
    "Enroll a client in a membership plan",
    {
      clientId: z.string().uuid().describe("Client ID"),
      planId: z.string().uuid().describe("Membership plan ID"),
      startDate: z.string().optional().describe("Start date (ISO 8601, defaults to today)"),
    },
    async ({ clientId, planId, startDate }) => {
      const plan = await prisma.membershipPlan.findFirst({ where: { id: planId, businessId: ctx.businessId } })
      if (!plan) return err("Plan not found")
      const client = await prisma.client.findFirst({ where: { id: clientId, businessId: ctx.businessId } })
      if (!client) return err("Client not found")

      const start = startDate ? new Date(startDate) : new Date()
      const membership = await prisma.membership.create({
        data: {
          clientId,
          planId,
          status: "active_membership",
          startDate: start,
        },
      })
      return ok(membership)
    }
  )

  server.tool(
    "update-membership",
    "Cancel, pause, or resume a membership (admin required). Action: cancel, pause, or resume",
    {
      id: z.string().uuid().describe("Membership ID"),
      action: z.enum(["cancel", "pause", "resume"]).describe("Action to perform"),
    },
    async ({ id, action }) => {
      if (!isAdmin(ctx)) return err("Insufficient permissions")
      const membership = await prisma.membership.findFirst({
        where: { id, plan: { businessId: ctx.businessId } },
      })
      if (!membership) return err("Membership not found")

      const statusMap = {
        cancel: "cancelled_membership",
        pause: "paused_membership",
        resume: "active_membership",
      } as const

      const updated = await prisma.membership.update({
        where: { id },
        data: {
          status: statusMap[action],
          ...(action === "cancel" ? { cancelledAt: new Date(), endDate: new Date() } : {}),
          ...(action === "pause" ? { pausedAt: new Date() } : {}),
        },
      })
      return ok(updated)
    }
  )
}
