import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { type ApiContext } from "@/lib/api/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

function isAdmin(ctx: ApiContext): boolean { return ["admin", "owner"].includes(ctx.role) }
function ok(data: unknown) { return { content: [{ type: "text" as const, text: JSON.stringify(data) }] } }
function err(message: string) { return { content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }], isError: true as const } }

export function registerWaitlistTools(server: McpServer, ctx: ApiContext) {
  server.tool("list-waitlist", "List clients currently on the waitlist (admin required)", {}, async () => {
    if (!isAdmin(ctx)) return err("Insufficient permissions")
    const entries = await prisma.waitlistEntry.findMany({
      where: { businessId: ctx.businessId, status: "waiting" },
      orderBy: { createdAt: "asc" },
    })
    return ok(entries)
  })

  server.tool(
    "add-to-waitlist",
    "Add a client to the waitlist",
    {
      clientId: z.string().uuid().describe("Client ID"),
      serviceId: z.string().uuid().optional().describe("Desired service ID"),
      staffId: z.string().uuid().optional().describe("Preferred staff member ID"),
      preferredDate: z.string().optional().describe("Preferred date (ISO 8601)"),
      preferredTimeStart: z.string().optional().describe("Preferred start time (HH:MM)"),
      preferredTimeEnd: z.string().optional().describe("Preferred end time (HH:MM)"),
      notes: z.string().optional().describe("Notes"),
    },
    async ({ clientId, serviceId, staffId, preferredDate, preferredTimeStart, preferredTimeEnd, notes }) => {
      const entry = await prisma.waitlistEntry.create({
        data: {
          businessId: ctx.businessId,
          clientId,
          serviceId,
          staffId,
          preferredDate: preferredDate ? new Date(preferredDate) : undefined,
          preferredTimeStart: preferredTimeStart ? new Date(`1970-01-01T${preferredTimeStart}`) : undefined,
          preferredTimeEnd: preferredTimeEnd ? new Date(`1970-01-01T${preferredTimeEnd}`) : undefined,
          notes,
          status: "waiting",
        },
      })
      return ok(entry)
    }
  )

  server.tool(
    "remove-from-waitlist",
    "Remove a client from the waitlist (marks as cancelled)",
    { id: z.string().uuid().describe("Waitlist entry ID") },
    async ({ id }) => {
      const entry = await prisma.waitlistEntry.findFirst({ where: { id, businessId: ctx.businessId } })
      if (!entry) return err("Waitlist entry not found")
      await prisma.waitlistEntry.update({ where: { id }, data: { status: "cancelled_waitlist" } })
      return ok({ removed: true })
    }
  )

  server.tool(
    "notify-waitlist-client",
    "Mark a waitlist entry as notified (admin required)",
    { id: z.string().uuid().describe("Waitlist entry ID") },
    async ({ id }) => {
      if (!isAdmin(ctx)) return err("Insufficient permissions")
      const entry = await prisma.waitlistEntry.findFirst({ where: { id, businessId: ctx.businessId } })
      if (!entry) return err("Waitlist entry not found")
      const updated = await prisma.waitlistEntry.update({
        where: { id },
        data: { status: "notified" },
      })
      return ok(updated)
    }
  )

  server.tool(
    "book-from-waitlist",
    "Convert a waitlist entry into a booked appointment",
    {
      id: z.string().uuid().describe("Waitlist entry ID"),
      appointmentId: z.string().uuid().describe("ID of the appointment created for this client"),
    },
    async ({ id, appointmentId }) => {
      const entry = await prisma.waitlistEntry.findFirst({ where: { id, businessId: ctx.businessId } })
      if (!entry) return err("Waitlist entry not found")
      const updated = await prisma.waitlistEntry.update({
        where: { id },
        data: { status: "booked" },
      })
      return ok({ entry: updated, appointmentId })
    }
  )
}
