import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { type ApiContext } from "@/lib/api/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

function isAdmin(ctx: ApiContext): boolean { return ["admin", "owner"].includes(ctx.role) }
function ok(data: unknown) { return { content: [{ type: "text" as const, text: JSON.stringify(data) }] } }
function err(message: string) { return { content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }], isError: true as const } }

export function registerMarketingTools(server: McpServer, ctx: ApiContext) {
  // Campaigns
  server.tool("list-campaigns", "List email/SMS marketing campaigns (admin required)", {}, async () => {
    if (!isAdmin(ctx)) return err("Insufficient permissions")
    const campaigns = await prisma.campaign.findMany({
      where: { businessId: ctx.businessId },
      orderBy: { createdAt: "desc" },
    })
    return ok(campaigns)
  })

  server.tool(
    "create-campaign",
    "Create a marketing campaign (admin required)",
    {
      name: z.string().min(1).describe("Campaign name"),
      subject: z.string().optional().describe("Email subject line"),
      body: z.string().min(1).describe("Campaign content/body"),
      channel: z.enum(["email", "sms", "both"]).describe("Channel type"),
      audienceType: z.string().optional().describe("Audience type (e.g. all, recent, inactive)"),
    },
    async ({ name, subject, body, channel, audienceType }) => {
      if (!isAdmin(ctx)) return err("Insufficient permissions")
      const campaign = await prisma.campaign.create({
        data: {
          businessId: ctx.businessId,
          name,
          subject,
          body,
          channel,
          status: "draft",
          audienceType: audienceType ?? "all",
        },
      })
      return ok(campaign)
    }
  )

  server.tool(
    "update-campaign",
    "Update a marketing campaign (admin required)",
    {
      id: z.string().uuid().describe("Campaign ID"),
      name: z.string().optional(),
      subject: z.string().optional(),
      body: z.string().optional(),
      audienceType: z.string().optional(),
    },
    async ({ id, ...data }) => {
      if (!isAdmin(ctx)) return err("Insufficient permissions")
      const existing = await prisma.campaign.findFirst({ where: { id, businessId: ctx.businessId } })
      if (!existing) return err("Campaign not found")
      const campaign = await prisma.campaign.update({ where: { id }, data })
      return ok(campaign)
    }
  )

  server.tool(
    "delete-campaign",
    "Delete a marketing campaign (admin required)",
    { id: z.string().uuid().describe("Campaign ID") },
    async ({ id }) => {
      if (!isAdmin(ctx)) return err("Insufficient permissions")
      const existing = await prisma.campaign.findFirst({ where: { id, businessId: ctx.businessId } })
      if (!existing) return err("Campaign not found")
      await prisma.campaign.delete({ where: { id } })
      return ok({ deleted: true })
    }
  )

  server.tool(
    "send-campaign",
    "Send/launch a marketing campaign (admin required)",
    { id: z.string().uuid().describe("Campaign ID") },
    async ({ id }) => {
      if (!isAdmin(ctx)) return err("Insufficient permissions")
      const campaign = await prisma.campaign.findFirst({ where: { id, businessId: ctx.businessId } })
      if (!campaign) return err("Campaign not found")
      const updated = await prisma.campaign.update({
        where: { id },
        data: { status: "sending", sentAt: new Date() },
      })
      return ok(updated)
    }
  )

  // Deals
  server.tool("list-deals", "List promotional deals/discounts (admin required)", {}, async () => {
    if (!isAdmin(ctx)) return err("Insufficient permissions")
    const deals = await prisma.deal.findMany({
      where: { businessId: ctx.businessId },
      orderBy: { createdAt: "desc" },
    })
    return ok(deals)
  })

  server.tool(
    "create-deal",
    "Create a promotional deal (admin required)",
    {
      name: z.string().min(1).describe("Deal name"),
      description: z.string().optional().describe("Deal description"),
      discountType: z.enum(["percentage", "fixed"]).describe("Discount type (percentage or fixed amount)"),
      discountValue: z.number().positive().describe("Discount amount (% or $)"),
      validFrom: z.string().describe("Deal start date (ISO 8601)"),
      validUntil: z.string().describe("Deal end date (ISO 8601)"),
      code: z.string().optional().describe("Promo code (optional)"),
    },
    async ({ name, description, discountType, discountValue, validFrom, validUntil, code }) => {
      if (!isAdmin(ctx)) return err("Insufficient permissions")
      const deal = await prisma.deal.create({
        data: {
          businessId: ctx.businessId,
          name,
          description,
          discountType,
          discountValue,
          validFrom: new Date(validFrom),
          validUntil: new Date(validUntil),
          code,
          status: "active_deal",
        },
      })
      return ok(deal)
    }
  )

  server.tool(
    "delete-deal",
    "Delete a promotional deal (admin required)",
    { id: z.string().uuid().describe("Deal ID") },
    async ({ id }) => {
      if (!isAdmin(ctx)) return err("Insufficient permissions")
      const existing = await prisma.deal.findFirst({ where: { id, businessId: ctx.businessId } })
      if (!existing) return err("Deal not found")
      await prisma.deal.delete({ where: { id } })
      return ok({ deleted: true })
    }
  )

  // Automated messages
  server.tool("list-automated-messages", "List automated message rules (admin required)", {}, async () => {
    if (!isAdmin(ctx)) return err("Insufficient permissions")
    const messages = await prisma.automatedMessage.findMany({
      where: { businessId: ctx.businessId },
      orderBy: { createdAt: "desc" },
    })
    return ok(messages)
  })

  server.tool(
    "create-automated-message",
    "Create an automated message rule (admin required). Trigger values: booking_confirmation, appointment_reminder, thank_you, no_show_followup, birthday, rebooking_reminder, win_back, welcome, review_request",
    {
      name: z.string().min(1).describe("Rule name"),
      trigger: z.enum([
        "booking_confirmation", "appointment_reminder", "thank_you", "no_show_followup",
        "birthday", "rebooking_reminder", "win_back", "welcome", "review_request",
      ]).describe("Trigger event"),
      channel: z.enum(["email", "sms", "both"]).describe("Message channel"),
      subject: z.string().optional().describe("Email subject"),
      body: z.string().min(1).describe("Message content"),
      delayHours: z.number().int().describe("Hours delay before/after trigger (0 = immediate)"),
    },
    async ({ name, trigger, channel, subject, body, delayHours }) => {
      if (!isAdmin(ctx)) return err("Insufficient permissions")
      const message = await prisma.automatedMessage.create({
        data: { businessId: ctx.businessId, name, trigger, channel, subject, body, delayHours, isActive: true },
      })
      return ok(message)
    }
  )

  server.tool(
    "toggle-automated-message",
    "Enable or disable an automated message rule (admin required)",
    {
      id: z.string().uuid().describe("Automated message ID"),
      isActive: z.boolean().describe("Whether to enable or disable"),
    },
    async ({ id, isActive }) => {
      if (!isAdmin(ctx)) return err("Insufficient permissions")
      const existing = await prisma.automatedMessage.findFirst({ where: { id, businessId: ctx.businessId } })
      if (!existing) return err("Automated message not found")
      const updated = await prisma.automatedMessage.update({ where: { id }, data: { isActive } })
      return ok(updated)
    }
  )

  server.tool(
    "delete-automated-message",
    "Delete an automated message rule (admin required)",
    { id: z.string().uuid().describe("Automated message ID") },
    async ({ id }) => {
      if (!isAdmin(ctx)) return err("Insufficient permissions")
      const existing = await prisma.automatedMessage.findFirst({ where: { id, businessId: ctx.businessId } })
      if (!existing) return err("Automated message not found")
      await prisma.automatedMessage.delete({ where: { id } })
      return ok({ deleted: true })
    }
  )
}
