import { describe, it, expect, beforeEach, vi } from "vitest"
import { recordCheckout, RecordCheckoutError } from "@/lib/checkout/record-checkout"

// MANDATORY NEGATIVE TEST — checkout double-submit idempotency.
//
// Proves the IN-TRANSACTION guard inside recordCheckout (record-checkout.ts
// lines ~306-319): after taking an advisory lock on the appointment, it
// re-reads `tx.payment.findFirst({ appointmentId, type:"payment",
// status:"completed" })` and, if a completed Payment already exists, throws
// RecordCheckoutError("...already been paid.") BEFORE writing a second Payment.
//
// This is the authoritative TOCTOU guard — distinct from the pre-transaction
// fast-fail in actions/checkout.ts and the MCP-tool guard (which mocks
// recordCheckout out entirely, see tests/mcp-checkout-tool.test.ts). No existing
// test drives the REAL recordCheckout twice for the same appointment, so this
// closes that gap. The fail-without/pass-with hinge: delete that findFirst
// re-check and the 2nd call would call tx.payment.create again — this test goes
// red.
//
// Pure unit test over a fake tx (mock-Prisma, no DB), mirroring
// tests/checkout-product-line.test.ts. resolvePayrollPeriod is stubbed so the
// period lookup passes; tx.$executeRaw is a no-op so the advisory lock is inert.

vi.mock("@/lib/checkout/resolve-payroll-period", async (orig) => ({
  ...(await orig<typeof import("@/lib/checkout/resolve-payroll-period")>()),
  resolvePayrollPeriod: vi.fn(async () => ({
    periodStart: new Date("2026-06-01T00:00:00Z"),
    periodEnd: new Date("2026-06-30T00:00:00Z"),
  })),
}))

// Valid v4 UUIDs.
const BIZ = "11111111-1111-4111-8111-111111111111"
const CLIENT = "44444444-4444-4444-8444-444444444444"
const APPT = "55555555-5555-4555-8555-555555555555"
const SVC = "66666666-6666-4666-8666-666666666666"
const STAFF = "77777777-7777-4777-8777-777777777777"
const APPT_SVC = "88888888-8888-4888-8888-888888888888"
const PAYMENT_ID = "pay_double_1"
const EXISTING_PAYMENT_ID = "pay_existing_completed"

// A fake tx for an APPOINTMENT checkout of a single $40 service. `paidAlready`
// flips the in-tx re-check (tx.payment.findFirst) to simulate the SECOND submit
// of the SAME appointment, where a completed Payment is already on the books.
function fakeTx(opts: { paidAlready: boolean }) {
  const tx = {
    $executeRaw: vi.fn(async () => undefined), // advisory lock: inert in unit test
    business: { findUnique: vi.fn(async () => ({ settings: {}, currency: "USD" })) },
    service: {
      findMany: vi.fn(async () => [{ id: SVC, price: 40, taxRate: null, isTaxable: true }]),
    },
    product: { findMany: vi.fn(async () => []) },
    appointment: {
      findFirst: vi.fn(async () => ({
        clientId: CLIENT,
        status: "confirmed",
        services: [
          {
            id: APPT_SVC,
            serviceId: SVC,
            staffId: STAFF,
            finalPrice: 40,
            staff: { commissionRate: 0 },
          },
        ],
      })),
      update: vi.fn(async () => ({})),
    },
    client: {
      findFirst: vi.fn(async () => ({ id: CLIENT, loyaltyPoints: 0 })),
      update: vi.fn(async () => ({})),
    },
    payment: {
      // The IN-TX idempotency re-check. On the second submit a completed Payment
      // already exists -> the guard must short-circuit before payment.create.
      findFirst: vi.fn(async () =>
        opts.paidAlready ? { id: EXISTING_PAYMENT_ID } : null,
      ),
      create: vi.fn(async () => ({ id: PAYMENT_ID, paymentReference: "PAY-X" })),
    },
    productInventory: {
      findFirst: vi.fn(async () => null),
      updateMany: vi.fn(async () => ({ count: 0 })),
      findUnique: vi.fn(async () => null),
      update: vi.fn(async () => ({})),
    },
    inventoryTransaction: { create: vi.fn(async () => ({ id: "it_1" })) },
    staffService: { findMany: vi.fn(async () => []) },
    commission: { create: vi.fn(async () => ({ id: "com_1" })) },
    loyaltyTransaction: { create: vi.fn(async () => ({ id: "loy_1" })) },
    appointmentProduct: { create: vi.fn(async () => ({ id: "ap_1" })) },
    payrollPeriod: { create: vi.fn(async () => ({ id: "pp_1" })) },
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return tx as any
}

const apptInput = {
  clientId: CLIENT,
  appointmentId: APPT,
  items: [{ type: "service" as const, id: SVC, quantity: 1 }],
  discount: 0,
  tax: 0,
  tip: 0,
  method: "cash" as const,
}

beforeEach(() => vi.clearAllMocks())

describe("recordCheckout — double-submit of the same appointment is idempotent (exactly ONE Payment)", () => {
  it("FIRST submit records exactly one Payment for the appointment", async () => {
    const tx = fakeTx({ paidAlready: false })

    const result = await recordCheckout(tx, BIZ, apptInput)

    // The in-tx guard ran (read existing completed payments) and found none.
    expect(tx.payment.findFirst).toHaveBeenCalledTimes(1)
    const findArg = tx.payment.findFirst.mock.calls[0][0] as unknown as {
      where: { appointmentId: string; businessId: string; type: string; status: string }
    }
    expect(findArg.where).toMatchObject({
      appointmentId: APPT,
      businessId: BIZ,
      type: "payment",
      status: "completed",
    })
    // Exactly one Payment written, tied to this appointment.
    expect(tx.payment.create).toHaveBeenCalledTimes(1)
    const createArg = tx.payment.create.mock.calls[0][0] as unknown as {
      data: { appointmentId: string; status: string; type: string }
    }
    expect(createArg.data.appointmentId).toBe(APPT)
    expect(createArg.data.status).toBe("completed")
    expect(result.payment.id).toBe(PAYMENT_ID)
  })

  it("SECOND submit (a completed Payment already exists) throws 'already been paid' and writes NO new Payment", async () => {
    const tx = fakeTx({ paidAlready: true })

    await expect(recordCheckout(tx, BIZ, apptInput)).rejects.toMatchObject({
      name: "RecordCheckoutError",
      code: "BAD_REQUEST",
      message: expect.stringMatching(/already been paid/i),
    })
    await expect(recordCheckout(tx, BIZ, apptInput)).rejects.toBeInstanceOf(RecordCheckoutError)

    // The guard fired BEFORE any write: no second Payment, no appointment flip,
    // no client-total bump, no commission row.
    expect(tx.payment.create).not.toHaveBeenCalled()
    expect(tx.appointment.update).not.toHaveBeenCalled()
    expect(tx.client.update).not.toHaveBeenCalled()
    expect(tx.commission.create).not.toHaveBeenCalled()
  })

  it("across both submits combined, tx.payment.create is invoked exactly ONCE (one Payment, not two)", async () => {
    // Drive the SAME appointment twice against ONE shared tx-creator: first call
    // sees no completed payment (writes one), second call sees the now-completed
    // payment (rejects). Net effect: a single Payment.create across both submits.
    let paid = false
    const create = vi.fn(async () => {
      paid = true
      return { id: PAYMENT_ID, paymentReference: "PAY-X" }
    })
    const baseTx = fakeTx({ paidAlready: false })
    // Make the in-tx re-check reflect the prior submit's write.
    baseTx.payment.findFirst = vi.fn(async () =>
      paid ? { id: EXISTING_PAYMENT_ID } : null,
    )
    baseTx.payment.create = create

    // First submit succeeds and writes the only Payment.
    await recordCheckout(baseTx, BIZ, apptInput)
    // Second submit must reject — the appointment is already paid.
    await expect(recordCheckout(baseTx, BIZ, apptInput)).rejects.toMatchObject({
      message: expect.stringMatching(/already been paid/i),
    })

    expect(create).toHaveBeenCalledTimes(1)
  })
})
