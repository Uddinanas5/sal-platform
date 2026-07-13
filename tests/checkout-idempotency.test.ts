import { describe, it, expect, beforeEach, vi } from "vitest"
import { recordCheckout, RecordCheckoutError } from "@/lib/checkout/record-checkout"
import { Prisma } from "@/generated/prisma"

// L-016 — server-side checkout idempotency (payments-audit #6/#9/#10).
//
// Appointment-less WALK-IN / POS sales previously had NO idempotency guard: a
// retried or double-submitted request (network retry, an API/MCP client that
// resends on timeout) re-ran recordCheckout in full — a second Payment, a second
// gift-card decrement, duplicate commission/inventory/loyalty. recordCheckout now
// takes an optional idempotencyKey: a fast-path lookup returns the ORIGINAL
// payment on a repeat, and the UNIQUE (businessId, idempotencyKey) index catches a
// true concurrent duplicate. These are pure unit tests over a fake Prisma tx.

const BIZ = "11111111-1111-4111-8111-111111111111"

function fakeTx(opts: {
  priorPayment?: { id: string; paymentReference: string; amount: number; totalAmount: number } | null
  createRejectsP2002?: boolean
} = {}) {
  const paymentFindFirst = vi.fn(async () => opts.priorPayment ?? null)
  const paymentCreate = vi.fn(async (_args: { data: Record<string, unknown> }) => {
    if (opts.createRejectsP2002) {
      throw new Prisma.PrismaClientKnownRequestError("Unique constraint failed on payments_business_id_idempotency_key_key", {
        code: "P2002",
        clientVersion: "7.8.0",
      })
    }
    return { id: "pay_new", paymentReference: "PAY-NEW" }
  })

  const tx = {
    $executeRaw: vi.fn(),
    business: { findUnique: vi.fn(async () => ({ timezone: "UTC", settings: {}, currency: "USD" })) },
    service: { findMany: vi.fn(async () => []) },
    product: { findMany: vi.fn(async () => []) },
    appointment: { findFirst: vi.fn(async () => null), update: vi.fn() },
    client: { findFirst: vi.fn(async () => null), update: vi.fn() },
    payment: { findFirst: paymentFindFirst, create: paymentCreate },
    productInventory: { findFirst: vi.fn(async () => null), update: vi.fn() },
    appointmentProduct: { create: vi.fn() },
    staff: { findMany: vi.fn(async () => []) },
    staffService: { findMany: vi.fn(async () => []) },
    commission: { create: vi.fn() },
    loyaltyTransaction: { create: vi.fn() },
    // A pre-existing OPEN payroll period so ensureOpenPayrollPeriod resolves
    // without hitting the create/lock bootstrap path.
    payrollPeriod: {
      findFirst: vi.fn(async () => ({
        id: "pp",
        periodStart: new Date("2000-01-01"),
        periodEnd: new Date("2999-12-31"),
        status: "open",
      })),
      create: vi.fn(),
    },
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { tx: tx as any, paymentFindFirst, paymentCreate }
}

// A walk-in cash sale of one ad-hoc line — NO appointmentId, NO clientId, so the
// idempotency key is the ONLY guard against a duplicate.
const walkIn = (extra?: Record<string, unknown>) => ({
  items: [] as { type: "service" | "product"; id: string; quantity: number }[],
  customItems: [{ type: "custom" as const, name: "Walk-in trim", unitPrice: 30, quantity: 1 }],
  discount: 0,
  tip: 0,
  method: "cash" as const,
  ...extra,
})

beforeEach(() => vi.clearAllMocks())

describe("recordCheckout — server-side idempotency for appointment-less checkouts", () => {
  it("a retry with the SAME key returns the ORIGINAL payment and writes nothing new", async () => {
    const { tx, paymentFindFirst, paymentCreate } = fakeTx({
      priorPayment: { id: "pay_orig", paymentReference: "PAY-ORIG", amount: 30, totalAmount: 32.66 },
    })

    const result = await recordCheckout(tx, BIZ, walkIn({ idempotencyKey: "idem-1" }))

    // Returns the first payment's identity — not a new row.
    expect(result.payment.id).toBe("pay_orig")
    expect(result.payment.paymentReference).toBe("PAY-ORIG")
    // The lookup was scoped to (businessId, key)...
    expect(paymentFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { businessId: BIZ, idempotencyKey: "idem-1" } }),
    )
    // ...and NOTHING was double-recorded.
    expect(paymentCreate).not.toHaveBeenCalled()
  })

  it("the first call persists the key on the new Payment (so a later retry can match it)", async () => {
    const { tx, paymentCreate } = fakeTx({ priorPayment: null })

    await recordCheckout(tx, BIZ, walkIn({ idempotencyKey: "idem-2" }))

    expect(paymentCreate).toHaveBeenCalledTimes(1)
    expect(paymentCreate.mock.calls[0]![0].data.idempotencyKey).toBe("idem-2")
  })

  it("a checkout with NO key behaves as before (records normally, key column null, no key lookup)", async () => {
    const { tx, paymentFindFirst, paymentCreate } = fakeTx({ priorPayment: null })

    await recordCheckout(tx, BIZ, walkIn())

    expect(paymentCreate).toHaveBeenCalledTimes(1)
    expect(paymentCreate.mock.calls[0]![0].data.idempotencyKey).toBeNull()
    // No key → the fast-path lookup never runs (walk-ins have no other findFirst).
    expect(paymentFindFirst).not.toHaveBeenCalled()
  })

  it("a true concurrent duplicate (create hits the UNIQUE index) fails cleanly, never double-records", async () => {
    const { tx } = fakeTx({ priorPayment: null, createRejectsP2002: true })

    await expect(recordCheckout(tx, BIZ, walkIn({ idempotencyKey: "idem-3" }))).rejects.toBeInstanceOf(
      RecordCheckoutError,
    )
    await expect(recordCheckout(tx, BIZ, walkIn({ idempotencyKey: "idem-3" }))).rejects.toThrow(/already recorded/)
  })
})
