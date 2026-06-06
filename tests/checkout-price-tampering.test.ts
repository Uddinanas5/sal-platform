import { describe, it, expect, beforeEach, vi } from "vitest"
import { recordCheckout, RecordCheckoutError } from "@/lib/checkout/record-checkout"
import { TAX_RATE } from "@/lib/utils"

// Round to cents the same way recordCheckout does.
const cents = (n: number) => Math.round(n * 100) / 100

// Guards GAP-034 price tampering: recordCheckout must recompute amount/tax/total
// from DB prices + per-item tax config (the input carries only {type,id,quantity}
// — never a price, and any caller-supplied tax is IGNORED), scope every price
// lookup to the caller's businessId + deletedAt:null, reject discount > subtotal,
// and award loyalty on the SERVER amount. Pure unit test over a fake tx;
// resolvePayrollPeriod is stubbed so the period lookup passes.
//
// Tax model (server-authoritative): each line's rate comes from the DB —
// isTaxable=false → 0; isTaxable=true with a per-item taxRate (a percentage) →
// taxRate/100; isTaxable=true with taxRate null → the flat TAX_RATE fallback
// (0.08875), which is what current beta data uses, so the server total matches
// the UI estimate. Tax is applied to the DISCOUNTED base.

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

// DB rows include the tax config recordCheckout now selects. Defaults mirror the
// schema (isTaxable=true, taxRate=null) so the flat TAX_RATE fallback applies —
// the same path current beta data takes.
type ServiceRow = { id: string; price: number; isTaxable?: boolean; taxRate?: number | null }
type ProductRow = { id: string; name?: string; retailPrice: number; isTaxable?: boolean; taxRate?: number | null }

const withTax = <T extends { isTaxable?: boolean; taxRate?: number | null }>(row: T) => ({
  isTaxable: true,
  taxRate: null,
  ...row,
})

// Product rows also carry a `name` (selected at checkout to write the
// AppointmentProduct line). Defaults to a placeholder when not specified.
const withProductDefaults = (row: ProductRow) => ({ name: "Test Product", ...withTax(row) })

type TxOverrides = {
  services?: ServiceRow[]
  products?: ProductRow[]
  client?: { id: string } | null
  inventory?: { id: string } | null
}

function fakeTx(o: TxOverrides = {}) {
  const tx = {
    $executeRaw: vi.fn(),
    service: { findMany: vi.fn(async () => (o.services ?? [{ id: SVC, price: 60 }]).map(withTax)) },
    product: { findMany: vi.fn(async () => (o.products ?? []).map(withProductDefaults)) },
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
    appointmentProduct: { create: vi.fn(async () => ({ id: "ap_1" })) },
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
  it("recomputes amount/tax/total server-side and IGNORES caller-supplied tax", async () => {
    const tx = fakeTx({ services: [{ id: SVC, price: 60 }] })
    const result = await recordCheckout(tx, BIZ, baseInput({
      items: [{ type: "service", id: SVC, quantity: 2 }],
      discount: 10,
      // Caller LIES about the tax (says 5) — the server must ignore it and
      // recompute from the DB tax config (flat TAX_RATE fallback here).
      tax: 5,
      tip: 3,
    }))
    // subtotal = 60*2 = 120; amount = 120-10 = 110.
    // tax = amount * TAX_RATE = 110 * 0.08875 = 9.76 (NOT the caller's 5).
    // total = 110 + 9.76 + 3 = 122.76.
    const expectedTax = cents(110 * TAX_RATE) // 9.76
    const expectedTotal = cents(110 + expectedTax + 3)
    expect(result.subtotal).toBe(120)
    expect(result.amount).toBe(110)
    expect(result.total).toBe(expectedTotal)
    expect(result.total).not.toBe(118) // would be 118 if caller tax were trusted
    const paymentArg = tx.payment.create.mock.calls[0][0]
    expect(paymentArg.data.amount).toBe(110)
    expect(paymentArg.data.totalAmount).toBe(expectedTotal)
  })

  it("uses a per-item taxRate when configured, and 0 for non-taxable items", async () => {
    // One taxable service at an explicit 10% rate + one non-taxable product.
    const tx = fakeTx({
      services: [{ id: SVC, price: 100, isTaxable: true, taxRate: 10 }],
      products: [{ id: PROD, retailPrice: 50, isTaxable: false, taxRate: null }],
    })
    const result = await recordCheckout(tx, BIZ, baseInput({
      items: [
        { type: "service", id: SVC, quantity: 1 },
        { type: "product", id: PROD, quantity: 1 },
      ],
    }))
    // subtotal = 150, no discount → amount = 150. Tax only on the $100 service
    // at 10% = $10 (the $50 product is non-taxable → 0). total = 150 + 10.
    expect(result.subtotal).toBe(150)
    expect(result.amount).toBe(150)
    expect(result.total).toBe(160)
  })

  it("taxes the DISCOUNTED base, not the gross subtotal", async () => {
    // Flat fallback rate. subtotal 100, discount 20 → amount 80.
    const tx = fakeTx({ services: [{ id: SVC, price: 100 }] })
    const result = await recordCheckout(tx, BIZ, baseInput({ discount: 20 }))
    const expectedTax = cents(80 * TAX_RATE) // tax on 80, not 100
    expect(result.amount).toBe(80)
    expect(result.total).toBe(cents(80 + expectedTax))
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
      select: { id: true, price: true, taxRate: true, isTaxable: true },
    })
    expect(tx.product.findMany).toHaveBeenCalledWith({
      where: { id: { in: [PROD] }, businessId: BIZ, deletedAt: null },
      select: { id: true, name: true, retailPrice: true, taxRate: true, isTaxable: true },
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
