import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { type ApiContext } from "@/lib/api/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

function isAdmin(ctx: ApiContext): boolean { return ["admin", "owner"].includes(ctx.role) }
function ok(data: unknown) { return { content: [{ type: "text" as const, text: JSON.stringify(data) }] } }
function err(message: string) { return { content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }], isError: true as const } }

export function registerResourceTools(server: McpServer, ctx: ApiContext) {
  server.tool("list-resources", "List bookable resources (rooms, equipment) (admin required)", {}, async () => {
    if (!isAdmin(ctx)) return err("Insufficient permissions")
    const resources = await prisma.resource.findMany({
      where: { businessId: ctx.businessId },
      orderBy: { name: "asc" },
    })
    return ok(resources)
  })

  server.tool(
    "create-resource",
    "Create a bookable resource (admin required)",
    {
      name: z.string().min(1).describe("Resource name"),
      type: z.string().min(1).describe("Resource type (e.g. room, equipment)"),
      description: z.string().optional().describe("Resource description"),
      capacity: z.number().int().positive().optional().describe("Maximum capacity"),
    },
    async ({ name, type, description, capacity }) => {
      if (!isAdmin(ctx)) return err("Insufficient permissions")
      const location = await prisma.location.findFirst({ where: { businessId: ctx.businessId } })
      if (!location) return err("Business not configured")
      const resource = await prisma.resource.create({
        data: { businessId: ctx.businessId, locationId: location.id, name, type, description, capacity: capacity ?? 1, isActive: true },
      })
      return ok(resource)
    }
  )

  server.tool(
    "update-resource",
    "Update a resource (admin required)",
    {
      id: z.string().uuid().describe("Resource ID"),
      name: z.string().optional(),
      type: z.string().optional(),
      description: z.string().optional(),
      capacity: z.number().int().positive().optional(),
      isActive: z.boolean().optional(),
    },
    async ({ id, ...data }) => {
      if (!isAdmin(ctx)) return err("Insufficient permissions")
      const existing = await prisma.resource.findFirst({ where: { id, businessId: ctx.businessId } })
      if (!existing) return err("Resource not found")
      const resource = await prisma.resource.update({ where: { id }, data })
      return ok(resource)
    }
  )

  server.tool(
    "delete-resource",
    "Delete a resource (admin required)",
    { id: z.string().uuid().describe("Resource ID") },
    async ({ id }) => {
      if (!isAdmin(ctx)) return err("Insufficient permissions")
      const existing = await prisma.resource.findFirst({ where: { id, businessId: ctx.businessId } })
      if (!existing) return err("Resource not found")
      await prisma.resource.delete({ where: { id } })
      return ok({ deleted: true })
    }
  )
}
