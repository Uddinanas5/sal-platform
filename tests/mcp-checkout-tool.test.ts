import { describe, it, expect, beforeEach, vi } from "vitest"

// The MCP `process-checkout` tool used to be a THIRD checkout writer that called
// tx.payment.create directly — writing a Payment but no Commission, never
// bootstrapping a payroll period, and trusting caller-supplied
// subtotal/discount/total/price. It now routes through the same single-writer
// `recordCheckout` as the dashboard action + /api/v1/checkout, so money is
// recomputed from DB prices and commissions/period are written in one tx.
//
// Pure unit test: we mock prisma + recordCheckout, capture the handler the tool
// registers on a fake McpServer, and assert delegation + money-from-result +
// the appointment idempotency guard + card/gift_card rejection.

// vi.mock factories are hoisted above all imports + top-level declarations, so
// anything they reference must be created in vi.hoisted (which also runs in the
// hoisted phase) — otherwise the class/const is still in its TDZ when the
// factory runs and the whole suite fails to load with a ReferenceError.
const { recordCheckout, RecordCheckoutError, appointmentFindFirst, paymentFindFirst, transaction } =
  vi.hoisted(() => {
    class RecordCheckoutError extends Error {
      code: string
      constructor(code: string, message: string) {
        super(message)
        this.code = code
        this.name = "RecordCheckoutError"
      }
    }
    return {
      recordCheckout: vi.fn(),
      RecordCheckoutError,
      appointmentFindFirst: vi.fn(),
      paymentFindFirst: vi.fn(),
      transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn({})),
    }
  })

vi.mock("@/lib/checkout/record-checkout", () => ({
  recordCheckout,
  RecordCheckoutError,
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    appointment: { findFirst: (...a: unknown[]) => appointmentFindFirst(...a) },
    payment: { findFirst: (...a: unknown[]) => paymentFindFirst(...a) },
    $transaction: (fn: (tx: unknown) => unknown) => transaction(fn),
  },
}))

import { registerCheckoutTools } from "@/lib/mcp/tools/checkout"

const BIZ = "11111111-1111-4111-8111-111111111111"
const SVC = "22222222-2222-4222-8222-222222222222"
const CLIENT = "44444444-4444-4444-8444-444444444444"
const APPT = "55555555-5555-4555-8555-555555555555"

// Capture the handler `server.tool(name, desc, schema, handler)` registers.
type ToolHandler = (args: Record<string, unknown>) => Promise<{
  content: { type: "text"; text: string }[]
  isError?: boolean
}>

function loadTool() {
  let handler: ToolHandler | undefined
  let schema: Record<string, { safeParse: (v: unknown) => { success: boolean } }> | undefined
  const fakeServer = {
    tool: (_name: string, _desc: string, s: typeof schema, h: ToolHandler) => {
      schema = s
      handler = h
    },
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerCheckoutTools(fakeServer as any, { userId: "u1", businessId: BIZ, role: "admin" } as any)
  if (!handler || !schema) throw new Error("tool not registered")
  return { handler, schema }
}

const parse = (out: { content: { text: string }[] }) => JSON.parse(out.content[0].text)

beforeEach(() => {
  vi.clearAllMocks()
  appointmentFindFirst.mockResolvedValue(null)
  paymentFindFirst.mockResolvedValue(null)
  recordCheckout.mockResolvedValue({
    payment: { id: "pay_1", paymentReference: "PAY-20260604-ABCD" },
    commissions: [{ id: "com_1" }],
    subtotal: 60,
    amount: 60,
    total: 65.33,
  })
})

describe("MCP process-checkout tool", () => {
  it("routes through recordCheckout (single writer) and never trusts caller money", async () => {
    const { handler } = loadTool()
    const out = await handler({
      clientId: CLIENT,
      items: [{ type: "service", id: SVC, quantity: 1, price: 9999 }],
      // Caller LIES about the money — must be ignored.
      subtotal: 1,
      discount: 0,
      tax: 5.33,
      tip: 0,
      total: 1,
      method: "cash",
    })

    // Delegated to the single writer inside a transaction.
    expect(transaction).toHaveBeenCalledTimes(1)
    expect(recordCheckout).toHaveBeenCalledTimes(1)
    const [, businessIdArg, dataArg] = recordCheckout.mock.calls[0]
    expect(businessIdArg).toBe(BIZ)
    // Only {type,id,quantity}/discount/tip/method are forwarded — no price/
    // subtotal/total, and tax is dropped too (recomputed server-side from the DB).
    expect(dataArg.items).toEqual([{ type: "service", id: SVC, quantity: 1 }])
    expect(dataArg).not.toHaveProperty("subtotal")
    expect(dataArg).not.toHaveProperty("total")
    expect(dataArg).not.toHaveProperty("tax")
    expect(dataArg.items[0]).not.toHaveProperty("price")

    // Response money comes from recordCheckout's result, not the caller.
    const body = parse(out)
    expect(body.subtotal).toBe(60)
    expect(body.amount).toBe(60)
    expect(body.total).toBe(65.33)
    expect(body.paymentReference).toBe("PAY-20260604-ABCD")
  })

  it("blocks a second checkout of an already-paid appointment (idempotency guard)", async () => {
    const { handler } = loadTool()
    appointmentFindFirst.mockResolvedValue({ clientId: CLIENT, status: "scheduled" })
    paymentFindFirst.mockResolvedValue({ id: "pay_existing" })

    const out = await handler({
      appointmentId: APPT,
      items: [{ type: "service", id: SVC, quantity: 1 }],
      method: "cash",
    })

    expect(out.isError).toBe(true)
    expect(parse(out).error).toMatch(/already been paid/i)
    expect(recordCheckout).not.toHaveBeenCalled()
  })

  it("rejects an already-completed appointment", async () => {
    const { handler } = loadTool()
    appointmentFindFirst.mockResolvedValue({ clientId: CLIENT, status: "completed" })

    const out = await handler({
      appointmentId: APPT,
      items: [{ type: "service", id: SVC, quantity: 1 }],
      method: "cash",
    })

    expect(out.isError).toBe(true)
    expect(parse(out).error).toMatch(/already been checked out/i)
    expect(recordCheckout).not.toHaveBeenCalled()
  })

  it("surfaces RecordCheckoutError messages instead of a generic failure", async () => {
    const { handler } = loadTool()
    recordCheckout.mockRejectedValue(new RecordCheckoutError("NOT_FOUND", "One or more services not found"))

    const out = await handler({
      items: [{ type: "service", id: SVC, quantity: 1 }],
      method: "cash",
    })

    expect(out.isError).toBe(true)
    expect(parse(out).error).toBe("One or more services not found")
  })

  it("rejects the card method server-side (not live in beta) but accepts gift_card", () => {
    const { schema } = loadTool()
    expect(schema.method.safeParse("cash").success).toBe(true)
    expect(schema.method.safeParse("online").success).toBe(true)
    // "card" stays rejected — online charging via SAL Payments is off in beta.
    expect(schema.method.safeParse("card").success).toBe(false)
    // "gift_card" is now a live tender (redeemed server-side in recordCheckout).
    expect(schema.method.safeParse("gift_card").success).toBe(true)
  })

  it("requires a giftCardCode when method is gift_card (rejects before any write)", async () => {
    const { handler } = loadTool()

    const out = await handler({
      items: [{ type: "service", id: SVC, quantity: 1 }],
      method: "gift_card",
      // no giftCardCode
    })

    expect(out.isError).toBe(true)
    expect(parse(out).error).toMatch(/gift card code is required/i)
    expect(recordCheckout).not.toHaveBeenCalled()
  })

  it("forwards the giftCardCode to recordCheckout for a gift_card tender", async () => {
    const { handler } = loadTool()

    await handler({
      clientId: CLIENT,
      items: [{ type: "service", id: SVC, quantity: 1 }],
      method: "gift_card",
      giftCardCode: "GIFT-ABCD-1234",
    })

    expect(recordCheckout).toHaveBeenCalledTimes(1)
    const [, , dataArg] = recordCheckout.mock.calls[0]
    expect(dataArg.method).toBe("gift_card")
    expect(dataArg.giftCardCode).toBe("GIFT-ABCD-1234")
  })
})
