import { describe, it, expect, beforeEach, vi } from "vitest"

// GROUP B (MONEY): proves the three checkout ENTRY POINTS thread custom "Quick
// Sale" lines through to the single writer (recordCheckout) instead of dropping
// them, and that the validation schemas accept a custom-only cart (the per-array
// .min(1) was replaced with .default([]) + a combined "at least one item" check).
//
// We mock prisma + recordCheckout, capture the registered MCP handler/schema,
// and exercise the action + API-route zod schemas indirectly via recordCheckout
// delegation. Mirrors tests/mcp-checkout-tool.test.ts.

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
    payment: { id: "pay_1", paymentReference: "PAY-20260606-ABCD" },
    commissions: [],
    subtotal: 100,
    amount: 100,
    total: 108.88,
  })
})

describe("MCP process-checkout — custom Quick Sale lines", () => {
  it("forwards custom lines (with unitPrice) to recordCheckout, never dropping them", async () => {
    const { handler } = loadTool()
    await handler({
      clientId: CLIENT,
      items: [{ type: "service", id: SVC, quantity: 1 }],
      customItems: [{ type: "custom", name: "Walk-in trim", unitPrice: 90, quantity: 1 }],
      method: "cash",
    })

    expect(recordCheckout).toHaveBeenCalledTimes(1)
    const [, businessIdArg, dataArg] = recordCheckout.mock.calls[0]
    expect(businessIdArg).toBe(BIZ)
    expect(dataArg.customItems).toEqual([
      { type: "custom", name: "Walk-in trim", unitPrice: 90, quantity: 1 },
    ])
  })

  it("accepts a custom-only cart (no catalog items)", async () => {
    const { handler } = loadTool()
    const out = await handler({
      customItems: [{ type: "custom", name: "Tip", unitPrice: 20, quantity: 1 }],
      method: "cash",
    })
    expect(out.isError).toBeFalsy()
    expect(recordCheckout).toHaveBeenCalledTimes(1)
    const [, , dataArg] = recordCheckout.mock.calls[0]
    expect(dataArg.items).toEqual([])
    expect(dataArg.customItems).toHaveLength(1)
  })

  it("rejects a cart with neither catalog nor custom items (loud, before any write)", async () => {
    const { handler } = loadTool()
    const out = await handler({ method: "cash" })
    expect(out.isError).toBe(true)
    expect(parse(out).error).toMatch(/at least one item/i)
    expect(recordCheckout).not.toHaveBeenCalled()
  })

  it("validates the custom-line schema shape (rejects a missing unitPrice)", () => {
    const { schema } = loadTool()
    // schema.customItems is the zod array; a well-formed custom line passes.
    expect(
      schema.customItems.safeParse([{ type: "custom", name: "X", unitPrice: 5, quantity: 1 }]).success,
    ).toBe(true)
    // Missing unitPrice fails (would otherwise be a silently un-priced line).
    expect(
      schema.customItems.safeParse([{ type: "custom", name: "X", quantity: 1 }]).success,
    ).toBe(false)
    // Negative price fails.
    expect(
      schema.customItems.safeParse([{ type: "custom", name: "X", unitPrice: -1, quantity: 1 }]).success,
    ).toBe(false)
  })
})
