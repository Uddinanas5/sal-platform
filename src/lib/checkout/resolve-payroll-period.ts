import type { Prisma } from "@/generated/prisma"

export class CommissionPeriodClosedError extends Error {
  constructor(
    public payload: {
      businessId: string
      periodId: string
      periodStart: Date
      periodEnd: Date
      status: "closed" | "paid"
    },
  ) {
    super(`Payroll period ${payload.periodId} is ${payload.status}`)
    this.name = "CommissionPeriodClosedError"
  }
}

export class NoPayrollPeriodError extends Error {
  constructor(public payload: { businessId: string; localDate: string }) {
    super(`No payroll period configured for ${payload.businessId} on ${payload.localDate}`)
    this.name = "NoPayrollPeriodError"
  }
}

export type ResolvedPayrollPeriod = {
  id: string
  periodStart: Date
  periodEnd: Date
}

// Returns the business-local calendar date for an instant, formatted YYYY-MM-DD.
// Intl gives us tz-aware date parts without pulling in a date library; the
// `en-CA` locale happens to format as ISO date so we parse the parts directly.
function localDateString(instant: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant)
  const get = (type: string) => parts.find((p) => p.type === type)?.value
  return `${get("year")}-${get("month")}-${get("day")}`
}

/**
 * Resolves the PayrollPeriod a checkout at `checkoutAt` falls into, scoped to
 * the business's local calendar (not UTC). Throws if the matching period is
 * closed/paid, or if no period exists for that local date.
 *
 * The throw shape encodes the invariant per GAP-037: commissions cannot be
 * appended to a non-open period. Callers (record-checkout, batch jobs) get a
 * typed signal to surface "period locked" vs. "period missing" — different
 * remediation paths.
 */
export async function resolvePayrollPeriod(
  tx: Prisma.TransactionClient,
  businessId: string,
  checkoutAt: Date,
): Promise<ResolvedPayrollPeriod> {
  const business = await tx.business.findUnique({
    where: { id: businessId },
    select: { timezone: true },
  })
  const timezone = business?.timezone ?? "UTC"
  const localDate = localDateString(checkoutAt, timezone)

  // `@db.Date` columns compare by calendar date — passing a YYYY-MM-DD string
  // through Prisma works because pg coerces it to a `date`.
  const period = await tx.payrollPeriod.findFirst({
    where: {
      businessId,
      periodStart: { lte: new Date(`${localDate}T00:00:00.000Z`) },
      periodEnd: { gte: new Date(`${localDate}T00:00:00.000Z`) },
    },
    select: { id: true, periodStart: true, periodEnd: true, status: true },
  })

  if (!period) {
    throw new NoPayrollPeriodError({ businessId, localDate })
  }

  if (period.status !== "open") {
    throw new CommissionPeriodClosedError({
      businessId,
      periodId: period.id,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      status: period.status as "closed" | "paid",
    })
  }

  return {
    id: period.id,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
  }
}
