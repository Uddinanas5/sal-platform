import { describe, it, expect, beforeEach, vi } from "vitest"
import { recordCheckout, RecordCheckoutError } from "@/lib/checkout/record-checkout"
import { TAX_RATE } from "@/lib/utils"

// GROUP B (MONEY): Custom "Quick Sale" line items used to be charged to the
// customer (the cart total included them) but were SILENTLY dropped before the
// money writer, so Payment.amount/tax/total/totalSpent/loyalty/reports recorded
// LESS than the cash collected. The fix threads custom lines through to
// recordCheckout as first-class authoritative lines: their unitPrice is folded
// into the SAME server-computed subtotal/tax/total (and persisted in
// Payment.notes), and the discount cap is computed against the FULL incl-custom
// subtotal so mixed discounted carts stop hard-failing.
//
// Pure unit tests over a fake Prisma tx — no DB. resolvePayrollPeriod is stubbed
// so the period lookup passes. Mirrors tests/checkout-price-tampering.test.ts.

const cents = (n: number) => Math.round(n * 100) / 100

vi.mock("@/lib/checkout/resolve-payroll-period", async (orig) => ({
  ...(await orig<typeof import("@/lib/checkout/resolve-payroll-period")>()),
  resolvePayrollPeriod: vi.fn(async () => ({
    periodStart: new Date("2026-06-01T00:00:00Z"),
    periodEnd: new Date("2026-06-30T00:00:00Z"),
  })),
}))

const BIZ = "11111111-1111-4111-8111-111111111111"
const SVC = "22222222-2222-4222-8222-222222222222"
const CLIENT = "44444444-4444-4444-8444-444444444444"

type ServiceRow = { id: string; price: number; isTaxable?: boolean; taxRate?: number | null }

const withTax = <T extends { isTaxable?: boolean; taxRate?: number | null }>(row: T) => ({
  isTaxable: true,
  taxRate: null,
  ...row,
})

type TxOverrides = {
  services?: ServiceRow[]
  client?: { id: string; loyaltyPoints: number } | null
}

function fakeTx(o: TxOverrides = {}) {
  const tx = {
    $executeRaw: vi.fn(),
    service: { findMany: vi.fn(async () => (o.services ?? [{ id: SVC, price: 10 }]).map(withTax)) },
    product: { findMany: vi.fn(async () => []) },
    appointment: { findFirst: vi.fn(), update: vi.fn() },
    client: {
      findFirst: vi.fn(async () =>
        o.client === undefined ? { id: CLIENT, loyaltyPoints: 0 } : o.client,
      ),
      update: vi.fn(async () => ({})),
    },
    payment: {
      create: vi.fn(async () => ({ id: "pay_1", paymentReference: "PAY-X" })),
    },
    productInventory: { findFirst: vi.fn(async () => null), update: vi.fn() },
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

describe("recordCheckout — custom Quick Sale lines are recorded (not dropped)", () => {
  it("includes a $90 custom line + a $10 service in the recorded subtotal/amount/total", async () => {
    // The exact regression from the finding: $90 custom + $10 service displayed
    // and CHARGED ~$108.88, but recorded only $10. Now both are recorded.
    const tx = fakeTx({ services: [{ id: SVC, price: 10 }] })

    const result = await recordCheckout(tx, BIZ, baseInput({
      customItems: [{ type: "custom", name: "Walk-in trim", unitPrice: 90, quantity: 1 }],
    }))

    // subtotal = 10 (service) + 90 (custom) = 100 — NOT 10.
    expect(result.subtotal).toBe(100)
    expect(result.amount).toBe(100)
    // tax on the full $100 at the flat fallback rate, total = 100 + tax.
    const expectedTax = cents(100 * TAX_RATE)
    expect(result.total).toBe(cents(100 + expectedTax))
    // Payment.amount / totalAmount carry the FULL incl-custom money.
    const paymentArg = tx.payment.create.mock.calls[0][0]
    expect(paymentArg.data.amount).toBe(100)
    expect(paymentArg.data.totalAmount).toBe(cents(100 + expectedTax))
    expect(paymentArg.data.amount).not.toBe(10) // the old silent shortfall
  })

  it("persists the custom line detail in Payment.notes", async () => {
    const tx = fakeTx({ services: [{ id: SVC, price: 10 }] })
    await recordCheckout(tx, BIZ, baseInput({
      customItems: [{ type: "custom", name: "Walk-in trim", unitPrice: 90, quantity: 2 }],
    }))
    const notes = tx.payment.create.mock.calls[0][0].data.notes as string
    expect(notes).toContain("Quick Sale items")
    expect(notes).toContain("Walk-in trim")
    expect(notes).toContain("x2")
    expect(notes).toContain("180.00") // 90 * 2
  })

  it("earns loyalty + bumps totalSpent on the FULL incl-custom amount", async () => {
    const tx = fakeTx({ services: [{ id: SVC, price: 10 }] })
    const result = await recordCheckout(tx, BIZ, baseInput({
      customItems: [{ type: "custom", name: "Quick Sale", unitPrice: 90, quantity: 1 }],
    }))
    expect(result.loyalty.earnedPoints).toBe(100) // floor($100), not floor($10)
    const clientUpdate = tx.client.update.mock.calls[0][0]
    expect(clientUpdate.data.totalSpent).toEqual({ increment: 100 })
    expect(clientUpdate.data.loyaltyPoints).toEqual({ increment: 100 })
  })

  it("records a custom-only cart (no catalog items) at the custom amount", async () => {
    const tx = fakeTx({ services: [] })
    const result = await recordCheckout(tx, BIZ, {
      ...baseInput(),
      items: [],
      customItems: [{ type: "custom", name: "Tip jar", unitPrice: 25, quantity: 1 }],
    })
    expect(result.subtotal).toBe(25)
    expect(result.amount).toBe(25)
    expect(tx.payment.create.mock.calls[0][0].data.amount).toBe(25)
  })

  it("supports quantity > 1 on a custom line", async () => {
    const tx = fakeTx({ services: [] })
    const result = await recordCheckout(tx, BIZ, {
      ...baseInput(),
      items: [],
      customItems: [{ type: "custom", name: "Bundle", unitPrice: 15, quantity: 3 }],
    })
    expect(result.subtotal).toBe(45)
    expect(result.amount).toBe(45)
  })
})

describe("recordCheckout — discount cap on mixed custom carts", () => {
  it("ALLOWS a fixed discount that exceeds the catalog-only subtotal but not the incl-custom subtotal", async () => {
    // The secondary hard-fail from the finding: $90 custom + $10 service, $50
    // fixed discount. Old behavior compared 50 > 10 (catalog-only) and threw.
    // Now the cap is the full $100 subtotal, so the discount is legitimate.
    const tx = fakeTx({ services: [{ id: SVC, price: 10 }] })
    const result = await recordCheckout(tx, BIZ, baseInput({
      discount: 50,
      customItems: [{ type: "custom", name: "Walk-in", unitPrice: 90, quantity: 1 }],
    }))
    expect(result.subtotal).toBe(100)
    expect(result.amount).toBe(50) // 100 - 50
    const expectedTax = cents(50 * TAX_RATE)
    expect(result.total).toBe(cents(50 + expectedTax))
  })

  it("still rejects a discount greater than the FULL incl-custom subtotal", async () => {
    const tx = fakeTx({ services: [{ id: SVC, price: 10 }] })
    await expect(
      recordCheckout(tx, BIZ, baseInput({
        discount: 150, // > 100 total subtotal
        customItems: [{ type: "custom", name: "Walk-in", unitPrice: 90, quantity: 1 }],
      })),
    ).rejects.toBeInstanceOf(RecordCheckoutError)
    expect(tx.payment.create).not.toHaveBeenCalled()
  })
})

describe("recordCheckout — custom line validation (fail loudly, never silently)", () => {
  it("rejects a negative custom unitPrice", async () => {
    const tx = fakeTx({ services: [] })
    await expect(
      recordCheckout(tx, BIZ, {
        ...baseInput(),
        items: [],
        customItems: [{ type: "custom", name: "Bad", unitPrice: -5, quantity: 1 }],
      }),
    ).rejects.toBeInstanceOf(RecordCheckoutError)
    expect(tx.payment.create).not.toHaveBeenCalled()
  })

  it("rejects a non-positive custom quantity", async () => {
    const tx = fakeTx({ services: [] })
    await expect(
      recordCheckout(tx, BIZ, {
        ...baseInput(),
        items: [],
        customItems: [{ type: "custom", name: "Bad", unitPrice: 10, quantity: 0 }],
      }),
    ).rejects.toBeInstanceOf(RecordCheckoutError)
    expect(tx.payment.create).not.toHaveBeenCalled()
  })

  it("does not write a notes summary when there are no custom items", async () => {
    const tx = fakeTx({ services: [{ id: SVC, price: 10 }] })
    await recordCheckout(tx, BIZ, baseInput())
    expect(tx.payment.create.mock.calls[0][0].data.notes).toBeNull()
  })
})
