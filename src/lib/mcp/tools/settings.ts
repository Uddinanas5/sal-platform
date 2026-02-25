import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { type ApiContext } from "@/lib/api/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

function isAdmin(ctx: ApiContext): boolean { return ["admin", "owner"].includes(ctx.role) }
function ok(data: unknown) { return { content: [{ type: "text" as const, text: JSON.stringify(data) }] } }
function err(message: string) { return { content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }], isError: true as const } }

export function registerSettingsTools(server: McpServer, ctx: ApiContext) {
  server.tool("get-settings", "Get business settings and profile (admin required)", {}, async () => {
    if (!isAdmin(ctx)) return err("Insufficient permissions")
    const business = await prisma.business.findUnique({
      where: { id: ctx.businessId },
      include: {
        locations: {
          include: { businessHours: { orderBy: { dayOfWeek: "asc" } } },
        },
      },
    })
    if (!business) return err("Business not found")
    return ok(business)
  })

  server.tool(
    "update-settings",
    "Update business settings and profile (admin required)",
    {
      name: z.string().min(1).optional().describe("Business name"),
      phone: z.string().optional().describe("Business phone number"),
      email: z.string().email().optional().describe("Business contact email"),
      website: z.string().url().optional().describe("Business website URL"),
      description: z.string().optional().describe("Business description"),
      timezone: z.string().optional().describe("Business timezone (e.g. America/New_York)"),
    },
    async (data) => {
      if (!isAdmin(ctx)) return err("Insufficient permissions")
      const cleanData: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined) cleanData[key] = value
      }
      const business = await prisma.business.update({ where: { id: ctx.businessId }, data: cleanData })
      return ok(business)
    }
  )
}
