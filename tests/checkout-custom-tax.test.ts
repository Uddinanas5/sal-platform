import { describe, it, expect, beforeEach, vi } from "vitest"
import { recordCheckout } from "@/lib/checkout/record-checkout"

// L-018 / payments-audit #7 — ad-hoc "Quick Sale" (custom) lines must honor the
// business tax toggles. Previously a custom line was ALWAYS taxed at the default
// rate, so a "no sales tax" shop (both taxOnServices + taxOnProducts off) still
// over-charged tax on Quick Sales, inconsistently with its catalog lines. Pure
// unit test over a fake Prisma tx.

const BIZ = "11111111-1111-4111-8111-111111111111"

function fakeTx(settings: Record<string, unknown> = {}) {
  const paymentCreate = vi.fn(async (_a: { data: Record<string, unknown> }) => ({ id: "pay_1", paymentReference: "PAY-X" }))
  const tx = {
    $executeRaw: vi.fn(),
    business: { findUnique: vi.fn(async () => ({ timezone: "UTC", settings, currency: "USD" })) },
    service: { findMany: vi.fn(async () => []) },
    product: { findMany: vi.fn(async () => []) },
    payment: { findFirst: vi.fn(async () => null), create: paymentCreate },
    client: { findFirst: vi.fn(async () => null), update: vi.fn() },
    staff: { findMany: vi.fn(async () => []) },
    staffService: { findMany: vi.fn(async () => []) },
    commission: { create: vi.fn() },
    loyaltyTransaction: { create: vi.fn() },
    productInventory: { findFirst: vi.fn(async () => null), update: vi.fn() },
    appointmentProduct: { create: vi.fn() },
    payrollPeriod: {
      findFirst: vi.fn(async () => ({ id: "pp", periodStart: new Date("2000-01-01"), periodEnd: new Date("2999-12-31"), status: "open" })),
      create: vi.fn(),
    },
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { tx: tx as any, paymentCreate }
}

// A $100 walk-in Quick Sale, cash, no appointment/client.
const walkIn = {
  items: [] as { type: "service" | "product"; id: string; quantity: number }[],
  customItems: [{ type: "custom" as const, name: "Walk-in trim", unitPrice: 100, quantity: 1 }],
  discount: 0,
  tip: 0,
  method: "cash" as const,
}

beforeEach(() => vi.clearAllMocks())

describe("Quick Sale (custom line) tax honors the business toggles (audit #7)", () => {
  it("a shop with BOTH tax toggles OFF does not tax a $100 Quick Sale (total stays $100)", async () => {
    const { tx, paymentCreate } = fakeTx({ payments: { taxOnServices: false, taxOnProducts: false, taxRate: "8.875" } })

    const res = await recordCheckout(tx, BIZ, walkIn)

    expect(res.total).toBe(100)
    expect(Number(paymentCreate.mock.calls[0]![0].data.totalAmount)).toBe(100)
  })

  it("the default config (tax ON) DOES tax the same $100 Quick Sale", async () => {
    const { tx } = fakeTx({}) // no payments settings → toggles default ON, flat rate

    const res = await recordCheckout(tx, BIZ, walkIn)

    // 100 + 8.875% ≈ 108.88 — proves the toggle actually gates the rate.
    expect(res.total).toBeCloseTo(108.88, 2)
    expect(res.total).toBeGreaterThan(100)
  })
})
