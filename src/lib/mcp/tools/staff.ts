import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { type ApiContext } from "@/lib/api/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

function isAdmin(ctx: ApiContext): boolean {
  return ["admin", "owner"].includes(ctx.role)
}

function ok(data: unknown) { return { content: [{ type: "text" as const, text: JSON.stringify(data) }] } }
function err(message: string) { return { content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }], isError: true as const } }

export function registerStaffTools(server: McpServer, ctx: ApiContext) {
  server.tool(
    "list-staff",
    "List all active staff members",
    {},
    async () => {
      const staff = await prisma.staff.findMany({
        where: { primaryLocation: { businessId: ctx.businessId }, isActive: true, deletedAt: null },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, role: true } },
          staffServices: { include: { service: { select: { id: true, name: true } } } },
        },
        orderBy: { user: { firstName: "asc" } },
      })
      return ok(staff)
    }
  )

  server.tool(
    "get-staff-member",
    "Get a staff member's full details including schedule and services",
    { id: z.string().uuid().describe("Staff ID") },
    async ({ id }) => {
      const staff = await prisma.staff.findFirst({
        where: { id, primaryLocation: { businessId: ctx.businessId }, isActive: true },
        include: {
          user: true,
          staffSchedules: true,
          timeOff: { where: { startDate: { gte: new Date() } }, orderBy: { startDate: "asc" } },
          staffServices: { include: { service: { select: { id: true, name: true } } } },
        },
      })
      if (!staff) return err("Staff member not found")
      return ok(staff)
    }
  )

  server.tool(
    "create-staff",
    "Create a new staff member account (admin or owner required)",
    {
      firstName: z.string().min(1).describe("First name"),
      lastName: z.string().min(1).describe("Last name"),
      email: z.string().email().describe("Email address"),
      phone: z.string().optional().describe("Phone number"),
      role: z.string().min(1).describe("Job title/role"),
      serviceIds: z.array(z.string().uuid()).optional().describe("Services this staff member provides"),
    },
    async ({ firstName, lastName, email, phone, role, serviceIds = [] }) => {
      if (!isAdmin(ctx)) return err("Insufficient permissions: admin or owner required")

      const location = await prisma.location.findFirst({ where: { businessId: ctx.businessId } })
      if (!location) return err("Business not configured (no location)")

      const existingUser = await prisma.user.findUnique({ where: { email } })
      if (existingUser) return err("A user with this email already exists")

      const user = await prisma.user.create({
        data: { email, firstName, lastName, phone, role: "staff" },
      })

      const staff = await prisma.staff.create({
        data: { userId: user.id, locationId: location.id, title: role, isActive: true },
      })

      if (serviceIds.length > 0) {
        await prisma.staffService.createMany({
          data: serviceIds.map((serviceId) => ({ staffId: staff.id, serviceId })),
        })
      }

      return ok({ id: staff.id, userId: user.id, email, firstName, lastName })
    }
  )

  server.tool(
    "delete-staff",
    "Deactivate a staff member (admin or owner required)",
    { id: z.string().uuid().describe("Staff ID") },
    async ({ id }) => {
      if (!isAdmin(ctx)) return err("Insufficient permissions: admin or owner required")
      const staff = await prisma.staff.findFirst({ where: { id, primaryLocation: { businessId: ctx.businessId } } })
      if (!staff) return err("Staff member not found")
      await prisma.staff.update({ where: { id }, data: { isActive: false, deletedAt: new Date() } })
      return ok({ deleted: true })
    }
  )

  server.tool(
    "update-staff-schedule",
    "Update a staff member's weekly work schedule (admin or owner required)",
    {
      staffId: z.string().uuid().describe("Staff ID"),
      schedule: z.array(
        z.object({
          dayOfWeek: z.number().int().min(0).max(6).describe("Day of week (0=Sunday, 6=Saturday)"),
          startTime: z.string().describe("Start time (HH:MM)"),
          endTime: z.string().describe("End time (HH:MM)"),
          isWorking: z.boolean().describe("Whether staff works on this day"),
        })
      ).describe("Weekly schedule entries"),
    },
    async ({ staffId, schedule }) => {
      if (!isAdmin(ctx)) return err("Insufficient permissions: admin or owner required")
      const staff = await prisma.staff.findFirst({ where: { id: staffId, primaryLocation: { businessId: ctx.businessId } } })
      if (!staff) return err("Staff member not found")

      const location = await prisma.location.findFirst({ where: { businessId: ctx.businessId } })
      if (!location) return err("Business not configured")

      await prisma.staffSchedule.deleteMany({ where: { staffId } })

      if (schedule.length > 0) {
        await prisma.staffSchedule.createMany({
          data: schedule.map((s) => ({
            staffId,
            locationId: location.id,
            dayOfWeek: s.dayOfWeek,
            startTime: new Date(`1970-01-01T${s.startTime}`),
            endTime: new Date(`1970-01-01T${s.endTime}`),
            isWorking: s.isWorking,
          })),
        })
      }

      const updated = await prisma.staffSchedule.findMany({ where: { staffId } })
      return ok(updated)
    }
  )

  server.tool(
    "request-time-off",
    "Request time off for a staff member. Type values: vacation, sick, personal, other",
    {
      staffId: z.string().uuid().describe("Staff ID"),
      startDate: z.string().describe("Start date (ISO 8601)"),
      endDate: z.string().describe("End date (ISO 8601)"),
      type: z.enum(["vacation", "sick", "personal", "other"]).describe("Type of time off"),
      notes: z.string().optional().describe("Notes or reason"),
    },
    async ({ staffId, startDate, endDate, type, notes }) => {
      const staff = await prisma.staff.findFirst({ where: { id: staffId, primaryLocation: { businessId: ctx.businessId } } })
      if (!staff) return err("Staff member not found")
      const timeOff = await prisma.staffTimeOff.create({
        data: {
          staffId,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          type,
          status: "approved",
          notes,
        },
      })
      return ok(timeOff)
    }
  )
}
