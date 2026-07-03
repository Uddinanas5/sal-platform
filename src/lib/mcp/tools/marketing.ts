import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { type ApiContext } from "@/lib/api/auth"
import { prisma } from "@/lib/prisma"
import { sendCampaignCore } from "@/lib/marketing/send-core"
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
    "Send/launch a marketing campaign — actually emails the consented audience (admin required)",
    { id: z.string().uuid().describe("Campaign ID") },
    async ({ id }) => {
      if (!isAdmin(ctx)) return err("Insufficient permissions")
      // Drive the SAME real send as the dashboard: consent-first audience, safety
      // cap, batched send, status:"sent" + recipientCount. Previously this tool
      // only flipped status→"sending" and returned ok() — emailing nobody and
      // bricking the campaign in "sending" forever.
      const result = await sendCampaignCore(ctx.businessId, id)
      if (!result.success) return err(result.error)
      return ok({ sent: result.sent, recipientCount: result.recipientCount, campaignId: result.campaign.id })
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
