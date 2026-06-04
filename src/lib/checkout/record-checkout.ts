import { randomBytes } from "node:crypto"
import type { Prisma } from "@/generated/prisma"
import {
  NoPayrollPeriodError,
  resolvePayrollPeriod,
  type ResolvedPayrollPeriod,
} from "./resolve-payroll-period"

export class RecordCheckoutError extends Error {
  constructor(public code: "BAD_REQUEST" | "NOT_FOUND" | "INVARIANT_FAILED", message: string) {
    super(message)
    this.name = "RecordCheckoutError"
  }
}

export type RecordCheckoutInput = {
  clientId?: string
  appointmentId?: string
  items: { type: "service" | "product"; id: string; quantity: number }[]
  discount: number
  tax: number
  tip: number
  method: "cash" | "card" | "online" | "gift_card" | "other"
}

export type RecordCheckoutResult = {
  payment: { id: string; paymentReference: string }
  commissions: { id: string }[]
  subtotal: number
  amount: number
  total: number
}

function generatePaymentReference(): string {
  const now = new Date()
  const yyyymmdd = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}`
  const suffix = randomBytes(4).toString("hex").toUpperCase()
  return `PAY-${yyyymmdd}-${suffix}`
}

// Business-local calendar date (YYYY-MM-DD) for an instant. Mirrors the helper
// in resolve-payroll-period.ts (which is private there); kept tiny + dependency
// free so a missing payroll period can be bootstrapped without a date library.
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
 * Resolve the OPEN PayrollPeriod a checkout falls into, creating a default
 * monthly period at runtime if none exists yet (no migration — uses the
 * existing PayrollPeriod model). This is what lets the first-ever checkout of a
 * business record commissions instead of failing on a missing period.
 *
 * `resolvePayrollPeriod` deliberately throws `NoPayrollPeriodError` when no
 * period exists; we catch only that case and bootstrap a calendar-month period
 * (business-local), then re-resolve so the closed/paid invariant still runs. A
 * `CommissionPeriodClosedError` from a manually closed period is NOT swallowed —
 * it bubbles up and rolls the transaction back, same as before.
 */
async function ensureOpenPayrollPeriod(
  tx: Prisma.TransactionClient,
  businessId: string,
  checkoutAt: Date,
): Promise<ResolvedPayrollPeriod> {
  try {
    return await resolvePayrollPeriod(tx, businessId, checkoutAt)
  } catch (err) {
    if (!(err instanceof NoPayrollPeriodError)) throw err

    const business = await tx.business.findUnique({
      where: { id: businessId },
      select: { timezone: true },
    })
    const timezone = business?.timezone ?? "UTC"
    const localDate = localDateString(checkoutAt, timezone)
    const [year, month] = localDate.split("-").map(Number)
    // First..last day of the business-local calendar month, stored as @db.Date.
    const periodStart = new Date(Date.UTC(year, month - 1, 1))
    const periodEnd = new Date(Date.UTC(year, month, 0))

    await tx.payrollPeriod.create({
      data: {
        businessId,
        periodStart,
        periodEnd,
        status: "open",
        notes: "Auto-created at checkout (no open period existed).",
      },
    })

    // Re-resolve so the standard closed/paid guard and date-scoping run against
    // the row we just inserted (single source of truth for the bounds).
    return await resolvePayrollPeriod(tx, businessId, checkoutAt)
  }
}

/**
 * Single writer for checkout side-effects (Payment + appointment status flip +
 * client totals bump + product inventory decrement + Commission ledger rows).
 *
 * Used by the dashboard `processPayment` action, the `/api/v1/checkout` route,
 * and the MCP `process-checkout` tool. See GAP-037 in execution/fresha-gaps.md.
 *
 * Prices are re-fetched from the DB inside this helper — caller-supplied
 * prices/subtotals are ignored (GAP-034).
 */
export async function recordCheckout(
  tx: Prisma.TransactionClient,
  businessId: string,
  data: RecordCheckoutInput,
): Promise<RecordCheckoutResult> {
  const serviceIds = Array.from(new Set(data.items.filter((i) => i.type === "service").map((i) => i.id)))
  const productIds = Array.from(new Set(data.items.filter((i) => i.type === "product").map((i) => i.id)))

  const [services, products] = await Promise.all([
    serviceIds.length
      ? tx.service.findMany({
          where: { id: { in: serviceIds }, businessId, deletedAt: null },
          select: { id: true, price: true },
        })
      : Promise.resolve([] as { id: string; price: Prisma.Decimal }[]),
    productIds.length
      ? tx.product.findMany({
          where: { id: { in: productIds }, businessId, deletedAt: null },
          select: { id: true, retailPrice: true },
        })
      : Promise.resolve([] as { id: string; retailPrice: Prisma.Decimal }[]),
  ])

  if (services.length !== serviceIds.length) throw new RecordCheckoutError("NOT_FOUND", "One or more services not found")
  if (products.length !== productIds.length) throw new RecordCheckoutError("NOT_FOUND", "One or more products not found")

  const priceMap = new Map<string, number>()
  for (const s of services) priceMap.set(`service:${s.id}`, Number(s.price))
  for (const p of products) priceMap.set(`product:${p.id}`, Number(p.retailPrice))

  let subtotal = 0
  for (const item of data.items) {
    const price = priceMap.get(`${item.type}:${item.id}`)
    if (price === undefined) throw new RecordCheckoutError("BAD_REQUEST", "Invalid item")
    subtotal += price * item.quantity
  }
  subtotal = Math.round(subtotal * 100) / 100

  if (data.discount > subtotal) throw new RecordCheckoutError("BAD_REQUEST", "Discount cannot exceed subtotal")
  const amount = Math.round((subtotal - data.discount) * 100) / 100
  const total = Math.round((amount + data.tax + data.tip) * 100) / 100

  let resolvedClientId: string | undefined = data.clientId
  let appointmentServices: {
    id: string
    serviceId: string
    staffId: string
    finalPrice: Prisma.Decimal
    staff: { commissionRate: Prisma.Decimal }
  }[] = []

  if (data.appointmentId) {
    const appt = await tx.appointment.findFirst({
      where: { id: data.appointmentId, businessId },
      select: {
        clientId: true,
        services: {
          select: {
            id: true,
            serviceId: true,
            staffId: true,
            finalPrice: true,
            staff: { select: { commissionRate: true } },
          },
        },
      },
    })
    if (!appt) throw new RecordCheckoutError("NOT_FOUND", "Appointment not found")
    if (data.clientId && appt.clientId && appt.clientId !== data.clientId) {
      throw new RecordCheckoutError("BAD_REQUEST", "Appointment does not belong to this client")
    }
    if (!resolvedClientId && appt.clientId) resolvedClientId = appt.clientId
    appointmentServices = appt.services
  }

  if (resolvedClientId) {
    const client = await tx.client.findFirst({
      where: { id: resolvedClientId, businessId },
      select: { id: true },
    })
    if (!client) throw new RecordCheckoutError("NOT_FOUND", "Client not found")
  }

  // Per-line commission resolution (AC 12): StaffService override → Staff default.
  // Staff.commissionRate is non-null (default 0); zero is a legitimate value
  // (e.g. salaried roles), not a "missing config" signal — so no further fallback.
  type CommissionCommit = {
    appointmentServiceId: string
    staffId: string
    grossAmount: number
    commissionRate: number
  }
  const commits: CommissionCommit[] = []
  if (appointmentServices.length > 0) {
    const staffServices = await tx.staffService.findMany({
      where: {
        OR: appointmentServices.map((as) => ({ staffId: as.staffId, serviceId: as.serviceId })),
      },
      select: { staffId: true, serviceId: true, commissionRate: true },
    })
    const overrideMap = new Map<string, Prisma.Decimal | null>()
    for (const ss of staffServices) overrideMap.set(`${ss.staffId}:${ss.serviceId}`, ss.commissionRate)

    for (const as of appointmentServices) {
      const override = overrideMap.get(`${as.staffId}:${as.serviceId}`)
      const commissionRate = Number(override ?? as.staff.commissionRate)
      commits.push({
        appointmentServiceId: as.id,
        staffId: as.staffId,
        grossAmount: Number(as.finalPrice),
        commissionRate,
      })
    }
  }

  const payment = await tx.payment.create({
    data: {
      businessId,
      clientId: resolvedClientId ?? null,
      appointmentId: data.appointmentId ?? null,
      paymentReference: generatePaymentReference(),
      type: "payment",
      method: data.method,
      status: "completed",
      amount,
      tipAmount: data.tip,
      totalAmount: total,
      currency: "USD",
      processedAt: new Date(),
    },
  })

  if (data.appointmentId) {
    await tx.appointment.update({
      where: { id: data.appointmentId, businessId },
      data: { status: "completed", completedAt: new Date() },
    })
  }

  if (resolvedClientId) {
    await tx.client.update({
      where: { id: resolvedClientId, businessId },
      data: {
        totalSpent: { increment: amount },
        totalVisits: { increment: 1 },
        lastVisitAt: new Date(),
        loyaltyPoints: { increment: Math.floor(amount) },
      },
    })
  }

  for (const item of data.items) {
    if (item.type !== "product") continue
    const inv = await tx.productInventory.findFirst({
      where: { productId: item.id, product: { businessId } },
    })
    if (inv) {
      await tx.productInventory.update({
        where: { id: inv.id },
        data: { quantity: { decrement: item.quantity } },
      })
    }
  }

  // Resolve the OPEN PayrollPeriod this checkout falls into (business-local
  // date, not UTC), creating a default monthly period if none exists yet. A
  // manually closed/paid period still throws `CommissionPeriodClosedError`,
  // which bubbles up and rolls the tx back.
  const period = await ensureOpenPayrollPeriod(tx, businessId, new Date())
  const periodStart = period.periodStart
  const periodEnd = period.periodEnd

  const commissions: { id: string }[] = []
  for (const c of commits) {
    // AC 14: single-expression compute, no intermediate variables. Same
    // `c.commissionRate` snapshotted into the row.
    const commissionAmount = Math.round((c.grossAmount * c.commissionRate) / 100 * 100) / 100
    // AC 14 invariant: amount must reconcile with the snapshotted rate at insert time.
    if (Math.abs(commissionAmount - (c.grossAmount * c.commissionRate) / 100) >= 0.005) {
      throw new RecordCheckoutError(
        "INVARIANT_FAILED",
        `Commission invariant tripped (staff=${c.staffId} gross=${c.grossAmount} rate=${c.commissionRate} amount=${commissionAmount})`,
      )
    }
    const row = await tx.commission.create({
      data: {
        staffId: c.staffId,
        appointmentId: data.appointmentId ?? null,
        type: "service",
        referenceType: "appointment_service",
        referenceId: c.appointmentServiceId,
        grossAmount: c.grossAmount,
        commissionRate: c.commissionRate,
        commissionAmount,
        status: "pending",
        periodStart,
        periodEnd,
      },
      select: { id: true },
    })
    commissions.push(row)
  }

  return {
    payment: { id: payment.id, paymentReference: payment.paymentReference },
    commissions,
    subtotal,
    amount,
    total,
  }
}
