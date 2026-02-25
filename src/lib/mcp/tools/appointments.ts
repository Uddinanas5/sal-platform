import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { type ApiContext } from "@/lib/api/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data) }] }
}

function err(message: string) {
  return { content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }], isError: true as const }
}

function genBookingRef(): string {
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).substring(2, 6)
  return `SAL-${ts}-${rand}`.toUpperCase()
}

export function registerAppointmentTools(server: McpServer, ctx: ApiContext) {
  server.tool(
    "list-appointments",
    "List appointments with optional filters for date range, staff, client, and status",
    {
      staffId: z.string().uuid().optional().describe("Filter by staff member ID"),
      clientId: z.string().uuid().optional().describe("Filter by client ID"),
      status: z.string().optional().describe("Filter by status (confirmed, completed, cancelled, no_show)"),
      dateFrom: z.string().optional().describe("Start date filter (ISO 8601)"),
      dateTo: z.string().optional().describe("End date filter (ISO 8601)"),
      page: z.number().int().positive().optional().describe("Page number (default 1)"),
      limit: z.number().int().positive().max(100).optional().describe("Results per page (default 20)"),
    },
    async ({ staffId, clientId, status, dateFrom, dateTo, page = 1, limit = 20 }) => {
      const where: Record<string, unknown> = { businessId: ctx.businessId }
      if (clientId) where.clientId = clientId
      if (status) where.status = status
      if (dateFrom || dateTo) {
        where.startTime = {
          ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
          ...(dateTo ? { lte: new Date(dateTo) } : {}),
        }
      }

      // Staff filter via services relation
      if (staffId) {
        where.services = { some: { staffId } }
      } else if (ctx.role === "staff") {
        const staffProfile = await prisma.staff.findFirst({ where: { userId: ctx.userId, isActive: true } })
        if (staffProfile) where.services = { some: { staffId: staffProfile.id } }
      }

      const [appointments, total] = await Promise.all([
        prisma.appointment.findMany({
          where: where as never,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { startTime: "desc" },
          include: {
            client: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
            services: {
              include: {
                service: { select: { id: true, name: true } },
                staff: { include: { user: { select: { firstName: true, lastName: true } } } },
              },
            },
          },
        }),
        prisma.appointment.count({ where: where as never }),
      ])
      return ok({ appointments, total, page, limit })
    }
  )

  server.tool(
    "create-appointment",
    "Create a new appointment for a client",
    {
      clientId: z.string().uuid().describe("Client ID"),
      serviceId: z.string().uuid().describe("Primary service ID"),
      staffId: z.string().uuid().describe("Staff member ID"),
      startTime: z.string().describe("Appointment start time (ISO 8601)"),
      notes: z.string().optional().describe("Appointment notes"),
    },
    async ({ clientId, serviceId, staffId, startTime, notes }) => {
      const [service, location] = await Promise.all([
        prisma.service.findFirst({ where: { id: serviceId, businessId: ctx.businessId } }),
        prisma.location.findFirst({ where: { businessId: ctx.businessId } }),
      ])
      if (!service) return err("Service not found")
      if (!location) return err("Business not configured")

      const start = new Date(startTime)
      const end = new Date(start.getTime() + service.durationMinutes * 60000)
      const price = Number(service.price)
      const taxRate = service.isTaxable && service.taxRate ? Number(service.taxRate) / 100 : 0
      const tax = Math.round(price * taxRate * 100) / 100

      try {
        const appointment = await prisma.$transaction(async (tx) => {
          const conflict = await tx.appointmentService.findFirst({
            where: {
              staffId,
              appointment: { status: { notIn: ["cancelled", "no_show"] } },
              startTime: { lt: end },
              endTime: { gt: start },
            },
          })
          if (conflict) throw new Error("CONFLICT")

          const appt = await tx.appointment.create({
            data: {
              businessId: ctx.businessId,
              locationId: location.id,
              clientId,
              bookingReference: genBookingRef(),
              status: "confirmed",
              source: "pos",
              startTime: start,
              endTime: end,
              totalDuration: service.durationMinutes,
              subtotal: price,
              taxAmount: tax,
              totalAmount: price + tax,
              notes,
            },
          })

          await tx.appointmentService.create({
            data: {
              appointmentId: appt.id,
              serviceId,
              staffId,
              name: service.name,
              durationMinutes: service.durationMinutes,
              price,
              finalPrice: price,
              startTime: start,
              endTime: end,
            },
          })

          return appt
        })
        return ok(appointment)
      } catch (e) {
        if ((e as Error).message === "CONFLICT") return err("Time slot already booked for this staff member")
        throw e
      }
    }
  )

  server.tool(
    "update-appointment-status",
    "Update the status of an appointment (confirmed, completed, cancelled, no_show, checked_in)",
    {
      id: z.string().uuid().describe("Appointment ID"),
      status: z.enum(["confirmed", "checked_in", "in_progress", "completed", "cancelled", "no_show"]).describe("New status"),
    },
    async ({ id, status }) => {
      const appointment = await prisma.appointment.findFirst({ where: { id, businessId: ctx.businessId } })
      if (!appointment) return err("Appointment not found")
      const updated = await prisma.appointment.update({
        where: { id },
        data: {
          status,
          ...(status === "completed" ? { completedAt: new Date() } : {}),
          ...(status === "cancelled" ? { cancelledAt: new Date() } : {}),
          ...(status === "no_show" ? { noShowAt: new Date() } : {}),
          ...(status === "checked_in" ? { checkedInAt: new Date() } : {}),
        },
      })
      return ok(updated)
    }
  )

  server.tool(
    "reschedule-appointment",
    "Reschedule an appointment to a new time",
    {
      id: z.string().uuid().describe("Appointment ID"),
      newStartTime: z.string().describe("New start time (ISO 8601)"),
      newStaffId: z.string().uuid().optional().describe("New staff member ID (optional)"),
    },
    async ({ id, newStartTime, newStaffId }) => {
      const appointment = await prisma.appointment.findFirst({
        where: { id, businessId: ctx.businessId },
        include: { services: true },
      })
      if (!appointment) return err("Appointment not found")

      const durationMinutes = appointment.services[0]?.durationMinutes ?? appointment.totalDuration
      const newStart = new Date(newStartTime)
      const newEnd = new Date(newStart.getTime() + durationMinutes * 60000)

      const updated = await prisma.appointment.update({
        where: { id },
        data: { startTime: newStart, endTime: newEnd },
      })

      // Update AppointmentService times and staff if needed
      if (appointment.services[0]) {
        await prisma.appointmentService.update({
          where: { id: appointment.services[0].id },
          data: {
            startTime: newStart,
            endTime: newEnd,
            ...(newStaffId ? { staffId: newStaffId } : {}),
          },
        })
      }

      return ok(updated)
    }
  )

  server.tool(
    "cancel-appointment",
    "Cancel an appointment",
    {
      id: z.string().uuid().describe("Appointment ID"),
      reason: z.string().optional().describe("Cancellation reason"),
    },
    async ({ id, reason }) => {
      const appointment = await prisma.appointment.findFirst({ where: { id, businessId: ctx.businessId } })
      if (!appointment) return err("Appointment not found")
      const updated = await prisma.appointment.update({
        where: { id },
        data: {
          status: "cancelled",
          cancellationReason: reason,
          cancelledAt: new Date(),
          cancelledBy: ctx.userId,
        },
      })
      return ok(updated)
    }
  )

  server.tool(
    "create-recurring-appointment",
    "Create a series of recurring appointments",
    {
      clientId: z.string().uuid().describe("Client ID"),
      serviceId: z.string().uuid().describe("Service ID"),
      staffId: z.string().uuid().describe("Staff member ID"),
      startTime: z.string().describe("First appointment start time (ISO 8601)"),
      recurrenceRule: z.enum(["weekly", "biweekly", "monthly"]).describe("Recurrence frequency"),
      recurrenceEndDate: z.string().describe("Last date for recurrence (ISO 8601)"),
      notes: z.string().optional().describe("Notes for all appointments in the series"),
    },
    async ({ clientId, serviceId, staffId, startTime, recurrenceRule, recurrenceEndDate, notes }) => {
      const [service, location] = await Promise.all([
        prisma.service.findFirst({ where: { id: serviceId, businessId: ctx.businessId } }),
        prisma.location.findFirst({ where: { businessId: ctx.businessId } }),
      ])
      if (!service) return err("Service not found")
      if (!location) return err("Business not configured")

      const seriesId = crypto.randomUUID()
      const start = new Date(startTime)
      const endDate = new Date(recurrenceEndDate)
      const intervalDays = recurrenceRule === "weekly" ? 7 : recurrenceRule === "biweekly" ? 14 : 30
      const price = Number(service.price)

      const appointments: { id: string; startTime: Date }[] = []
      let current = new Date(start)
      let count = 0

      while (current <= endDate && count < 52) {
        const occurrenceStart = new Date(current)
        const occurrenceEnd = new Date(current.getTime() + service.durationMinutes * 60000)

        const appt = await prisma.appointment.create({
          data: {
            businessId: ctx.businessId,
            locationId: location.id,
            clientId,
            bookingReference: genBookingRef(),
            status: "confirmed",
            source: "pos",
            startTime: occurrenceStart,
            endTime: occurrenceEnd,
            totalDuration: service.durationMinutes,
            subtotal: price,
            taxAmount: 0,
            totalAmount: price,
            notes,
            seriesId,
            recurrenceRule,
            recurrenceEndDate: endDate,
          },
        })

        await prisma.appointmentService.create({
          data: {
            appointmentId: appt.id,
            serviceId,
            staffId,
            name: service.name,
            durationMinutes: service.durationMinutes,
            price,
            finalPrice: price,
            startTime: occurrenceStart,
            endTime: occurrenceEnd,
          },
        })

        appointments.push({ id: appt.id, startTime: appt.startTime })
        current = new Date(current.getTime() + intervalDays * 86400000)
        count++
      }

      return ok({ seriesId, appointmentsCreated: appointments.length, appointments })
    }
  )

  server.tool(
    "cancel-recurring-series",
    "Cancel all future appointments in a recurring series",
    {
      seriesId: z.string().uuid().describe("Recurring series ID"),
      cancelFrom: z.string().optional().describe("Cancel from this date onwards (ISO 8601). If omitted, cancels all."),
    },
    async ({ seriesId, cancelFrom }) => {
      const fromDate = cancelFrom ? new Date(cancelFrom) : new Date(0)
      const result = await prisma.appointment.updateMany({
        where: {
          businessId: ctx.businessId,
          seriesId,
          startTime: { gte: fromDate },
          status: { notIn: ["completed", "cancelled"] },
        },
        data: { status: "cancelled", cancelledAt: new Date(), cancelledBy: ctx.userId },
      })
      return ok({ cancelledCount: result.count })
    }
  )

  server.tool(
    "create-group-appointment",
    "Create a group appointment/class session",
    {
      serviceId: z.string().uuid().describe("Service ID"),
      staffId: z.string().uuid().describe("Staff member ID"),
      startTime: z.string().describe("Start time (ISO 8601)"),
      maxParticipants: z.number().int().positive().describe("Maximum number of participants"),
      clientIds: z.array(z.string().uuid()).optional().describe("Initial participant client IDs"),
      notes: z.string().optional(),
    },
    async ({ serviceId, staffId, startTime, maxParticipants, clientIds = [], notes }) => {
      const [service, location] = await Promise.all([
        prisma.service.findFirst({ where: { id: serviceId, businessId: ctx.businessId } }),
        prisma.location.findFirst({ where: { businessId: ctx.businessId } }),
      ])
      if (!service) return err("Service not found")
      if (!location) return err("Business not configured")

      const start = new Date(startTime)
      const end = new Date(start.getTime() + service.durationMinutes * 60000)
      const price = Number(service.price)

      const appointment = await prisma.appointment.create({
        data: {
          businessId: ctx.businessId,
          locationId: location.id,
          clientId: clientIds[0] ?? null,
          bookingReference: genBookingRef(),
          status: "confirmed",
          source: "pos",
          startTime: start,
          endTime: end,
          totalDuration: service.durationMinutes,
          subtotal: price,
          taxAmount: 0,
          totalAmount: price,
          notes,
          isGroupBooking: true,
          maxParticipants,
          groupParticipants: {
            create: clientIds.map((clientId) => ({ clientId })),
          },
        },
        include: { groupParticipants: true },
      })

      await prisma.appointmentService.create({
        data: {
          appointmentId: appointment.id,
          serviceId,
          staffId,
          name: service.name,
          durationMinutes: service.durationMinutes,
          price,
          finalPrice: price,
          startTime: start,
          endTime: end,
        },
      })

      return ok(appointment)
    }
  )

  server.tool(
    "add-group-participant",
    "Add a participant to a group appointment",
    {
      appointmentId: z.string().uuid().describe("Group appointment ID"),
      clientId: z.string().uuid().describe("Client ID to add"),
    },
    async ({ appointmentId, clientId }) => {
      const appointment = await prisma.appointment.findFirst({
        where: { id: appointmentId, businessId: ctx.businessId, isGroupBooking: true },
        include: { groupParticipants: true },
      })
      if (!appointment) return err("Group appointment not found")
      if (appointment.maxParticipants && appointment.groupParticipants.length >= appointment.maxParticipants) {
        return err("Group appointment is full")
      }
      const participant = await prisma.groupParticipant.create({
        data: { appointmentId, clientId },
      })
      return ok(participant)
    }
  )

  server.tool(
    "remove-group-participant",
    "Remove a participant from a group appointment",
    {
      appointmentId: z.string().uuid().describe("Group appointment ID"),
      clientId: z.string().uuid().describe("Client ID to remove"),
    },
    async ({ appointmentId, clientId }) => {
      const appointment = await prisma.appointment.findFirst({ where: { id: appointmentId, businessId: ctx.businessId } })
      if (!appointment) return err("Group appointment not found")
      await prisma.groupParticipant.deleteMany({ where: { appointmentId, clientId } })
      return ok({ removed: true })
    }
  )
}
