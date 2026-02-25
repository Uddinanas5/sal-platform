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

export function registerClientTools(server: McpServer, ctx: ApiContext) {
  server.tool(
    "list-clients",
    "List all clients for the business with optional search and pagination",
    {
      search: z.string().optional().describe("Search by name, email, or phone"),
      page: z.number().int().positive().optional().describe("Page number (default 1)"),
      limit: z.number().int().positive().max(100).optional().describe("Results per page (default 20, max 100)"),
    },
    async ({ search, page = 1, limit = 20 }) => {
      const where = {
        businessId: ctx.businessId,
        ...(search
          ? {
              OR: [
                { firstName: { contains: search, mode: "insensitive" as const } },
                { lastName: { contains: search, mode: "insensitive" as const } },
                { email: { contains: search, mode: "insensitive" as const } },
                { phone: { contains: search, mode: "insensitive" as const } },
              ],
            }
          : {}),
      }
      const [clients, total] = await Promise.all([
        prisma.client.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { lastName: "asc" },
        }),
        prisma.client.count({ where }),
      ])
      return ok({ clients, total, page, limit })
    }
  )

  server.tool(
    "get-client",
    "Get a client by ID including appointment history",
    { id: z.string().uuid().describe("Client ID") },
    async ({ id }) => {
      const client = await prisma.client.findFirst({
        where: { id, businessId: ctx.businessId },
        include: {
          appointments: {
            orderBy: { startTime: "desc" },
            take: 10,
            include: { services: { include: { service: true } } },
          },
        },
      })
      if (!client) return err("Client not found")
      return ok(client)
    }
  )

  server.tool(
    "create-client",
    "Create a new client record",
    {
      firstName: z.string().min(1).describe("First name"),
      lastName: z.string().min(1).describe("Last name"),
      email: z.string().email().optional().describe("Email address"),
      phone: z.string().optional().describe("Phone number"),
      notes: z.string().optional().describe("Internal notes"),
      tags: z.array(z.string()).optional().describe("Tags for categorization"),
    },
    async ({ firstName, lastName, email, phone, notes, tags }) => {
      const client = await prisma.client.create({
        data: {
          businessId: ctx.businessId,
          firstName,
          lastName,
          email,
          phone,
          notes,
          tags: tags ?? [],
        },
      })
      return ok(client)
    }
  )

  server.tool(
    "update-client",
    "Update an existing client's information",
    {
      id: z.string().uuid().describe("Client ID"),
      firstName: z.string().min(1).optional(),
      lastName: z.string().min(1).optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      notes: z.string().optional(),
      tags: z.array(z.string()).optional(),
    },
    async ({ id, ...data }) => {
      const existing = await prisma.client.findFirst({ where: { id, businessId: ctx.businessId } })
      if (!existing) return err("Client not found")
      const client = await prisma.client.update({ where: { id }, data })
      return ok(client)
    }
  )

  server.tool(
    "delete-client",
    "Delete a client record (admin or owner required)",
    { id: z.string().uuid().describe("Client ID") },
    async ({ id }) => {
      if (!isAdmin(ctx)) return err("Insufficient permissions: admin or owner required")
      const existing = await prisma.client.findFirst({ where: { id, businessId: ctx.businessId } })
      if (!existing) return err("Client not found")
      await prisma.client.delete({ where: { id } })
      return ok({ deleted: true })
    }
  )
}
