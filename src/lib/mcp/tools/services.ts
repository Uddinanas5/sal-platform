import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { type ApiContext } from "@/lib/api/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

function isAdmin(ctx: ApiContext): boolean {
  return ["admin", "owner"].includes(ctx.role)
}

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data) }] }
}

function err(message: string) {
  return { content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }], isError: true as const }
}

export function registerServiceTools(server: McpServer, ctx: ApiContext) {
  server.tool(
    "list-services",
    "List all services offered by the business",
    {
      activeOnly: z.boolean().optional().describe("Only return active services (default true)"),
    },
    async ({ activeOnly = true }) => {
      const services = await prisma.service.findMany({
        where: {
          businessId: ctx.businessId,
          ...(activeOnly ? { isActive: true } : {}),
        },
        include: { category: { select: { id: true, name: true } } },
        orderBy: { name: "asc" },
      })
      return ok(services)
    }
  )

  server.tool(
    "create-service",
    "Create a new service (admin or owner required)",
    {
      name: z.string().min(1).describe("Service name"),
      description: z.string().optional().describe("Service description"),
      duration: z.number().int().positive().describe("Duration in minutes"),
      price: z.number().nonnegative().describe("Price in dollars"),
      categoryId: z.string().uuid().optional().describe("Service category ID"),
      color: z.string().optional().describe("Color hex code for calendar display"),
    },
    async ({ name, description, duration, price, categoryId, color }) => {
      if (!isAdmin(ctx)) return err("Insufficient permissions: admin or owner required")
      const service = await prisma.service.create({
        data: {
          businessId: ctx.businessId,
          name,
          description,
          durationMinutes: duration,
          price,
          categoryId,
          color,
          isActive: true,
        },
      })
      return ok(service)
    }
  )

  server.tool(
    "update-service",
    "Update an existing service (admin or owner required)",
    {
      id: z.string().uuid().describe("Service ID"),
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      duration: z.number().int().positive().optional().describe("Duration in minutes"),
      price: z.number().nonnegative().optional(),
      categoryId: z.string().uuid().optional(),
      color: z.string().optional(),
    },
    async ({ id, duration, ...rest }) => {
      if (!isAdmin(ctx)) return err("Insufficient permissions: admin or owner required")
      const existing = await prisma.service.findFirst({ where: { id, businessId: ctx.businessId } })
      if (!existing) return err("Service not found")
      const data = { ...rest, ...(duration !== undefined ? { durationMinutes: duration } : {}) }
      const service = await prisma.service.update({ where: { id }, data })
      return ok(service)
    }
  )

  server.tool(
    "delete-service",
    "Delete a service (admin or owner required)",
    { id: z.string().uuid().describe("Service ID") },
    async ({ id }) => {
      if (!isAdmin(ctx)) return err("Insufficient permissions: admin or owner required")
      const existing = await prisma.service.findFirst({ where: { id, businessId: ctx.businessId } })
      if (!existing) return err("Service not found")
      await prisma.service.delete({ where: { id } })
      return ok({ deleted: true })
    }
  )

  server.tool(
    "toggle-service",
    "Toggle a service active/inactive (admin or owner required)",
    { id: z.string().uuid().describe("Service ID") },
    async ({ id }) => {
      if (!isAdmin(ctx)) return err("Insufficient permissions: admin or owner required")
      const existing = await prisma.service.findFirst({ where: { id, businessId: ctx.businessId } })
      if (!existing) return err("Service not found")
      const service = await prisma.service.update({ where: { id }, data: { isActive: !existing.isActive } })
      return ok({ id: service.id, isActive: service.isActive })
    }
  )
}
