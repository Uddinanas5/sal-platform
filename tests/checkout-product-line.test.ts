import { describe, it, expect, beforeEach, vi } from "vitest"
import { recordCheckout } from "@/lib/checkout/record-checkout"

// Guards the "product revenue always $0" money bug: a product sale at checkout
// must write an AppointmentProduct line (DB-sourced price/name, tied to the
// Payment) — not just decrement inventory. Before this fix, no line was ever
// written, so reports.ts product revenue was structurally always $0 and folded
// into serviceRevenue. Pure unit test over a fake tx; resolvePayrollPeriod is
// stubbed so the period lookup passes.

vi.mock("@/lib/checkout/resolve-payroll-period", async (orig) => ({
  ...(await orig<typeof import("@/lib/checkout/resolve-payroll-period")>()),
  resolvePayrollPeriod: vi.fn(async () => ({
    periodStart: new Date("2026-06-01T00:00:00Z"),
    periodEnd: new Date("2026-06-30T00:00:00Z"),
  })),
}))

const BIZ = "11111111-1111-4111-8111-111111111111"
const PROD = "33333333-3333-4333-8333-333333333333"
const CLIENT = "44444444-4444-4444-8444-444444444444"
const APPT = "55555555-5555-4555-8555-555555555555"
const PAYMENT_ID = "pay_line_1"

function fakeTx() {
  const tx = {
    $executeRaw: vi.fn(),
    business: { findUnique: vi.fn(async () => ({ settings: {}, currency: "USD" })) },
    service: { findMany: vi.fn(async () => []) },
    product: {
      // name + retailPrice are what the AppointmentProduct line is built from.
      findMany: vi.fn(async () => [
        { id: PROD, name: "Pomade", retailPrice: 25, taxRate: null, isTaxable: true },
      ]),
    },
    appointment: {
      findFirst: vi.fn(async () => ({ clientId: CLIENT, services: [] })),
      update: vi.fn(async () => ({})),
    },
    client: {
      findFirst: vi.fn(async () => ({ id: CLIENT, loyaltyPoints: 0 })),
      update: vi.fn(async () => ({})),
    },
    payment: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async () => ({ id: PAYMENT_ID, paymentReference: "PAY-X" })),
    },
    productInventory: {
      findFirst: vi.fn(async () => ({ id: "inv_1", locationId: "loc_1" })),
      updateMany: vi.fn(async () => ({ count: 1 })),
      findUnique: vi.fn(async () => ({ quantity: 8 })),
      update: vi.fn(async () => ({})),
    },
    inventoryTransaction: { create: vi.fn(async () => ({ id: "it_1" })) },
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
  items: [{ type: "product" as const, id: PROD, quantity: 2 }],
  discount: 0,
  tax: 0,
  tip: 0,
  method: "cash" as const,
  ...extra,
})

const productItems = (quantity: number) => [{ type: "product" as const, id: PROD, quantity }]

beforeEach(() => vi.clearAllMocks())

describe("recordCheckout — writes an AppointmentProduct line per product sale", () => {
  it("creates a product line with DB-sourced price/name, the gross total, and the Payment id", async () => {
    const tx = fakeTx()

    await recordCheckout(tx, BIZ, baseInput({ items: productItems(2) }))

    expect(tx.appointmentProduct.create).toHaveBeenCalledTimes(1)
    const data = tx.appointmentProduct.create.mock.calls[0][0].data
    expect(data.productId).toBe(PROD)
    expect(data.name).toBe("Pomade")
    expect(data.quantity).toBe(2)
    // unitPrice + totalPrice are DB-sourced (retailPrice 25 * qty 2 = 50), never
    // the caller, and on a PRE-tax/PRE-discount gross basis.
    expect(Number(data.unitPrice)).toBe(25)
    expect(Number(data.totalPrice)).toBe(50)
    // The line is tied to the Payment that collected it (so reports window it by
    // Payment.createdAt) and has no appointment for a standalone sale.
    expect(data.paymentId).toBe(PAYMENT_ID)
    expect(data.appointmentId).toBeNull()
    // Inventory is decremented atomically with a zero-floor guard.
    expect(tx.productInventory.updateMany).toHaveBeenCalledWith({
      where: { id: "inv_1", quantity: { gte: 2 } },
      data: { quantity: { decrement: 2 } },
    })
    // And a ledger 'sale' row keeps ProductInventory reconcilable.
    expect(tx.inventoryTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: "sale", quantityChange: -2 }),
      }),
    )
  })

  it("attaches the appointmentId when the sale is part of an appointment checkout", async () => {
    const tx = fakeTx()

    await recordCheckout(tx, BIZ, baseInput({ appointmentId: APPT, items: productItems(1) }))

    const data = tx.appointmentProduct.create.mock.calls[0][0].data
    expect(data.appointmentId).toBe(APPT)
    expect(data.paymentId).toBe(PAYMENT_ID)
    expect(Number(data.totalPrice)).toBe(25)
  })

  it("does NOT write a product line for a service-only checkout", async () => {
    const tx = fakeTx()
    tx.service.findMany = vi.fn(async () => [
      { id: "svc_x", price: 40, taxRate: null, isTaxable: true },
    ])

    await recordCheckout(tx, BIZ, {
      clientId: CLIENT,
      items: [{ type: "service", id: "svc_x", quantity: 1 }],
      discount: 0,
      tax: 0,
      tip: 0,
      method: "cash",
    })

    expect(tx.appointmentProduct.create).not.toHaveBeenCalled()
  })
})
