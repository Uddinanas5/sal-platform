import { describe, it, expect, beforeEach, vi } from "vitest"
import { recordCheckout, RecordCheckoutError } from "@/lib/checkout/record-checkout"

// Guards GAP-034 price tampering: recordCheckout must recompute amount/total
// from DB prices (the input carries only {type,id,quantity} — never a price),
// scope every price lookup to the caller's businessId + deletedAt:null, reject
// discount > subtotal, and award loyalty on the SERVER amount. Pure unit test
// over a fake tx; resolvePayrollPeriod is stubbed so the period lookup passes.

vi.mock("@/lib/checkout/resolve-payroll-period", async (orig) => ({
  ...(await orig<typeof import("@/lib/checkout/resolve-payroll-period")>()),
  resolvePayrollPeriod: vi.fn(async () => ({
    periodStart: new Date("2026-06-01T00:00:00Z"),
    periodEnd: new Date("2026-06-15T00:00:00Z"),
  })),
}))

const BIZ = "11111111-1111-4111-8111-111111111111"
const SVC = "22222222-2222-4222-8222-222222222222"
const PROD = "33333333-3333-4333-8333-333333333333"
const CLIENT = "44444444-4444-4444-8444-444444444444"

type TxOverrides = {
  services?: { id: string; price: number }[]
  products?: { id: string; retailPrice: number }[]
  client?: { id: string } | null
  inventory?: { id: string } | null
}

function fakeTx(o: TxOverrides = {}) {
  const tx = {
    $executeRaw: vi.fn(),
    service: { findMany: vi.fn(async () => o.services ?? [{ id: SVC, price: 60 }]) },
    product: { findMany: vi.fn(async () => o.products ?? []) },
    appointment: { findFirst: vi.fn(), update: vi.fn() },
    client: {
      // loyaltyPoints is read for redeem validation (0 = nothing to redeem); the
      // earn path still fires and writes a loyaltyTransaction row.
      findFirst: vi.fn(async () =>
        o.client === undefined ? { id: CLIENT, loyaltyPoints: 0 } : o.client,
      ),
      update: vi.fn(async () => ({})),
    },
    payment: {
      create: vi.fn(async () => ({ id: "pay_1", paymentReference: "PAY-X" })),
    },
    productInventory: {
      findFirst: vi.fn(async () => (o.inventory === undefined ? { id: "inv_1" } : o.inventory)),
      update: vi.fn(async () => ({})),
    },
    staffService: { findMany: vi.fn(async () => []) },
    commission: { create: vi.fn(async () => ({ id: "com_1" })) },
    loyaltyTransaction: { create: vi.fn(async () => ({ id: "loy_1" })) },
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return tx as any
}

const baseInput = (extra?: Record<string, unknown>) => ({
  clientId: CLIENT,
  items: [{ type: "service" as const, id: SVC, quantity: 1 }],
  discount: 0,
  tax: 0,
  tip: 0,
  method: "cash" as const,
  ...extra,
})

beforeEach(() => vi.clearAllMocks())

describe("recordCheckout — server-side price authority", () => {
  it("recomputes amount/total from DB prices (qty × price − discount + tax + tip)", async () => {
    const tx = fakeTx({ services: [{ id: SVC, price: 60 }] })
    const result = await recordCheckout(tx, BIZ, baseInput({
      items: [{ type: "service", id: SVC, quantity: 2 }],
      discount: 10,
      tax: 5,
      tip: 3,
    }))
    // subtotal = 60*2 = 120; amount = 120-10 = 110; total = 110+5+3 = 118
    expect(result.subtotal).toBe(120)
    expect(result.amount).toBe(110)
    expect(result.total).toBe(118)
    const paymentArg = tx.payment.create.mock.calls[0][0]
    expect(paymentArg.data.amount).toBe(110)
    expect(paymentArg.data.totalAmount).toBe(118)
  })

  it("scopes service + product price lookups to the caller's business and non-deleted rows", async () => {
    const tx = fakeTx({
      services: [{ id: SVC, price: 40 }],
      products: [{ id: PROD, retailPrice: 25 }],
    })
    await recordCheckout(tx, BIZ, baseInput({
      items: [
        { type: "service", id: SVC, quantity: 1 },
        { type: "product", id: PROD, quantity: 1 },
      ],
    }))
    expect(tx.service.findMany).toHaveBeenCalledWith({
      where: { id: { in: [SVC] }, businessId: BIZ, deletedAt: null },
      select: { id: true, price: true },
    })
    expect(tx.product.findMany).toHaveBeenCalledWith({
      where: { id: { in: [PROD] }, businessId: BIZ, deletedAt: null },
      select: { id: true, retailPrice: true },
    })
  })

  it("rejects a discount greater than the subtotal", async () => {
    const tx = fakeTx({ services: [{ id: SVC, price: 50 }] })
    await expect(
      recordCheckout(tx, BIZ, baseInput({ discount: 75 }))
    ).rejects.toBeInstanceOf(RecordCheckoutError)
    expect(tx.payment.create).not.toHaveBeenCalled()
  })

  it("awards loyalty points on the server amount (floor), not any client value", async () => {
    const tx = fakeTx({ services: [{ id: SVC, price: 60 }] })
    await recordCheckout(tx, BIZ, baseInput({
      items: [{ type: "service", id: SVC, quantity: 2 }], // subtotal 120
      discount: 0.5, // amount 119.5
    }))
    const clientUpdate = tx.client.update.mock.calls[0][0]
    expect(clientUpdate.data.loyaltyPoints).toEqual({ increment: 119 }) // floor(119.5)
    expect(clientUpdate.data.totalSpent).toEqual({ increment: 119.5 })
  })

  it("decrements product inventory by the purchased quantity", async () => {
    const tx = fakeTx({
      services: [],
      products: [{ id: PROD, retailPrice: 25 }],
      inventory: { id: "inv_1" },
    })
    await recordCheckout(tx, BIZ, baseInput({
      items: [{ type: "product", id: PROD, quantity: 3 }],
    }))
    expect(tx.productInventory.update).toHaveBeenCalledWith({
      where: { id: "inv_1" },
      data: { quantity: { decrement: 3 } },
    })
  })

  it("rejects when a requested service does not belong to the business", async () => {
    // findMany returns nothing → length mismatch → NOT_FOUND
    const tx = fakeTx({ services: [] })
    await expect(
      recordCheckout(tx, BIZ, baseInput())
    ).rejects.toThrow(/not found/i)
    expect(tx.payment.create).not.toHaveBeenCalled()
  })
})
