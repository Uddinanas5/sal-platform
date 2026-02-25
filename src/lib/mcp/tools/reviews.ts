import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { type ApiContext } from "@/lib/api/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

function isAdmin(ctx: ApiContext): boolean { return ["admin", "owner"].includes(ctx.role) }
function ok(data: unknown) { return { content: [{ type: "text" as const, text: JSON.stringify(data) }] } }
function err(message: string) { return { content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }], isError: true as const } }

export function registerReviewTools(server: McpServer, ctx: ApiContext) {
  server.tool(
    "list-reviews",
    "List client reviews with optional filters (admin required)",
    {
      status: z.string().optional().describe("Filter by status (pending, published, hidden)"),
      rating: z.number().int().min(1).max(5).optional().describe("Filter by rating"),
      page: z.number().int().positive().optional().describe("Page number (default 1)"),
      limit: z.number().int().positive().max(100).optional().describe("Results per page (default 20)"),
    },
    async ({ status, rating, page = 1, limit = 20 }) => {
      if (!isAdmin(ctx)) return err("Insufficient permissions")
      const where = {
        businessId: ctx.businessId,
        ...(status ? { status } : {}),
        ...(rating ? { rating } : {}),
      }
      const [reviews, total] = await Promise.all([
        prisma.review.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          include: { client: { select: { id: true, firstName: true, lastName: true } } },
          orderBy: { createdAt: "desc" },
        }),
        prisma.review.count({ where }),
      ])
      return ok({ reviews, total, page, limit })
    }
  )

  server.tool(
    "respond-to-review",
    "Post a business response to a client review (admin required)",
    {
      id: z.string().uuid().describe("Review ID"),
      response: z.string().min(1).describe("Business response text"),
    },
    async ({ id, response }) => {
      if (!isAdmin(ctx)) return err("Insufficient permissions")
      const review = await prisma.review.findFirst({ where: { id, businessId: ctx.businessId } })
      if (!review) return err("Review not found")
      const updated = await prisma.review.update({
        where: { id },
        data: { response, respondedAt: new Date() },
      })
      return ok(updated)
    }
  )
}
