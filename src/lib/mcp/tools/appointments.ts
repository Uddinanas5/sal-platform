import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { type ApiContext } from "@/lib/api/auth"
import { canAccessAppointment, canAccessAppointmentSeries } from "@/lib/api/appointment-access"
import { prisma } from "@/lib/prisma"
import { lockStaffSchedule, lockAppointment, isBookingContentionError } from "@/lib/db/advisory-lock"
import { generateBookingReference } from "@/lib/booking-reference"
import { hasRole } from "@/lib/permissions"
import {
  assertSlotAllowed,
  ERR_OUTSIDE_WORKING_HOURS,
  ERR_ON_APPROVED_TIME_OFF,
} from "@/lib/scheduling/working-hours"
import { generateRecurrenceDates } from "@/lib/scheduling/recurrence"
import { z } from "zod"

class GroupFullError extends Error {}

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data) }] }
}

function err(message: string) {
  return { content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }], isError: true as const }
}

// Translate the assertSlotAllowed sentinels to a client-safe MCP error message,
// or return null if the error is something else (re-thrown by the caller).
function slotErrorMessage(e: unknown): string | null {
  const msg = (e as Error).message
  if (msg === ERR_OUTSIDE_WORKING_HOURS) return "Outside the staff member's working hours"
  if (msg === ERR_ON_APPROVED_TIME_OFF) return "Staff member has approved time off during this slot"
  return null
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
      if (ctx.role === "staff") {
        const staffProfile = await prisma.staff.findFirst({
          where: {
            userId: ctx.userId,
            primaryLocation: { businessId: ctx.businessId },
            isActive: true,
            deletedAt: null,
          },
        })
        where.services = { some: { staffId: staffProfile?.id ?? "__none__" } }
      } else if (staffId) {
        where.services = { some: { staffId } }
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
      const [service, client, staff, location, business] = await Promise.all([
        prisma.service.findFirst({ where: { id: serviceId, businessId: ctx.businessId, deletedAt: null } }),
        prisma.client.findFirst({ where: { id: clientId, businessId: ctx.businessId, deletedAt: null } }),
        prisma.staff.findFirst({
          where: { id: staffId, primaryLocation: { businessId: ctx.businessId }, isActive: true, deletedAt: null },
        }),
        prisma.location.findFirst({ where: { businessId: ctx.businessId } }),
        prisma.business.findUnique({ where: { id: ctx.businessId }, select: { timezone: true } }),
      ])
      if (!service) return err("Service not found")
      if (!client) return err("Client not found")
      if (!staff) return err("Staff not found")
      if (!hasRole(ctx.role, "admin") && staff.userId !== ctx.userId) return err("Forbidden")
      if (!location) return err("Business not configured")
      // Salon IANA timezone anchors assertSlotAllowed's @db.Time hours to the
      // salon's clock (not the server's) on any host.
      const timezone = business?.timezone ?? "UTC"

      const start = new Date(startTime)
      const end = new Date(start.getTime() + service.durationMinutes * 60000)
      const price = Number(service.price)
      const taxRate = service.isTaxable && service.taxRate ? Number(service.taxRate) / 100 : 0
      const tax = Math.round(price * taxRate * 100) / 100

      try {
        const appointment = await prisma.$transaction(async (tx) => {
          // Same working-hours / break / approved-time-off guard the server
          // actions and v1 API use (BOOKING-RESIDUAL). Ordering mirrors them:
          // lock -> assertSlotAllowed -> conflict check. Salon timezone anchors
          // the @db.Time hours on any host.
          await lockStaffSchedule(tx, ctx.businessId, staffId)
          await assertSlotAllowed(tx, staffId, location.id, start, end, timezone)

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
              bookingReference: generateBookingReference(),
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
        }, { timeout: 20000, maxWait: 15000 })
        return ok(appointment)
      } catch (e) {
        if ((e as Error).message === "CONFLICT") return err("Time slot already booked for this staff member")
        const slotErr = slotErrorMessage(e)
        if (slotErr) return err(slotErr)
        // Concurrency contention behind the advisory lock (tx timeout P2028 /
        // write-conflict P2034) — return the same clean conflict message.
        if (isBookingContentionError(e)) return err("Time slot already booked for this staff member")
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
      const current = await prisma.appointment.findFirst({
        where: { id, businessId: ctx.businessId },
        select: { status: true, services: { select: { staffId: true, startTime: true, endTime: true } } },
      })
      if (!current) return err("Appointment not found")
      if (!(await canAccessAppointment(ctx, id))) return err("Forbidden")

      const data = {
        status,
        ...(status === "completed" ? { completedAt: new Date() } : {}),
        ...(status === "cancelled" ? { cancelledAt: new Date() } : {}),
        ...(status === "no_show" ? { noShowAt: new Date() } : {}),
        ...(status === "checked_in" ? { checkedInAt: new Date() } : {}),
      }
      // On reactivation, clear stale cancellation fields with explicit null (Prisma
      // omits undefined) — mirrors the server action + v1 route.
      const reactivationData = {
        ...data,
        cancelledAt: null,
        noShowAt: null,
        cancellationInitiator: null,
        cancellationReasonCode: null,
        cancellationReason: null,
        cancelledBy: null,
      }

      // REACTIVATION GUARD (mirrors the server action + v1 REST PATCH): cancelled/
      // no_show FREE the slot, so another booking may have taken it. Moving back to
      // an ACTIVE status must re-check for conflicts under the same staff advisory
      // lock as create/reschedule — otherwise reactivating an old cancellation via
      // this MCP tool silently double-books the staff member.
      const FREE = ["cancelled", "no_show"]
      const ACTIVE = ["confirmed", "checked_in", "in_progress", "completed"]
      const isReactivation = FREE.includes(current.status) && ACTIVE.includes(status)

      try {
        const updated = isReactivation
          ? await prisma.$transaction(
              async (tx) => {
                for (const svc of current.services) {
                  if (!svc.staffId) continue
                  await lockStaffSchedule(tx, ctx.businessId, svc.staffId)
                  const conflict = await tx.appointmentService.findFirst({
                    where: {
                      staffId: svc.staffId,
                      appointmentId: { not: id },
                      appointment: { status: { notIn: ["cancelled", "no_show"] } },
                      startTime: { lt: svc.endTime },
                      endTime: { gt: svc.startTime },
                    },
                  })
                  if (conflict) throw new Error("CONFLICT")
                }
                return tx.appointment.update({ where: { id, businessId: ctx.businessId }, data: reactivationData })
              },
              { timeout: 20000, maxWait: 15000 },
            )
          : await prisma.appointment.update({ where: { id, businessId: ctx.businessId }, data })
        return ok(updated)
      } catch (e) {
        if ((e as Error)?.message === "CONFLICT" || isBookingContentionError(e)) {
          return err("That time slot is no longer free — the appointment can't be reactivated.")
        }
        throw e
      }
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
        include: { services: true, business: { select: { timezone: true } } },
      })
      if (!appointment) return err("Appointment not found")
      if (!(await canAccessAppointment(ctx, id))) return err("Forbidden")

      const newStart = new Date(newStartTime)
      const newEnd = new Date(newStart.getTime() + appointment.totalDuration * 60000)
      const oldStartMs = appointment.startTime.getTime()
      const deltaMs = newStart.getTime() - oldStartMs

      if (newStaffId) {
        const staff = await prisma.staff.findFirst({
          where: { id: newStaffId, primaryLocation: { businessId: ctx.businessId }, isActive: true, deletedAt: null },
        })
        if (!staff) return err("Staff not found")
        if (!hasRole(ctx.role, "admin") && staff.userId !== ctx.userId) return err("Forbidden")
      }

      // Shift EVERY service row by the same delta — never just services[0].
      // A multi-service appointment (cut+beard+lineup) lays its rows out
      // back-to-back; moving only the first row would orphan services[1..N] at
      // the old slot (a ghost booking that still occupies the staff's original
      // time and is invisible to the new-slot conflict check). Mirrors the
      // server action (actions/appointments.ts) and reschedulePublicBooking.
      const sortedServices = [...appointment.services].sort(
        (a, b) => a.startTime.getTime() - b.startTime.getTime(),
      )
      const serviceUpdates = sortedServices.map((s, i) => ({
        id: s.id,
        startTime: new Date(s.startTime.getTime() + deltaMs),
        endTime: new Date(s.endTime.getTime() + deltaMs),
        // newStaffId reassigns only the lead service; services[1..N] keep their
        // original staff (no per-service reassignment field on this tool).
        staffId: newStaffId && i === 0 ? newStaffId : s.staffId,
        applyStaffUpdate: Boolean(newStaffId && i === 0),
      }))

      try {
        const updated = await prisma.$transaction(async (tx) => {
          // Same working-hours / break / approved-time-off guard the server
          // actions and v1 API use (BOOKING-RESIDUAL). Ordering mirrors them:
          // lock all distinct involved staff -> assertSlotAllowed + conflict
          // check EACH shifted row -> update.
          const uniqueStaffIds = Array.from(
            new Set(serviceUpdates.map((s) => s.staffId).filter(Boolean) as string[]),
          ).sort()
          for (const staffId of uniqueStaffIds) {
            await lockStaffSchedule(tx, ctx.businessId, staffId)
          }

          for (const su of serviceUpdates) {
            if (!su.staffId) continue
            // Salon timezone anchors the @db.Time working-hours window on any host.
            await assertSlotAllowed(tx, su.staffId, appointment.locationId, su.startTime, su.endTime, appointment.business.timezone)
            const conflict = await tx.appointmentService.findFirst({
              where: {
                staffId: su.staffId,
                appointmentId: { not: id },
                appointment: { status: { notIn: ["cancelled", "no_show"] } },
                startTime: { lt: su.endTime },
                endTime: { gt: su.startTime },
              },
            })
            if (conflict) throw new Error("CONFLICT")
          }

          const appt = await tx.appointment.update({
            where: { id, businessId: ctx.businessId },
            data: { startTime: newStart, endTime: newEnd },
          })

          for (const su of serviceUpdates) {
            const updateData: Record<string, unknown> = {
              startTime: su.startTime,
              endTime: su.endTime,
            }
            if (su.applyStaffUpdate) updateData.staffId = su.staffId
            await tx.appointmentService.update({
              where: { id: su.id },
              data: updateData,
            })
          }

          return appt
        }, { timeout: 20000, maxWait: 15000 })

        return ok(updated)
      } catch (e) {
        if ((e as Error).message === "CONFLICT") return err("Time slot already booked for this staff member")
        const slotErr = slotErrorMessage(e)
        if (slotErr) return err(slotErr)
        // Concurrency contention behind the advisory lock (tx timeout P2028 /
        // write-conflict P2034) — return the same clean conflict message.
        if (isBookingContentionError(e)) return err("Time slot already booked for this staff member")
        throw e
      }
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
      if (!(await canAccessAppointment(ctx, id))) return err("Forbidden")
      const updated = await prisma.appointment.update({
        where: { id, businessId: ctx.businessId },
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
      const [service, client, staff, location, business] = await Promise.all([
        prisma.service.findFirst({ where: { id: serviceId, businessId: ctx.businessId, deletedAt: null } }),
        prisma.client.findFirst({ where: { id: clientId, businessId: ctx.businessId, deletedAt: null } }),
        prisma.staff.findFirst({
          where: { id: staffId, primaryLocation: { businessId: ctx.businessId }, isActive: true, deletedAt: null },
        }),
        prisma.location.findFirst({ where: { businessId: ctx.businessId } }),
        prisma.business.findUnique({ where: { id: ctx.businessId }, select: { timezone: true } }),
      ])
      if (!service) return err("Service not found")
      if (!client) return err("Client not found")
      if (!staff) return err("Staff not found")
      if (!hasRole(ctx.role, "admin") && staff.userId !== ctx.userId) return err("Forbidden")
      if (!location) return err("Business not configured")
      // Salon IANA timezone anchors assertSlotAllowed's @db.Time hours to the
      // salon's clock (not the server's) on any host.
      const timezone = business?.timezone ?? "UTC"

      const seriesId = crypto.randomUUID()
      const start = new Date(startTime)
      const endDate = new Date(recurrenceEndDate)
      const price = Number(service.price)
      // Occurrence instants advanced in the SALON timezone (DST-safe; 'monthly' =
      // calendar month, not +30 days) — the same tested helper the recurring server
      // action uses.
      const dates = generateRecurrenceDates({ start, rule: recurrenceRule, endDate, timezone })

      let appointments: { id: string; startTime: Date }[] = []

      try {
        // ATOMIC SERIES: wrap the WHOLE loop in ONE transaction (mirrors the server
        // action createRecurringAppointment) so a mid-series conflict / working-hours
        // violation rolls back EVERY occurrence — never a partially-booked series with
        // orphaned appointments while the caller is told nothing was created. Lock the
        // staff schedule once up front (same staff for every occurrence); conflict-check
        // each occurrence. Salon timezone anchors assertSlotAllowed's @db.Time hours.
        appointments = await prisma.$transaction(
          async (tx) => {
            await lockStaffSchedule(tx, ctx.businessId, staffId)
            const created: { id: string; startTime: Date }[] = []

            for (const occurrenceStart of dates) {
              const occurrenceEnd = new Date(occurrenceStart.getTime() + service.durationMinutes * 60000)

              await assertSlotAllowed(tx, staffId, location.id, occurrenceStart, occurrenceEnd, timezone)

              const conflict = await tx.appointmentService.findFirst({
                where: {
                  staffId,
                  appointment: { status: { notIn: ["cancelled", "no_show"] } },
                  startTime: { lt: occurrenceEnd },
                  endTime: { gt: occurrenceStart },
                },
              })
              if (conflict) throw new Error("CONFLICT")

              const createdAppt = await tx.appointment.create({
                data: {
                  businessId: ctx.businessId,
                  locationId: location.id,
                  clientId,
                  bookingReference: generateBookingReference(),
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

              await tx.appointmentService.create({
                data: {
                  appointmentId: createdAppt.id,
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

              created.push({ id: createdAppt.id, startTime: createdAppt.startTime })
            }

            return created
          },
          { timeout: 20000, maxWait: 15000 },
        )
      } catch (e) {
        if ((e as Error).message === "CONFLICT") return err("One or more recurring time slots are already booked")
        const slotErr = slotErrorMessage(e)
        if (slotErr) return err(slotErr)
        // Concurrency contention behind the advisory lock (tx timeout P2028 /
        // write-conflict P2034) — return the same clean conflict message.
        if (isBookingContentionError(e)) return err("One or more recurring time slots are already booked")
        throw e
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
      // Staff authz: only admins/owners or staff actually assigned to the series
      // may cancel it. Mirrors the sibling MCP write tools (canAccessAppointment)
      // and the equivalent REST route (canAccessAppointmentSeries) — without this
      // a staff-role API key could mass-cancel another barber's series.
      if (!(await canAccessAppointmentSeries(ctx, seriesId))) return err("Forbidden")
      const fromDate = cancelFrom ? new Date(cancelFrom) : new Date(0)
      if (Number.isNaN(fromDate.getTime())) return err("Invalid cancelFrom date")
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
      if (new Set(clientIds).size !== clientIds.length) return err("Duplicate participants are not allowed")
      if (clientIds.length > maxParticipants) return err("Too many participants")

      const [service, staff, clientCount, location, business] = await Promise.all([
        prisma.service.findFirst({ where: { id: serviceId, businessId: ctx.businessId, deletedAt: null } }),
        prisma.staff.findFirst({
          where: { id: staffId, primaryLocation: { businessId: ctx.businessId }, isActive: true, deletedAt: null },
        }),
        clientIds.length
          ? prisma.client.count({ where: { id: { in: clientIds }, businessId: ctx.businessId, deletedAt: null } })
          : Promise.resolve(0),
        prisma.location.findFirst({ where: { businessId: ctx.businessId } }),
        prisma.business.findUnique({ where: { id: ctx.businessId }, select: { timezone: true } }),
      ])
      if (!service) return err("Service not found")
      if (!staff) return err("Staff not found")
      if (!hasRole(ctx.role, "admin") && staff.userId !== ctx.userId) return err("Forbidden")
      if (clientCount !== clientIds.length) return err("Client not found")
      if (!location) return err("Business not configured")
      // Salon IANA timezone anchors assertSlotAllowed's @db.Time hours to the
      // salon's clock (not the server's) on any host.
      const timezone = business?.timezone ?? "UTC"

      const start = new Date(startTime)
      const end = new Date(start.getTime() + service.durationMinutes * 60000)
      const price = Number(service.price)

      try {
        const appointment = await prisma.$transaction(async (tx) => {
          // Same working-hours / break / approved-time-off guard the server
          // actions and v1 API use (BOOKING-RESIDUAL): lock -> assertSlotAllowed
          // -> conflict check -> create. Salon timezone anchors the @db.Time
          // hours on any host.
          await lockStaffSchedule(tx, ctx.businessId, staffId)
          await assertSlotAllowed(tx, staffId, location.id, start, end, timezone)

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
              clientId: clientIds[0] ?? null,
              bookingReference: generateBookingReference(),
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
        }, { timeout: 20000, maxWait: 15000 })

        return ok(appointment)
      } catch (e) {
        if ((e as Error).message === "CONFLICT") return err("Time slot already booked for this staff member")
        const slotErr = slotErrorMessage(e)
        if (slotErr) return err(slotErr)
        // Concurrency contention behind the advisory lock (tx timeout P2028 /
        // write-conflict P2034) — return the same clean conflict message.
        if (isBookingContentionError(e)) return err("Time slot already booked for this staff member")
        throw e
      }
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
        include: { services: true, business: { select: { timezone: true } } },
      })
      if (!appointment) return err("Group appointment not found")
      if (!(await canAccessAppointment(ctx, appointmentId))) return err("Forbidden")
      const client = await prisma.client.findFirst({
        where: { id: clientId, businessId: ctx.businessId, deletedAt: null },
        select: { id: true },
      })
      if (!client) return err("Client not found")

      const slotStaffId = appointment.services[0]?.staffId
      try {
        const participant = await prisma.$transaction(async (tx) => {
          // Capacity check + insert must be atomic: lock the appointment and
          // RE-COUNT under it, or two concurrent adds both read count = max-1 and
          // oversell maxParticipants. Mirrors the v1 route + actions/recurring.ts.
          await lockAppointment(tx, ctx.businessId, appointmentId)
          if (appointment.maxParticipants) {
            const count = await tx.groupParticipant.count({ where: { appointmentId } })
            if (count >= appointment.maxParticipants) throw new GroupFullError()
          }
          // Re-validate the group session's slot before adding load to it. Same
          // working-hours / break / approved-time-off guard the booking write
          // paths use (BOOKING-RESIDUAL): lock -> assertSlotAllowed -> create.
          if (slotStaffId) {
            await lockStaffSchedule(tx, ctx.businessId, slotStaffId)
            // Salon timezone anchors the @db.Time working-hours window on any host.
            await assertSlotAllowed(
              tx,
              slotStaffId,
              appointment.locationId,
              appointment.startTime,
              appointment.endTime,
              appointment.business.timezone,
            )
          }
          return tx.groupParticipant.create({
            data: { appointmentId, clientId },
          })
        }, { timeout: 20000, maxWait: 15000 })
        return ok(participant)
      } catch (e) {
        if (e instanceof GroupFullError) return err("Group appointment is full")
        const slotErr = slotErrorMessage(e)
        if (slotErr) return err(slotErr)
        // Concurrency contention behind the advisory lock (tx timeout P2028 /
        // write-conflict P2034) — return a clean "try again" message.
        if (isBookingContentionError(e)) return err("This time slot is no longer available, please try again")
        throw e
      }
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
      if (!(await canAccessAppointment(ctx, appointmentId))) return err("Forbidden")
      await prisma.groupParticipant.deleteMany({ where: { appointmentId, clientId } })
      return ok({ removed: true })
    }
  )
}
