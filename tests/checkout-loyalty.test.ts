import { describe, it, expect, beforeEach, vi } from "vitest"
import { recordCheckout, RecordCheckoutError } from "@/lib/checkout/record-checkout"

// Loyalty that actually EARNS and REDEEMS. recordCheckout is the single writer,
// so the ledger (LoyaltyTransaction) + Client.loyaltyPoints must move HERE,
// inside the same transaction as the Payment — never in a UI toast.
//
// Rates (src/lib/loyalty.ts): earn = floor($ paid), redeem = 100 pts → $1.00.
// All money is server-authoritative: redeem is a DISCOUNT (not a tender) and is
// capped at the remaining subtotal regardless of how many points are requested.
//
// Pure unit tests over a fake Prisma tx — no DB. Mirrors the select/create
// shapes recordCheckout issues, and asserts tenant scoping (every write carries
// the businessId passed to recordCheckout, and client lookups are business-scoped).

const BIZ = "11111111-1111-4111-8111-111111111111"
const OTHER_BIZ = "99999999-9999-4999-8999-999999999999"
const SVC = "22222222-2222-4222-8222-222222222222"
const CLIENT = "44444444-4444-4444-8444-444444444444"
const APPT = "55555555-5555-4555-8555-555555555555"
const APPT_SVC = "66666666-6666-4666-8666-666666666666"
const STAFF = "77777777-7777-4777-8777-777777777777"

type TxOptions = {
  finalPrice?: number
  clientPoints?: number // current Client.loyaltyPoints balance
  clientExists?: boolean // false → client lookup returns null (NOT_FOUND)
}

type PayrollRow = { id: string; periodStart: Date; periodEnd: Date; status: string }

function fakeTx(o: TxOptions = {}) {
  const finalPrice = o.finalPrice ?? 60
  const clientPoints = o.clientPoints ?? 0
  const clientExists = o.clientExists ?? true
  // Starts empty: no payroll period exists, so the writer bootstraps one. The
  // create mock pushes it here so the subsequent re-resolve findFirst finds it.
  const periods: PayrollRow[] = []

  const appointmentServices = [
    {
      id: APPT_SVC,
      serviceId: SVC,
      staffId: STAFF,
      finalPrice,
      staff: { commissionRate: 0 },
    },
  ]

  const tx = {
    $executeRaw: vi.fn(),
    service: { findMany: vi.fn(async () => [{ id: SVC, price: finalPrice }]) },
    product: { findMany: vi.fn(async () => []) },
    appointment: {
      findFirst: vi.fn(async () => ({ clientId: CLIENT, services: appointmentServices })),
      update: vi.fn(async () => ({})),
    },
    client: {
      // Tenant-scoped lookup: recordCheckout queries { id, businessId }. We honor
      // that here so a wrong businessId would surface as "client not found".
      findFirst: vi.fn(async (args: { where: { id: string; businessId: string } }) => {
        if (!clientExists) return null
        if (args.where.businessId !== BIZ) return null
        return { id: CLIENT, loyaltyPoints: clientPoints }
      }),
      update: vi.fn(async () => ({})),
    },
    payment: {
      create: vi.fn(async () => ({ id: "pay_1", paymentReference: "PAY-X" })),
    },
    productInventory: { findFirst: vi.fn(async () => null), update: vi.fn() },
    staffService: { findMany: vi.fn(async () => []) },
    commission: { create: vi.fn(async () => ({ id: "com_1" })) },
    loyaltyTransaction: { create: vi.fn(async () => ({ id: "loy_1" })) },
    business: { findUnique: vi.fn(async () => ({ timezone: "UTC" })) },
    payrollPeriod: {
      // No period exists yet, so recordCheckout bootstraps one and then
      // RE-RESOLVES it. The created row must therefore be visible to the second
      // findFirst, exactly like the live model — otherwise the re-resolve throws
      // NoPayrollPeriodError. Mirror the resolver's findFirst against in-memory rows.
      findFirst: vi.fn(async () => periods.find((p) => p.status !== undefined) ?? null),
      create: vi.fn(async (args: { data: { periodStart: Date; periodEnd: Date; status: string } }) => {
        const row = {
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

const baseInput = (extra?: Record<string, unknown>) => ({
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

describe("recordCheckout — loyalty EARN", () => {
  it("writes an earn ledger row and increments the client balance by floor(amount)", async () => {
    const tx = fakeTx({ finalPrice: 60, clientPoints: 0 })

    const res = await recordCheckout(tx, BIZ, baseInput())

    // 60 paid → 60 points earned, ledger row references the payment + appointment.
    expect(res.loyalty.earnedPoints).toBe(60)
    expect(tx.loyaltyTransaction.create).toHaveBeenCalledTimes(1)
    const earn = tx.loyaltyTransaction.create.mock.calls[0][0].data
    expect(earn.businessId).toBe(BIZ)
    expect(earn.clientId).toBe(CLIENT)
    expect(earn.type).toBe("earn")
    expect(earn.points).toBe(60)
    expect(earn.paymentId).toBe("pay_1")
    expect(earn.appointmentId).toBe(APPT)

    // Client balance moves by the NET (earn 60 − redeem 0) in the same update.
    const clientUpdate = tx.client.update.mock.calls[0][0]
    expect(clientUpdate.where).toEqual({ id: CLIENT, businessId: BIZ })
    expect(clientUpdate.data.loyaltyPoints).toEqual({ increment: 60 })
  })

  it("earns on the post-discount amount (floor), not the subtotal", async () => {
    // subtotal 60, manual discount 10.50 → amount 49.50 → floor → 49 points.
    const tx = fakeTx({ finalPrice: 60 })

    const res = await recordCheckout(tx, BIZ, baseInput({ discount: 10.5 }))

    expect(res.amount).toBe(49.5)
    expect(res.loyalty.earnedPoints).toBe(49)
  })

  it("skips all loyalty writes when there is no client", async () => {
    const tx = fakeTx({ finalPrice: 60 })
    // No clientId, and the appointment's client is also absent.
    tx.appointment.findFirst = vi.fn(async () => ({ clientId: null, services: [] }))

    const res = await recordCheckout(tx, BIZ, {
      ...baseInput(),
      clientId: undefined,
      appointmentId: undefined,
      items: [{ type: "service" as const, id: SVC, quantity: 1 }],
    })

    expect(res.loyalty.earnedPoints).toBe(60) // value still computed
    expect(tx.loyaltyTransaction.create).not.toHaveBeenCalled()
    expect(tx.client.update).not.toHaveBeenCalled()
  })
})

describe("recordCheckout — loyalty REDEEM (discount, not a tender)", () => {
  it("deducts points, writes a redeem row, and applies the dollar value as a discount", async () => {
    // 500 pts available, redeem 500 pts = $5.00 off a $60 subtotal.
    const tx = fakeTx({ finalPrice: 60, clientPoints: 500 })

    const res = await recordCheckout(tx, BIZ, baseInput({ redeemPoints: 500 }))

    expect(res.loyalty.redeemedPoints).toBe(500)
    expect(res.loyalty.redeemedAmount).toBe(5)
    // amount = 60 − 5 = 55, and earn is on the post-redeem amount → 55 pts.
    expect(res.amount).toBe(55)
    expect(res.loyalty.earnedPoints).toBe(55)

    // Two ledger rows: redeem (negative) then earn (positive).
    expect(tx.loyaltyTransaction.create).toHaveBeenCalledTimes(2)
    const redeem = tx.loyaltyTransaction.create.mock.calls[0][0].data
    expect(redeem.type).toBe("redeem")
    expect(redeem.points).toBe(-500)
    expect(redeem.businessId).toBe(BIZ)
    expect(redeem.paymentId).toBe("pay_1")

    // Net client delta = earn 55 − redeem 500 = -445.
    const clientUpdate = tx.client.update.mock.calls[0][0]
    expect(clientUpdate.data.loyaltyPoints).toEqual({ increment: -445 })
  })

  it("caps the redeemed dollars at the remaining subtotal (never goes negative)", async () => {
    // Client has 100000 pts ($1000) but subtotal is only $60. Cap at $60 = 6000 pts.
    const tx = fakeTx({ finalPrice: 60, clientPoints: 100000 })

    const res = await recordCheckout(tx, BIZ, baseInput({ redeemPoints: 100000 }))

    expect(res.loyalty.redeemedAmount).toBe(60)
    expect(res.loyalty.redeemedPoints).toBe(6000) // only enough to zero the subtotal
    expect(res.amount).toBe(0)
    expect(res.total).toBe(0)
    expect(res.loyalty.earnedPoints).toBe(0) // nothing paid → nothing earned
  })

  it("caps redemption against a manual discount already applied", async () => {
    // subtotal 60, manual discount 50 → $10 left. Redeeming 5000 pts ($50) caps at $10 (1000 pts).
    const tx = fakeTx({ finalPrice: 60, clientPoints: 5000 })

    const res = await recordCheckout(tx, BIZ, baseInput({ discount: 50, redeemPoints: 5000 }))

    expect(res.loyalty.redeemedAmount).toBe(10)
    expect(res.loyalty.redeemedPoints).toBe(1000)
    expect(res.amount).toBe(0)
  })

  it("rejects the whole checkout when the client lacks enough points", async () => {
    const tx = fakeTx({ finalPrice: 60, clientPoints: 100 })

    await expect(recordCheckout(tx, BIZ, baseInput({ redeemPoints: 500 }))).rejects.toBeInstanceOf(
      RecordCheckoutError
    )
    // Nothing was written — no payment, no ledger row.
    expect(tx.payment.create).not.toHaveBeenCalled()
    expect(tx.loyaltyTransaction.create).not.toHaveBeenCalled()
  })

  it("rejects redemption when there is no client to redeem against", async () => {
    const tx = fakeTx({ finalPrice: 60 })
    tx.appointment.findFirst = vi.fn(async () => ({ clientId: null, services: [] }))

    await expect(
      recordCheckout(tx, BIZ, {
        ...baseInput(),
        clientId: undefined,
        appointmentId: undefined,
        redeemPoints: 100,
      }),
    ).rejects.toBeInstanceOf(RecordCheckoutError)
    expect(tx.payment.create).not.toHaveBeenCalled()
  })
})

describe("recordCheckout — loyalty tenant isolation", () => {
  it("scopes the client lookup by businessId — a foreign business sees no client", async () => {
    // fakeTx only returns the client when businessId === BIZ. Calling with
    // OTHER_BIZ must surface as NOT_FOUND, proving the lookup is tenant-scoped.
    const tx = fakeTx({ finalPrice: 60, clientPoints: 500 })

    await expect(recordCheckout(tx, OTHER_BIZ, baseInput())).rejects.toMatchObject({
      code: "NOT_FOUND",
    })
    // The lookup was made with the (foreign) businessId we passed in, never trusted input.
    const lookupArgs = tx.client.findFirst.mock.calls[0][0]
    expect(lookupArgs.where.businessId).toBe(OTHER_BIZ)
    expect(tx.loyaltyTransaction.create).not.toHaveBeenCalled()
  })

  it("stamps every loyalty ledger write with the businessId passed to recordCheckout", async () => {
    const tx = fakeTx({ finalPrice: 40, clientPoints: 1000 })

    await recordCheckout(tx, BIZ, baseInput({ redeemPoints: 1000 }))

    for (const call of tx.loyaltyTransaction.create.mock.calls) {
      expect(call[0].data.businessId).toBe(BIZ)
      expect(call[0].data.clientId).toBe(CLIENT)
    }
  })
})
