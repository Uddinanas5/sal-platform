import { randomBytes } from "node:crypto"
import type { Prisma } from "@/generated/prisma"
import {
  NoPayrollPeriodError,
  resolvePayrollPeriod,
  type ResolvedPayrollPeriod,
} from "./resolve-payroll-period"
import { POINTS_TO_DOLLARS, pointsEarnedFor } from "@/lib/loyalty"
import { lockClient, lockAppointment } from "@/lib/db/advisory-lock"
import { redeemGiftCardInTx } from "@/lib/checkout/gift-card-redeem"
import { TAX_RATE } from "@/lib/utils"

// Resolve a line's effective tax rate as a fraction (e.g. 0.08875). Tax is
// server-authoritative — never trusted from the caller. A non-taxable item is
// always 0; a taxable item uses its per-item taxRate (stored as a percentage,
// so /100), and falls back to the platform-wide flat TAX_RATE when no per-item
// rate is configured (taxRate is nullable and currently null for all beta data,
// so this fallback keeps the server total in lockstep with the UI estimate).
function taxRateFor(isTaxable: boolean, taxRate: Prisma.Decimal | null, defaultRate: number): number {
  if (!isTaxable) return 0
  if (taxRate == null) return defaultRate
  return Number(taxRate) / 100
}

// Read a business's configured checkout tax/currency settings (persisted by the
// Payments settings tab in Business.settings.payments). The recorded sale must
// honor these instead of a hardcoded platform rate. Falls back to the platform
// flat TAX_RATE / USD only when nothing is configured.
type CheckoutTaxConfig = {
  defaultRate: number
  taxOnServices: boolean
  taxOnProducts: boolean
  currency: string
}
function readTaxConfig(
  settings: unknown,
  currency: string | null | undefined,
): CheckoutTaxConfig {
  const payments = ((settings as Record<string, unknown>)?.payments ?? {}) as Record<string, unknown>
  const parsedRate = typeof payments.taxRate === "string" ? parseFloat(payments.taxRate) : Number(payments.taxRate)
  const defaultRate = Number.isFinite(parsedRate) && parsedRate >= 0 ? parsedRate / 100 : TAX_RATE
  return {
    defaultRate,
    taxOnServices: payments.taxOnServices !== false,
    taxOnProducts: payments.taxOnProducts !== false,
    currency: (currency || "USD").toUpperCase(),
  }
}

export class RecordCheckoutError extends Error {
  constructor(public code: "BAD_REQUEST" | "NOT_FOUND" | "INVARIANT_FAILED", message: string) {
    super(message)
    this.name = "RecordCheckoutError"
  }
}

// Ad-hoc "Quick Sale" line item: an operator-named, operator-priced row with no
// catalog entry behind it. UNLIKE service/product lines (whose price is always
// re-fetched from the DB, GAP-034), a custom line's `unitPrice` IS authoritative
// for that line ONLY — there is no DB row to recompute it from. It is still
// folded into the SAME server-computed subtotal/amount/tax/total so the recorded
// sale matches what the customer was charged (fixes the silent under-record where
// custom lines were dropped before the writer). Always treated as taxable at the
// platform-flat TAX_RATE so the books stay in lockstep with the UI estimate.
export type CustomCheckoutLine = {
  type: "custom"
  name: string
  unitPrice: number
  quantity: number
}

export type RecordCheckoutInput = {
  clientId?: string
  appointmentId?: string
  // `staffId` (optional, service lines only) attributes a walk-in / standalone
  // POS sale to the staff member who performed it, so commission is recorded even
  // when there is no appointment behind the sale. Ignored when appointmentId is
  // set (the appointment's own per-service staff assignment is authoritative).
  items: { type: "service" | "product"; id: string; quantity: number; staffId?: string }[]
  // Optional ad-hoc lines (Quick Sale). Folded into subtotal/tax/total/amount and
  // persisted in Payment.notes; never count toward inventory or commission.
  customItems?: CustomCheckoutLine[]
  discount: number
  // Caller-supplied tax is ACCEPTED for backward compat but IGNORED — tax is
  // recomputed server-side per line from the DB (isTaxable/taxRate), mirroring
  // how caller prices/subtotals are ignored (GAP-034). Kept here only so the
  // three entry points (dashboard action, /api/v1/checkout, MCP tool) compile
  // without churn; do not read it below.
  tax?: number
  tip: number
  method: "cash" | "card" | "online" | "gift_card" | "other"
  // Loyalty points the client wants to spend as a DISCOUNT (not a tender). The
  // dollar value is computed server-side from POINTS_TO_DOLLARS and capped at
  // the remaining subtotal; caller-supplied money is never trusted.
  redeemPoints?: number
  // Gift-card code to tender against when method === "gift_card". The card must
  // cover the FULL server-computed total (no partial/split redemption in beta);
  // balance is read + decremented server-side inside the same transaction.
  giftCardCode?: string
}

export type RecordCheckoutResult = {
  payment: { id: string; paymentReference: string }
  commissions: { id: string }[]
  subtotal: number
  amount: number
  total: number
  // Loyalty side-effects (server-authoritative): how many points were spent as
  // a discount, the dollar value of that discount, and how many were earned.
  loyalty: { redeemedPoints: number; redeemedAmount: number; earnedPoints: number }
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

  // Business-configured tax + currency (Payments settings), used as the default
  // tax rate for lines with no per-item override and to honor the per-category
  // tax toggles. Without this, every checkout used a hardcoded NYC rate / USD.
  const businessConfig = await tx.business.findUnique({
    where: { id: businessId },
    select: { settings: true, currency: true },
  })
  const taxConfig = readTaxConfig(businessConfig?.settings, businessConfig?.currency)

  const [services, products] = await Promise.all([
    serviceIds.length
      ? tx.service.findMany({
          where: { id: { in: serviceIds }, businessId, deletedAt: null },
          select: { id: true, price: true, taxRate: true, isTaxable: true },
        })
      : Promise.resolve([] as { id: string; price: Prisma.Decimal; taxRate: Prisma.Decimal | null; isTaxable: boolean }[]),
    productIds.length
      ? tx.product.findMany({
          where: { id: { in: productIds }, businessId, deletedAt: null },
          select: { id: true, name: true, retailPrice: true, taxRate: true, isTaxable: true },
        })
      : Promise.resolve([] as { id: string; name: string; retailPrice: Prisma.Decimal; taxRate: Prisma.Decimal | null; isTaxable: boolean }[]),
  ])

  if (services.length !== serviceIds.length) throw new RecordCheckoutError("NOT_FOUND", "One or more services not found")
  if (products.length !== productIds.length) throw new RecordCheckoutError("NOT_FOUND", "One or more products not found")

  // Per-item price + tax rate, taken from the DB (never the caller).
  const priceMap = new Map<string, { price: number; taxRate: number }>()
  for (const s of services)
    priceMap.set(`service:${s.id}`, {
      price: Number(s.price),
      taxRate: taxRateFor(s.isTaxable && taxConfig.taxOnServices, s.taxRate, taxConfig.defaultRate),
    })
  for (const p of products)
    priceMap.set(`product:${p.id}`, {
      price: Number(p.retailPrice),
      taxRate: taxRateFor(p.isTaxable && taxConfig.taxOnProducts, p.taxRate, taxConfig.defaultRate),
    })

  // Product detail lookup (name + unit price) for writing the AppointmentProduct
  // line at checkout — sourced from the DB, never the caller.
  const productMap = new Map<string, { name: string; retailPrice: number }>()
  for (const p of products) productMap.set(p.id, { name: p.name, retailPrice: Number(p.retailPrice) })

  // Per-line amounts carry their own tax rate so the final tax can be applied
  // to the DISCOUNTED base proportionally (a discount lowers every line's
  // taxable share by the same fraction).
  const lines: { amount: number; taxRate: number }[] = []
  let subtotal = 0
  for (const item of data.items) {
    const entry = priceMap.get(`${item.type}:${item.id}`)
    if (entry === undefined) throw new RecordCheckoutError("BAD_REQUEST", "Invalid item")
    const lineAmount = Math.round(entry.price * item.quantity * 100) / 100
    lines.push({ amount: lineAmount, taxRate: entry.taxRate })
    subtotal += lineAmount
  }

  // Ad-hoc "Quick Sale" lines. The unitPrice is authoritative for THIS line only
  // (no catalog row to recompute from) — but it is still validated and folded
  // into the same server subtotal/tax/total so the recorded sale equals the cash
  // collected. Treated as taxable at the platform-flat TAX_RATE, matching the UI.
  const customItems = data.customItems ?? []
  const customNotes: string[] = []
  for (const c of customItems) {
    if (!Number.isFinite(c.unitPrice) || c.unitPrice < 0) {
      throw new RecordCheckoutError("BAD_REQUEST", "Custom item price must be zero or greater")
    }
    if (!Number.isInteger(c.quantity) || c.quantity <= 0) {
      throw new RecordCheckoutError("BAD_REQUEST", "Custom item quantity must be a positive integer")
    }
    const lineAmount = Math.round(c.unitPrice * c.quantity * 100) / 100
    lines.push({ amount: lineAmount, taxRate: taxConfig.defaultRate })
    subtotal += lineAmount
    const name = c.name.trim() || "Quick Sale"
    customNotes.push(`${name} x${c.quantity} @ ${c.unitPrice.toFixed(2)} = ${lineAmount.toFixed(2)}`)
  }

  subtotal = Math.round(subtotal * 100) / 100

  // Discount is capped against the FULL subtotal (catalog + custom), so a mixed
  // cart with a legitimate discount no longer hard-fails just because the custom
  // lines were excluded from the comparison base.
  if (data.discount > subtotal) throw new RecordCheckoutError("BAD_REQUEST", "Discount cannot exceed subtotal")

  let resolvedClientId: string | undefined = data.clientId
  let appointmentServices: {
    id: string
    serviceId: string
    staffId: string
    finalPrice: Prisma.Decimal
    staff: { commissionRate: Prisma.Decimal }
  }[] = []

  if (data.appointmentId) {
    // Serialize concurrent checkouts of the SAME appointment, then re-verify
    // inside the lock that it has not already been completed/paid. The action's
    // pre-transaction guard (actions/checkout.ts) is only a fast-fail; without
    // this in-tx re-check two requests could both pass it and double-record the
    // sale (TOCTOU). The lock + re-read here is the authoritative guard.
    await lockAppointment(tx, businessId, data.appointmentId)
    const existingPaid = await tx.payment.findFirst({
      where: { appointmentId: data.appointmentId, businessId, type: "payment", status: "completed" },
      select: { id: true },
    })
    if (existingPaid) {
      throw new RecordCheckoutError("BAD_REQUEST", "This appointment has already been paid.")
    }

    const appt = await tx.appointment.findFirst({
      where: { id: data.appointmentId, businessId },
      select: {
        clientId: true,
        status: true,
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
    if (appt.status === "completed") {
      throw new RecordCheckoutError("BAD_REQUEST", "This appointment has already been checked out.")
    }
    if (data.clientId && appt.clientId && appt.clientId !== data.clientId) {
      throw new RecordCheckoutError("BAD_REQUEST", "Appointment does not belong to this client")
    }
    if (!resolvedClientId && appt.clientId) resolvedClientId = appt.clientId
    appointmentServices = appt.services
  }

  // Resolve the client (scoped to this business — multi-tenant isolation) and
  // snapshot its loyalty balance so redemption can be validated server-side.
  let clientLoyaltyPoints = 0
  if (resolvedClientId) {
    // Serialize concurrent checkouts for the SAME client so the loyalty
    // read → validate → decrement below is atomic (no over-redemption race
    // that could drive loyaltyPoints negative). Released on commit/rollback.
    await lockClient(tx, businessId, resolvedClientId)
    const client = await tx.client.findFirst({
      where: { id: resolvedClientId, businessId },
      select: { id: true, loyaltyPoints: true },
    })
    if (!client) throw new RecordCheckoutError("NOT_FOUND", "Client not found")
    clientLoyaltyPoints = client.loyaltyPoints
  }

  // --- Loyalty REDEMPTION (a discount, NOT a tender) -----------------------
  // Validate server-side against the snapshotted balance, convert points to
  // dollars at the defined rate, and cap so manualDiscount + redeemDiscount can
  // never exceed the subtotal. Caller-supplied money is ignored entirely.
  const requestedRedeem = Math.floor(Math.max(0, data.redeemPoints ?? 0))
  let redeemedPoints = 0
  let redeemedAmount = 0
  if (requestedRedeem > 0) {
    if (!resolvedClientId) {
      throw new RecordCheckoutError("BAD_REQUEST", "Cannot redeem loyalty points without a client")
    }
    if (requestedRedeem > clientLoyaltyPoints) {
      throw new RecordCheckoutError("BAD_REQUEST", "Insufficient loyalty points")
    }
    const remainingAfterManualDiscount = Math.round((subtotal - data.discount) * 100) / 100
    // Most points that could be spent given the dollars still left to discount.
    // (subtotal*100) / (POINTS_TO_DOLLARS*100) keeps the division in integer
    // cents so floating-point can't shave the cap by a point.
    const maxRedeemableByDollars = Math.floor(
      Math.round(remainingAfterManualDiscount * 100) / Math.round(POINTS_TO_DOLLARS * 100),
    )
    redeemedPoints = Math.min(requestedRedeem, maxRedeemableByDollars)
    redeemedAmount = Math.round(redeemedPoints * POINTS_TO_DOLLARS * 100) / 100
    // Floating-point guard: never let the redeem dollars push past what remains.
    if (redeemedAmount > remainingAfterManualDiscount) {
      redeemedAmount = remainingAfterManualDiscount
    }
  }

  const totalDiscount = Math.round((data.discount + redeemedAmount) * 100) / 100
  const amount = Math.round((subtotal - totalDiscount) * 100) / 100

  // Server-authoritative tax: compute per line on the DISCOUNTED base. Each
  // line keeps the same proportional share of the post-discount amount it had
  // of the subtotal, then is taxed at its own rate. Caller-supplied `data.tax`
  // is ignored entirely (mirrors GAP-034 price authority).
  const tax =
    Math.round(
      lines.reduce((sum, line) => {
        const lineShare = subtotal > 0 ? line.amount / subtotal : 0
        return sum + amount * lineShare * line.taxRate
      }, 0) * 100,
    ) / 100
  const total = Math.round((amount + tax + data.tip) * 100) / 100

  // --- Gift card REDEMPTION (a TENDER for the full total) -------------------
  // When the customer pays by gift card we redeem it INSIDE this transaction,
  // after the server-authoritative total is known. The card must cover the
  // FULL total — there is no partial/split redemption in beta (a partial
  // tender would need a second tender we don't collect yet). redeemGiftCardInTx
  // takes an advisory lock on (businessId, code), re-reads the balance under it,
  // verifies it covers `total`, and decrements (deactivating + stamping
  // redeemedAt when it zeroes out). It throws a typed GiftCardError on
  // not-found/expired/insufficient, rolling the whole checkout back so no
  // Payment is recorded against a card that wasn't actually charged. The masked
  // code (last 4) is persisted in Payment.methodNote (the honest sub-tender
  // note field added in GAP-037 — NOT cardLastFour, which is card-brand only).
  let giftCardNote: string | null = null
  if (data.method === "gift_card") {
    if (!data.giftCardCode) {
      throw new RecordCheckoutError("BAD_REQUEST", "A gift card code is required to pay by gift card")
    }
    const redemption = await redeemGiftCardInTx(tx, businessId, data.giftCardCode, total)
    giftCardNote = redemption.maskedCode
  }

  // Per-line commission resolution (AC 12): StaffService override → Staff default.
  // Staff.commissionRate is non-null (default 0); zero is a legitimate value
  // (e.g. salaried roles), not a "missing config" signal — so no further fallback.
  type CommissionCommit = {
    referenceType: string
    referenceId: string
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
        referenceType: "appointment_service",
        referenceId: as.id,
        staffId: as.staffId,
        grossAmount: Number(as.finalPrice),
        commissionRate,
      })
    }
  } else {
    // Walk-in / standalone POS: no appointment, so attribute commission per
    // service line to the staff member chosen in the cart. Only service lines
    // with a staffId produce commission (a sale with no assigned staff records
    // none, same as before). Staff must be active in THIS business (tenant +
    // existence check); rate is the StaffService override else Staff default.
    const staffServiceLines = data.items.filter(
      (i): i is typeof i & { staffId: string } => i.type === "service" && typeof i.staffId === "string",
    )
    if (staffServiceLines.length > 0) {
      const staffIds = Array.from(new Set(staffServiceLines.map((i) => i.staffId)))
      const validStaff = await tx.staff.findMany({
        where: { id: { in: staffIds }, isActive: true, deletedAt: null, primaryLocation: { businessId } },
        select: { id: true, commissionRate: true },
      })
      const staffMap = new Map(validStaff.map((s) => [s.id, s.commissionRate]))
      const overrides = await tx.staffService.findMany({
        where: { OR: staffServiceLines.map((i) => ({ staffId: i.staffId, serviceId: i.id })) },
        select: { staffId: true, serviceId: true, commissionRate: true },
      })
      const overrideMap = new Map<string, Prisma.Decimal | null>()
      for (const ss of overrides) overrideMap.set(`${ss.staffId}:${ss.serviceId}`, ss.commissionRate)

      for (const line of staffServiceLines) {
        const staffDefault = staffMap.get(line.staffId)
        if (staffDefault === undefined) {
          throw new RecordCheckoutError("BAD_REQUEST", "Assigned staff is not part of this business")
        }
        const servicePrice = priceMap.get(`service:${line.id}`)?.price ?? 0
        const override = overrideMap.get(`${line.staffId}:${line.id}`)
        commits.push({
          referenceType: "service",
          referenceId: line.id,
          staffId: line.staffId,
          grossAmount: Math.round(servicePrice * line.quantity * 100) / 100,
          commissionRate: Number(override ?? staffDefault),
        })
      }
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
      // Masked gift-card code (last 4) for gift_card tenders; null otherwise.
      methodNote: giftCardNote,
      status: "completed",
      amount,
      tipAmount: data.tip,
      totalAmount: total,
      currency: taxConfig.currency,
      // Persist ad-hoc Quick Sale lines so the recorded sale is auditable (the
      // catalog lines are reconstructable from the appointment/products; custom
      // lines have no catalog row, so their detail lives here).
      notes: customNotes.length > 0 ? `Quick Sale items:\n${customNotes.join("\n")}` : null,
      processedAt: new Date(),
    },
  })

  if (data.appointmentId) {
    await tx.appointment.update({
      where: { id: data.appointmentId, businessId },
      data: { status: "completed", completedAt: new Date() },
    })
  }

  // --- Loyalty EARN + ledger (same tx, idempotent within this checkout) -----
  // Earn 1 pt per $1 actually paid (post-discount, pre-tax/tip). The Client
  // balance moves by the NET of this checkout (earned − redeemed) in a single
  // update, and every movement is recorded in the LoyaltyTransaction ledger so
  // the balance is always reconstructable. Skipped entirely when no client.
  const earnedPoints = pointsEarnedFor(amount)
  if (resolvedClientId) {
    const netPointsDelta = earnedPoints - redeemedPoints
    await tx.client.update({
      where: { id: resolvedClientId, businessId },
      data: {
        totalSpent: { increment: amount },
        totalVisits: { increment: 1 },
        lastVisitAt: new Date(),
        loyaltyPoints: { increment: netPointsDelta },
      },
    })

    if (redeemedPoints > 0) {
      await tx.loyaltyTransaction.create({
        data: {
          businessId,
          clientId: resolvedClientId,
          points: -redeemedPoints,
          type: "redeem",
          reason: `Redeemed ${redeemedPoints} pts ($${redeemedAmount.toFixed(2)}) at checkout`,
          paymentId: payment.id,
          appointmentId: data.appointmentId ?? null,
        },
      })
    }

    if (earnedPoints > 0) {
      await tx.loyaltyTransaction.create({
        data: {
          businessId,
          clientId: resolvedClientId,
          points: earnedPoints,
          type: "earn",
          reason: `Earned ${earnedPoints} pts on $${amount.toFixed(2)} purchase`,
          paymentId: payment.id,
          appointmentId: data.appointmentId ?? null,
        },
      })
    }
  }

  for (const item of data.items) {
    if (item.type !== "product") continue

    // Persist a product-sale line so reports reconcile product revenue with the
    // Payment ledger and the inventory decrement (before this, product sales
    // wrote no line, so reports.ts product revenue was structurally always $0
    // and folded into serviceRevenue). unitPrice/totalPrice are DB-sourced (the
    // same authoritative retailPrice used to build the line above) — never the
    // caller. appointmentId is nullable so a standalone (walk-in / POS) product
    // sale is still recorded; businessId scoping for reports flows through the
    // product relation. The line carries the gross (pre-discount, pre-tax) total,
    // matching how AppointmentService.finalPrice feeds service revenue.
    const prod = productMap.get(item.id)
    if (prod) {
      const lineTotal = Math.round(prod.retailPrice * item.quantity * 100) / 100
      await tx.appointmentProduct.create({
        data: {
          appointmentId: data.appointmentId ?? null,
          paymentId: payment.id,
          productId: item.id,
          name: prod.name,
          quantity: item.quantity,
          unitPrice: prod.retailPrice,
          totalPrice: lineTotal,
        },
      })
    }

    const inv = await tx.productInventory.findFirst({
      where: { productId: item.id, product: { businessId } },
      select: { id: true, locationId: true },
    })
    if (inv) {
      // Guarded atomic decrement with a zero floor: only decrement if enough
      // stock remains, so concurrent sales can't drive quantity negative. Record
      // an InventoryTransaction 'sale' row so the ledger keeps reconciling with
      // ProductInventory.quantity (the whole point of the ledger).
      const dec = await tx.productInventory.updateMany({
        where: { id: inv.id, quantity: { gte: item.quantity } },
        data: { quantity: { decrement: item.quantity } },
      })
      if (dec.count > 0) {
        const after = await tx.productInventory.findUnique({
          where: { id: inv.id },
          select: { quantity: true },
        })
        await tx.inventoryTransaction.create({
          data: {
            productId: item.id,
            locationId: inv.locationId,
            type: "sale",
            quantityChange: -item.quantity,
            quantityAfter: after?.quantity ?? 0,
            notes: `Sold at checkout (payment ${payment.paymentReference})`,
          },
        })
      }
      // If dec.count === 0 the product is out of stock; the sale still completes
      // (service businesses routinely sell display/last items) but we don't push
      // the counter negative or write a misleading ledger row.
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
        referenceType: c.referenceType,
        referenceId: c.referenceId,
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
    loyalty: { redeemedPoints, redeemedAmount, earnedPoints },
  }
}
