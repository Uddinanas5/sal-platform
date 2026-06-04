import { describe, it, expect, beforeEach, vi } from "vitest"
import { recordCheckout } from "@/lib/checkout/record-checkout"

// P0 money bug guard: the LIVE checkout paths (dashboard processPayment + the
// v1 route) both delegate writes to recordCheckout, which MUST write a
// Commission ledger row per appointment service. Before this fix the live paths
// wrote a Payment but never a Commission, so production recorded $0 commission
// and payroll was permanently empty.
//
// These are pure unit tests over a fake Prisma tx — no DB. The first group lets
// resolvePayrollPeriod run for real against the fake tx (covering the
// "create an open period if none exists" bootstrap). The mock data below mirrors
// the exact select shapes recordCheckout issues.

const BIZ = "11111111-1111-4111-8111-111111111111"
const SVC = "22222222-2222-4222-8222-222222222222"
const CLIENT = "44444444-4444-4444-8444-444444444444"
const APPT = "55555555-5555-4555-8555-555555555555"
const APPT_SVC = "66666666-6666-4666-8666-666666666666"
const STAFF = "77777777-7777-4777-8777-777777777777"

type PayrollRow = { id: string; periodStart: Date; periodEnd: Date; status: string }

type TxOptions = {
  // Existing open payroll period rows the resolver will find. Empty array means
  // "no period exists yet" → recordCheckout must create one.
  payrollPeriods?: PayrollRow[]
  staffCommissionRate?: number
  staffServiceOverride?: number | null // null = no StaffService row
  finalPrice?: number
}

function fakeTx(o: TxOptions = {}) {
  const periods: PayrollRow[] = o.payrollPeriods ?? []
  const finalPrice = o.finalPrice ?? 60

  const appointmentServices = [
    {
      id: APPT_SVC,
      serviceId: SVC,
      staffId: STAFF,
      finalPrice,
      staff: { commissionRate: o.staffCommissionRate ?? 30 },
    },
  ]

  const staffServices =
    o.staffServiceOverride === undefined || o.staffServiceOverride === null
      ? []
      : [{ staffId: STAFF, serviceId: SVC, commissionRate: o.staffServiceOverride }]

  const tx = {
    service: { findMany: vi.fn(async () => [{ id: SVC, price: finalPrice }]) },
    product: { findMany: vi.fn(async () => []) },
    appointment: {
      findFirst: vi.fn(async () => ({ clientId: CLIENT, services: appointmentServices })),
      update: vi.fn(async () => ({})),
    },
    client: {
      // loyaltyPoints is read for redeem validation; 0 here since these tests
      // don't redeem (earn path still fires and writes a loyaltyTransaction).
      findFirst: vi.fn(async () => ({ id: CLIENT, loyaltyPoints: 0 })),
      update: vi.fn(async () => ({})),
    },
    payment: {
      create: vi.fn(async () => ({ id: "pay_1", paymentReference: "PAY-X" })),
    },
    productInventory: { findFirst: vi.fn(async () => null), update: vi.fn() },
    staffService: { findMany: vi.fn(async () => staffServices) },
    commission: { create: vi.fn(async () => ({ id: "com_1" })) },
    loyaltyTransaction: { create: vi.fn(async () => ({ id: "loy_1" })) },
    business: { findUnique: vi.fn(async () => ({ timezone: "UTC" })) },
    payrollPeriod: {
      // Mimic the resolver's findFirst(lte/gte) against the in-memory rows.
      findFirst: vi.fn(async () => periods.find((p) => p.status !== undefined) ?? null),
      create: vi.fn(async (args: { data: PayrollRow }) => {
        const row: PayrollRow = {
          id: "pp_created",
          periodStart: args.data.periodStart,
          periodEnd: args.data.periodEnd,
          status: args.data.status,
        }
        periods.push(row)
        return row
      }),
    },
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return tx as any
}

const apptInput = (extra?: Record<string, unknown>) => ({
  clientId: CLIENT,
  appointmentId: APPT,
  items: [{ type: "service" as const, id: SVC, quantity: 1 }],
  discount: 0,
  tax: 0,
  tip: 0,
  method: "cash" as const,
  ...extra,
})

beforeEach(() => vi.clearAllMocks())

describe("recordCheckout — writes a Commission row on a dashboard checkout", () => {
  it("records ONE Commission per appointment service at the staff default rate", async () => {
    const tx = fakeTx({ staffCommissionRate: 30, finalPrice: 60 })

    await recordCheckout(tx, BIZ, apptInput())

    expect(tx.commission.create).toHaveBeenCalledTimes(1)
    const row = tx.commission.create.mock.calls[0][0].data
    // gross = finalPrice 60, rate 30% → commission 18.00
    expect(row.staffId).toBe(STAFF)
    expect(row.appointmentId).toBe(APPT)
    expect(row.type).toBe("service")
    expect(row.referenceType).toBe("appointment_service")
    expect(row.referenceId).toBe(APPT_SVC)
    expect(Number(row.grossAmount)).toBe(60)
    expect(Number(row.commissionRate)).toBe(30)
    expect(Number(row.commissionAmount)).toBe(18)
    expect(row.status).toBe("pending")
  })

  it("prefers a per-service StaffService commission override over the staff default", async () => {
    const tx = fakeTx({ staffCommissionRate: 30, staffServiceOverride: 50, finalPrice: 40 })

    await recordCheckout(tx, BIZ, apptInput())

    const row = tx.commission.create.mock.calls[0][0].data
    // override 50% of gross 40 = 20.00
    expect(Number(row.commissionRate)).toBe(50)
    expect(Number(row.commissionAmount)).toBe(20)
  })

  it("records a 0 commission (never a fake default rate) when the staff rate is 0", async () => {
    const tx = fakeTx({ staffCommissionRate: 0, finalPrice: 80 })

    await recordCheckout(tx, BIZ, apptInput())

    expect(tx.commission.create).toHaveBeenCalledTimes(1)
    const row = tx.commission.create.mock.calls[0][0].data
    expect(Number(row.commissionRate)).toBe(0)
    expect(Number(row.commissionAmount)).toBe(0)
  })

  it("bootstraps an OPEN payroll period when none exists, then still writes the commission", async () => {
    // No existing periods → resolver throws NoPayrollPeriodError → recordCheckout
    // creates a default monthly period and retries.
    const tx = fakeTx({ payrollPeriods: [], staffCommissionRate: 30, finalPrice: 60 })

    await recordCheckout(tx, BIZ, apptInput())

    expect(tx.payrollPeriod.create).toHaveBeenCalledTimes(1)
    const created = tx.payrollPeriod.create.mock.calls[0][0].data
    expect(created.businessId).toBe(BIZ)
    expect(created.status).toBe("open")
    // And the commission is still recorded against the freshly-created period.
    expect(tx.commission.create).toHaveBeenCalledTimes(1)
    const row = tx.commission.create.mock.calls[0][0].data
    expect(row.periodStart).toEqual(created.periodStart)
    expect(row.periodEnd).toEqual(created.periodEnd)
  })

  it("writes both the Payment AND the Commission inside the same call (no Payment-without-Commission)", async () => {
    const tx = fakeTx({ staffCommissionRate: 30 })

    await recordCheckout(tx, BIZ, apptInput())

    expect(tx.payment.create).toHaveBeenCalledTimes(1)
    expect(tx.commission.create).toHaveBeenCalledTimes(1)
  })
})
