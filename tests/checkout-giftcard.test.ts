import { describe, it, expect, beforeEach, vi } from "vitest"
import { recordCheckout, RecordCheckoutError } from "@/lib/checkout/record-checkout"
import { GiftCardError } from "@/lib/checkout/gift-card-redeem"
import { TAX_RATE } from "@/lib/utils"

// Gift cards as a REAL tender at checkout (money-critical). recordCheckout is the
// single money writer, so the balance read → verify → decrement happens HERE,
// inside the same transaction as the Payment — server-authoritative, never from
// the caller. BETA rule: the card must cover the FULL server-computed total
// (no partial/split redemption).
//
// Pure unit tests over a fake Prisma tx — no DB. Mirrors the select/update
// shapes recordCheckout + redeemGiftCardInTx issue, and asserts:
//   - full-cover success decrements the balance + zeroes/deactivates the card
//   - insufficient balance rejects (GIFT_CARD_INSUFFICIENT) and writes nothing
//   - expired / inactive rejects
//   - cross-tenant code rejects (lookup is businessId-scoped)
//   - the caller still can't influence totals (price authority holds)
//   - the "card" method is still rejected upstream (schema-level, asserted in the
//     action/route/MCP tests; here we assert recordCheckout itself stays honest).

const cents = (n: number) => Math.round(n * 100) / 100

// Mirror the server's exact per-line tax math for a single fully-taxable line
// at the flat TAX_RATE fallback (subtotal = amount, no discount/tip). Using the
// same float ops as recordCheckout keeps these expectations robust against
// half-cent rounding (e.g. 60 * 0.08875 = 5.3249… → 5.32, total 65.32).
const serverTotalNoDiscount = (subtotal: number) => {
  const tax = cents(subtotal * 1 * TAX_RATE)
  return cents(subtotal + tax)
}

const BIZ = "11111111-1111-4111-8111-111111111111"
const OTHER_BIZ = "99999999-9999-4999-8999-999999999999"
const SVC = "22222222-2222-4222-8222-222222222222"
const CLIENT = "44444444-4444-4444-8444-444444444444"
const GC_ID = "88888888-8888-4888-8888-888888888888"
const CODE = "GIFT-ABCD-1234"

type GiftCardRow = {
  id: string
  businessId: string
  currentBalance: number
  expiresAt: Date | null
  isActive: boolean
}

type TxOptions = {
  servicePrice?: number
  // Gift card state for the redemption lookup. null → no matching active card.
  giftCard?: GiftCardRow | null
}

type PayrollRow = { id: string; periodStart: Date; periodEnd: Date; status: string }

function fakeTx(o: TxOptions = {}) {
  const servicePrice = o.servicePrice ?? 60
  // Default: an active card with a generous balance scoped to BIZ.
  const giftCard: GiftCardRow | null =
    o.giftCard === undefined
      ? { id: GC_ID, businessId: BIZ, currentBalance: 1000, expiresAt: null, isActive: true }
      : o.giftCard
  const periods: PayrollRow[] = []

  const tx = {
    $executeRaw: vi.fn(),
    business: { findUnique: vi.fn(async () => ({ settings: {}, currency: "USD" })) },
    service: {
      findMany: vi.fn(async () => [{ id: SVC, price: servicePrice, taxRate: null, isTaxable: true }]),
    },
    product: { findMany: vi.fn(async () => []) },
    appointment: {
      findFirst: vi.fn(async () => ({ clientId: null, services: [] })),
      update: vi.fn(async () => ({})),
    },
    client: {
      findFirst: vi.fn(async (args: { where: { id: string; businessId: string } }) => {
        if (args.where.businessId !== BIZ) return null
        return { id: CLIENT, loyaltyPoints: 0 }
      }),
      update: vi.fn(async () => ({})),
    },
    giftCard: {
      // Tenant-scoped lookup: businessId + code + isActive. We honor businessId
      // here so a foreign business sees no card (→ GIFT_CARD_NOT_FOUND).
      findFirst: vi.fn(async (args: { where: { businessId: string; code: string; isActive: boolean } }) => {
        if (!giftCard) return null
        if (args.where.businessId !== giftCard.businessId) return null
        if (args.where.code !== CODE) return null
        if (args.where.isActive && !giftCard.isActive) return null
        return {
          id: giftCard.id,
          currentBalance: giftCard.currentBalance,
          expiresAt: giftCard.expiresAt,
        }
      }),
      update: vi.fn(async () => ({})),
    },
    payment: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async () => ({ id: "pay_1", paymentReference: "PAY-X" })),
    },
    productInventory: { findFirst: vi.fn(async () => null), update: vi.fn() },
    staffService: { findMany: vi.fn(async () => []) },
    commission: { create: vi.fn(async () => ({ id: "com_1" })) },
    loyaltyTransaction: { create: vi.fn(async () => ({ id: "loy_1" })) },
    business: { findUnique: vi.fn(async () => ({ timezone: "UTC" })) },
    payrollPeriod: {
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
  // No client/appointment so we isolate the gift-card tender path from loyalty.
  items: [{ type: "service" as const, id: SVC, quantity: 1 }],
  discount: 0,
  tax: 0,
  tip: 0,
  method: "gift_card" as const,
  giftCardCode: CODE,
  ...extra,
})

beforeEach(() => vi.clearAllMocks())

describe("recordCheckout — gift card REDEMPTION (a tender)", () => {
  it("full-cover success decrements the balance by the SERVER total", async () => {
    // subtotal 60, flat TAX_RATE → total = 60 + 60*0.08875 = 65.33. Card has $1000.
    const tx = fakeTx({ servicePrice: 60 })

    const res = await recordCheckout(tx, BIZ, baseInput())

    const expectedTotal = serverTotalNoDiscount(60) // 65.32
    expect(res.total).toBe(expectedTotal)

    // The card lookup is scoped by businessId + code + isActive.
    expect(tx.giftCard.findFirst).toHaveBeenCalledWith({
      where: { businessId: BIZ, code: CODE, isActive: true },
      select: { id: true, currentBalance: true, expiresAt: true },
    })
    // Balance decremented by the server total (1000 - 65.33 = 934.67), card stays active.
    const updateArg = tx.giftCard.update.mock.calls[0][0]
    expect(updateArg.where).toEqual({ id: GC_ID })
    expect(updateArg.data.currentBalance).toBe(cents(1000 - expectedTotal))
    expect(updateArg.data.isActive).toBeUndefined()
    expect(updateArg.data.redeemedAt).toBeUndefined()

    // Payment records the masked code (last 4) in methodNote (NOT a card field).
    const paymentArg = tx.payment.create.mock.calls[0][0]
    expect(paymentArg.data.method).toBe("gift_card")
    expect(paymentArg.data.methodNote).toBe("Gift card •••• 1234")
    expect(paymentArg.data.totalAmount).toBe(expectedTotal)
  })

  it("zeroes + deactivates the card when the balance lands exactly on the total", async () => {
    // Card balance equals the total exactly → balance hits 0 → isActive false + redeemedAt set.
    const total = serverTotalNoDiscount(60) // 65.32
    const tx = fakeTx({
      servicePrice: 60,
      giftCard: { id: GC_ID, businessId: BIZ, currentBalance: total, expiresAt: null, isActive: true },
    })

    await recordCheckout(tx, BIZ, baseInput())

    const updateArg = tx.giftCard.update.mock.calls[0][0]
    expect(updateArg.data.currentBalance).toBe(0)
    expect(updateArg.data.isActive).toBe(false)
    expect(updateArg.data.redeemedAt).toBeInstanceOf(Date)
  })

  it("rejects when the card balance can't cover the full total (no partial in beta)", async () => {
    // Total is 65.33 but the card only has $50 → GIFT_CARD_INSUFFICIENT.
    const tx = fakeTx({
      servicePrice: 60,
      giftCard: { id: GC_ID, businessId: BIZ, currentBalance: 50, expiresAt: null, isActive: true },
    })

    await expect(recordCheckout(tx, BIZ, baseInput())).rejects.toMatchObject({
      code: "GIFT_CARD_INSUFFICIENT",
    })
    // Nothing was written — no balance change, no payment.
    expect(tx.giftCard.update).not.toHaveBeenCalled()
    expect(tx.payment.create).not.toHaveBeenCalled()
  })

  it("rejects an expired card (GIFT_CARD_EXPIRED) and writes nothing", async () => {
    const tx = fakeTx({
      servicePrice: 60,
      giftCard: {
        id: GC_ID,
        businessId: BIZ,
        currentBalance: 1000,
        expiresAt: new Date("2020-01-01T00:00:00Z"),
        isActive: true,
      },
    })

    await expect(recordCheckout(tx, BIZ, baseInput())).rejects.toMatchObject({
      code: "GIFT_CARD_EXPIRED",
    })
    expect(tx.giftCard.update).not.toHaveBeenCalled()
    expect(tx.payment.create).not.toHaveBeenCalled()
  })

  it("rejects an inactive card (treated as NOT_FOUND) and writes nothing", async () => {
    const tx = fakeTx({
      servicePrice: 60,
      giftCard: { id: GC_ID, businessId: BIZ, currentBalance: 1000, expiresAt: null, isActive: false },
    })

    await expect(recordCheckout(tx, BIZ, baseInput())).rejects.toBeInstanceOf(GiftCardError)
    await expect(recordCheckout(tx, BIZ, baseInput())).rejects.toMatchObject({
      code: "GIFT_CARD_NOT_FOUND",
    })
    expect(tx.giftCard.update).not.toHaveBeenCalled()
    expect(tx.payment.create).not.toHaveBeenCalled()
  })

  it("rejects an unknown code (GIFT_CARD_NOT_FOUND)", async () => {
    const tx = fakeTx({ servicePrice: 60, giftCard: null })

    await expect(recordCheckout(tx, BIZ, baseInput())).rejects.toMatchObject({
      code: "GIFT_CARD_NOT_FOUND",
    })
    expect(tx.payment.create).not.toHaveBeenCalled()
  })

  it("requires a gift card code when paying by gift card", async () => {
    const tx = fakeTx({ servicePrice: 60 })

    await expect(
      recordCheckout(tx, BIZ, baseInput({ giftCardCode: undefined })),
    ).rejects.toBeInstanceOf(RecordCheckoutError)
    // No card lookup, no payment.
    expect(tx.giftCard.findFirst).not.toHaveBeenCalled()
    expect(tx.payment.create).not.toHaveBeenCalled()
  })
})

describe("recordCheckout — gift card tenant isolation", () => {
  it("scopes the card lookup by businessId — a foreign business can't spend the card", async () => {
    // The card belongs to BIZ; calling with OTHER_BIZ must surface NOT_FOUND.
    const tx = fakeTx({
      servicePrice: 60,
      giftCard: { id: GC_ID, businessId: BIZ, currentBalance: 1000, expiresAt: null, isActive: true },
    })

    await expect(recordCheckout(tx, OTHER_BIZ, baseInput())).rejects.toMatchObject({
      code: "GIFT_CARD_NOT_FOUND",
    })
    // The lookup used the (foreign) businessId we passed in, never trusted input.
    const lookupArgs = tx.giftCard.findFirst.mock.calls[0][0]
    expect(lookupArgs.where.businessId).toBe(OTHER_BIZ)
    expect(tx.payment.create).not.toHaveBeenCalled()
  })
})

describe("recordCheckout — gift card can't influence totals", () => {
  it("ignores caller-supplied tax/total and redeems exactly the SERVER total", async () => {
    const tx = fakeTx({ servicePrice: 60 })

    // Caller LIES: tax 999. recordCheckout recomputes from the DB tax config.
    const res = await recordCheckout(tx, BIZ, baseInput({ tax: 999 }))

    const expectedTotal = serverTotalNoDiscount(60) // 65.32, NOT influenced by 999
    expect(res.total).toBe(expectedTotal)
    const updateArg = tx.giftCard.update.mock.calls[0][0]
    expect(updateArg.data.currentBalance).toBe(cents(1000 - expectedTotal))
  })
})
