import { prisma } from "@/lib/prisma"

// ============================================================================
// PAYDAY / PAYROLL STATEMENT
// ============================================================================
//
// The "every-2-weeks" statement a shop owner runs on payday: per-barber
// commission earnings, grouped from the REAL Commission ledger (populated at
// checkout — Phase 0). No estimates, no fabricated tips/booth-rent.
//
// TENANT ISOLATION (non-negotiable):
// Commission rows carry no businessId of their own; they are owned by a barber,
// and a barber belongs to a business through `staff.primaryLocation.businessId`.
// So every read here is scoped two ways at once:
//   1. We resolve the caller-business's staff ids first (primaryLocation filter).
//   2. Every Commission query is constrained to `staffId IN <those ids>`.
// A barber from another shop can never be resolved, and their ledger rows can
// never be summed into this statement. `businessId` is ALWAYS supplied by the
// caller from session/context — never from request input.
//
// KNOWN-MISSING (surfaced honestly, never fabricated):
//   - Tips are recorded as a payment-level `tipAmount`, not attributed to an
//     individual barber yet. We do NOT guess a split.
//   - Booth rent has no field in the schema. We do NOT invent a deduction.
// Both are returned as explicit "not yet tracked" flags so the UI can say so
// out loud instead of showing a confident wrong number.

export interface PayrollStatementLineItem {
  commissionId: string
  date: string // ISO of the ledger row's createdAt (when the sale was rung up)
  type: "service" | "product" | "tip"
  description: string // service/product name, or a fallback label
  bookingReference: string | null
  clientName: string | null
  grossAmount: number // attributed gross revenue for this line
  commissionRate: number // snapshotted rate on the ledger row (percent)
  commissionAmount: number // what the barber earned on this line
  status: "pending" | "approved" | "paid"
}

export interface PayrollStatementBarber {
  staffId: string
  name: string
  employmentType: "full_time" | "part_time" | "contractor"
  defaultCommissionRate: number // staff.commissionRate, for context
  commissionedServices: number // count of commissioned line items
  grossServiceRevenue: number // sum of attributed gross
  commissionEarned: number // sum of commissionAmount — the number that matters
  totalToPay: number // == commissionEarned today (tips/rent not yet tracked)
  lineItems: PayrollStatementLineItem[]
}

export interface PayrollStatementNotTracked {
  tips: boolean // true => tips exist in the system but aren't barber-attributed
  boothRent: boolean // true => booth rent is not modeled in the schema
}

export interface PayrollStatement {
  range: { from: string; to: string }
  payrollPeriodId: string | null
  barbers: PayrollStatementBarber[]
  totals: {
    commissionEarned: number
    grossServiceRevenue: number
    commissionedServices: number
    totalToPay: number
    barberCount: number
  }
  notTracked: PayrollStatementNotTracked
}

interface GetPayrollStatementOptions {
  /** Explicit window. `to` is treated as inclusive (we expand to end-of-day). */
  range?: { from?: Date | null; to?: Date | null }
  /** Or resolve the window from a stored PayrollPeriod (also businessId-scoped). */
  payrollPeriodId?: string | null
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// Make a day-precision `to` inclusive of its whole day (mirrors reports.ts
// resolveRange semantics) so the picked end date is itself included.
function inclusiveEnd(to: Date): Date {
  if (
    to.getHours() === 0 &&
    to.getMinutes() === 0 &&
    to.getSeconds() === 0 &&
    to.getMilliseconds() === 0
  ) {
    return new Date(to.getTime() + 24 * 60 * 60 * 1000 - 1)
  }
  return to
}

/**
 * Build a payday statement for one business over either an explicit date range
 * OR a stored payroll period. Strictly scoped to `businessId`.
 *
 * Returns `null` only when `businessId` is falsy (defensive — there is no safe
 * fallback for a missing tenant). An empty business yields a well-formed
 * statement with zeroed totals and an empty barber list.
 */
export async function getPayrollStatement(
  businessId: string,
  options: GetPayrollStatementOptions = {},
): Promise<PayrollStatement | null> {
  // No businessId => no statement. Never fall back to an unscoped query.
  if (!businessId) return null

  // 1. Resolve the reporting window. A payrollPeriodId is itself tenant-scoped:
  //    we only accept it if it belongs to THIS business.
  let from: Date
  let to: Date
  let resolvedPeriodId: string | null = null

  if (options.payrollPeriodId) {
    const period = await prisma.payrollPeriod.findFirst({
      where: { id: options.payrollPeriodId, businessId },
      select: { id: true, periodStart: true, periodEnd: true },
    })
    // A period id from another shop (or a bad id) resolves to nothing — we do
    // NOT silently widen to "all time"; we return an empty, honest statement.
    if (!period) {
      return emptyStatement(businessId, null, null, null)
    }
    resolvedPeriodId = period.id
    from = period.periodStart
    // periodEnd is a @db.Date (midnight) — make the whole day inclusive.
    to = inclusiveEnd(period.periodEnd)
  } else {
    const now = new Date()
    const rawFrom =
      options.range?.from instanceof Date && !isNaN(options.range.from.getTime())
        ? options.range.from
        : new Date(now.getFullYear(), now.getMonth(), 1)
    const rawTo =
      options.range?.to instanceof Date && !isNaN(options.range.to.getTime())
        ? options.range.to
        : now
    // Inverted range => degrade to a safe default month rather than throwing.
    if (rawFrom > rawTo) {
      from = new Date(now.getFullYear(), now.getMonth(), 1)
      to = now
    } else {
      from = rawFrom
      to = inclusiveEnd(rawTo)
    }
  }

  // 2. Resolve the caller-business's active staff. This is the tenant boundary:
  //    Commission rows are only ever summed for these ids.
  const staff = await prisma.staff.findMany({
    where: { isActive: true, primaryLocation: { businessId } },
    select: {
      id: true,
      employmentType: true,
      commissionRate: true,
      user: { select: { firstName: true, lastName: true } },
    },
  })

  const staffIds = staff.map((s) => s.id)
  if (staffIds.length === 0) {
    return emptyStatement(businessId, resolvedPeriodId, from, to)
  }

  // 3. Pull the ledger rows for these barbers in-window, with enough relation
  //    context to render line items. Scoped by `staffId IN <business staff>`.
  const rows = await prisma.commission.findMany({
    where: {
      staffId: { in: staffIds },
      createdAt: { gte: from, lte: to },
    },
    select: {
      id: true,
      staffId: true,
      type: true,
      referenceType: true,
      referenceId: true,
      grossAmount: true,
      commissionRate: true,
      commissionAmount: true,
      status: true,
      createdAt: true,
      appointment: {
        select: {
          bookingReference: true,
          client: { select: { firstName: true, lastName: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  })

  // Service line items reference an AppointmentService (referenceType ==
  // "appointment_service", referenceId == the AppointmentService id). Batch-fetch
  // those names so each line can show what was actually performed. The lookup is
  // re-scoped to this business's staff ids — never widened.
  const apptServiceIds = Array.from(
    new Set(
      rows
        .filter((r) => r.referenceType === "appointment_service")
        .map((r) => r.referenceId),
    ),
  )
  const apptServices = apptServiceIds.length
    ? await prisma.appointmentService.findMany({
        where: { id: { in: apptServiceIds }, staffId: { in: staffIds } },
        select: { id: true, name: true },
      })
    : []
  const nameByApptServiceId = new Map(apptServices.map((s) => [s.id, s.name]))

  // 4. Group ledger rows by barber, building line items + running sums.
  const byStaff = new Map<string, PayrollStatementBarber>()
  for (const s of staff) {
    byStaff.set(s.id, {
      staffId: s.id,
      name: `${s.user.firstName} ${s.user.lastName}`.trim(),
      employmentType: s.employmentType,
      defaultCommissionRate: Number(s.commissionRate ?? 0),
      commissionedServices: 0,
      grossServiceRevenue: 0,
      commissionEarned: 0,
      totalToPay: 0,
      lineItems: [],
    })
  }

  for (const row of rows) {
    const barber = byStaff.get(row.staffId)
    if (!barber) continue // defensive: ledger row outside resolved staff set

    const gross = Number(row.grossAmount ?? 0)
    const earned = Number(row.commissionAmount ?? 0)
    const rate = Number(row.commissionRate ?? 0)

    const apptServiceId =
      row.referenceType === "appointment_service" ? row.referenceId : null
    const serviceName =
      (apptServiceId && nameByApptServiceId.get(apptServiceId)) ||
      (row.type === "product"
        ? "Product sale"
        : row.type === "tip"
          ? "Tip"
          : "Service")

    const clientName = row.appointment?.client
      ? `${row.appointment.client.firstName} ${row.appointment.client.lastName}`.trim()
      : null

    barber.lineItems.push({
      commissionId: row.id,
      date: row.createdAt.toISOString(),
      type: row.type,
      description: serviceName,
      bookingReference: row.appointment?.bookingReference ?? null,
      clientName,
      grossAmount: round2(gross),
      commissionRate: rate,
      commissionAmount: round2(earned),
      status: row.status,
    })

    barber.commissionedServices += 1
    barber.grossServiceRevenue += gross
    barber.commissionEarned += earned
  }

  // 5. Finalize per-barber sums (round once, at the end) + total-to-pay.
  const barbers = Array.from(byStaff.values())
    .map((b) => {
      const commissionEarned = round2(b.commissionEarned)
      return {
        ...b,
        grossServiceRevenue: round2(b.grossServiceRevenue),
        commissionEarned,
        // Today total-to-pay == commission earned. Tips/booth-rent are NOT
        // folded in because they aren't tracked per-barber yet (see notTracked).
        totalToPay: commissionEarned,
      }
    })
    // Stable, useful order: biggest cheque first, then alphabetical.
    .sort((a, b) => b.commissionEarned - a.commissionEarned || a.name.localeCompare(b.name))

  const totals = barbers.reduce(
    (acc, b) => {
      acc.commissionEarned += b.commissionEarned
      acc.grossServiceRevenue += b.grossServiceRevenue
      acc.commissionedServices += b.commissionedServices
      acc.totalToPay += b.totalToPay
      return acc
    },
    {
      commissionEarned: 0,
      grossServiceRevenue: 0,
      commissionedServices: 0,
      totalToPay: 0,
      barberCount: barbers.length,
    },
  )

  return {
    range: { from: from.toISOString(), to: to.toISOString() },
    payrollPeriodId: resolvedPeriodId,
    barbers,
    totals: {
      commissionEarned: round2(totals.commissionEarned),
      grossServiceRevenue: round2(totals.grossServiceRevenue),
      commissionedServices: totals.commissionedServices,
      totalToPay: round2(totals.totalToPay),
      barberCount: totals.barberCount,
    },
    // Honest "not yet tracked" surface — never fabricated.
    notTracked: { tips: true, boothRent: true },
  }
}

function emptyStatement(
  _businessId: string,
  payrollPeriodId: string | null,
  from: Date | null,
  to: Date | null,
): PayrollStatement {
  const now = new Date()
  const f = from ?? new Date(now.getFullYear(), now.getMonth(), 1)
  const t = to ?? now
  return {
    range: { from: f.toISOString(), to: t.toISOString() },
    payrollPeriodId,
    barbers: [],
    totals: {
      commissionEarned: 0,
      grossServiceRevenue: 0,
      commissionedServices: 0,
      totalToPay: 0,
      barberCount: 0,
    },
    notTracked: { tips: true, boothRent: true },
  }
}

/**
 * List this business's payroll periods (most recent first) for the period picker
 * on the payday view. Strictly businessId-scoped.
 */
export async function listPayrollPeriods(businessId: string) {
  if (!businessId) return []
  const periods = await prisma.payrollPeriod.findMany({
    where: { businessId },
    select: {
      id: true,
      periodStart: true,
      periodEnd: true,
      status: true,
      paidAt: true,
    },
    orderBy: { periodStart: "desc" },
    take: 24,
  })
  return periods.map((p) => ({
    id: p.id,
    periodStart: p.periodStart.toISOString(),
    periodEnd: p.periodEnd.toISOString(),
    status: p.status as "open" | "closed" | "paid",
    paidAt: p.paidAt ? p.paidAt.toISOString() : null,
  }))
}
