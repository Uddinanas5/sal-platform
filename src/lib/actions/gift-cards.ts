"use server"

import { z } from "zod"
import { Prisma } from "@/generated/prisma"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getBusinessContext, requireMinRole } from "@/lib/auth-utils"
import { redeemGiftCardInTx, GiftCardError } from "@/lib/checkout/gift-card-redeem"

type ActionResult<T = void> = { success: true; data: T } | { success: false; error: string }

const issueGiftCardSchema = z.object({
  code: z.string().min(1),
  initialValue: z.number().positive(),
  purchaserId: z.string().uuid().optional(),
  recipientName: z.string().optional(),
  recipientEmail: z.string().email().optional().or(z.literal("")),
  expiresAt: z.string().optional(),
})

export async function issueGiftCard(data: {
  code: string
  initialValue: number
  purchaserId?: string
  recipientName?: string
  recipientEmail?: string
  expiresAt?: string
}): Promise<ActionResult<{ id: string; code: string }>> {
  try {
    issueGiftCardSchema.parse(data)
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { success: false, error: "Invalid input: " + e.issues[0]?.message }
    }
    throw e
  }

  try {
    // Minting stored value is an admin-only op — /memberships is admin-gated at
    // the route layer, but server actions are directly-invokable RPC endpoints,
    // so a staff-role caller could otherwise mint a card then redeem it at
    // checkout. requireMinRole closes that internal-fraud hole (all sibling
    // memberships writes already enforce admin).
    const { businessId } = await requireMinRole("admin")

    // Check for duplicate code
    const existing = await prisma.giftCard.findFirst({
      where: { businessId, code: data.code },
    })
    if (existing) {
      return { success: false, error: "A gift card with this code already exists" }
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { currency: true },
    })

    let giftCard
    try {
      giftCard = await prisma.giftCard.create({
        data: {
          businessId,
          code: data.code,
          initialValue: data.initialValue,
          currentBalance: data.initialValue,
          currency: business?.currency || "USD",
          purchasedBy: data.purchaserId || null,
          recipientName: data.recipientName || null,
          recipientEmail: data.recipientEmail || null,
          isActive: true,
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        },
      })
    } catch (e) {
      // The pre-check above is non-transactional, so a concurrent issue (or the
      // now per-tenant unique index gift_cards_business_id_code_key) can still
      // collide on the create. Map the Prisma P2002 to the same friendly
      // message instead of leaking a raw constraint error.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        return { success: false, error: "A gift card with this code already exists" }
      }
      throw e
    }

    revalidatePath("/memberships")
    return { success: true, data: { id: giftCard.id, code: giftCard.code } }
  } catch (e) {
    console.error("issueGiftCard error:", e)
    return { success: false, error: (e as Error).message }
  }
}

const redeemGiftCardSchema = z.object({
  code: z.string().min(1),
  amount: z.number().positive(),
})

export async function redeemGiftCard(data: {
  code: string
  amount: number
}): Promise<ActionResult<{ remainingBalance: number }>> {
  try {
    redeemGiftCardSchema.parse(data)
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { success: false, error: "Invalid input: " + e.issues[0]?.message }
    }
    throw e
  }

  try {
    // This standalone redemption decrements a card's balance WITHOUT recording a
    // sale/Payment, so it must be admin-only — the staff checkout flow redeems via
    // redeemGiftCardInTx inside record-checkout (which writes a Payment), not here.
    const { businessId } = await requireMinRole("admin")

    // Concurrency-safe redemption: delegate to the same hardened in-tx helper
    // the checkout money-writer uses. It takes a pg_advisory_xact_lock on
    // (businessId, code) FIRST, then re-reads the balance under the lock and
    // decrements — so two concurrent redemptions can't both pass the
    // balance check and double-spend / drive the balance negative (TOCTOU).
    const { remainingBalance } = await prisma.$transaction(
      (tx) => redeemGiftCardInTx(tx, businessId, data.code, data.amount),
      { timeout: 20000, maxWait: 15000 },
    )

    revalidatePath("/memberships")
    revalidatePath("/checkout")
    return { success: true, data: { remainingBalance } }
  } catch (e) {
    // Map the typed in-tx failures to the same friendly messages this action
    // returned before, instead of surfacing a raw error.
    if (e instanceof GiftCardError) {
      if (e.code === "GIFT_CARD_NOT_FOUND") {
        return { success: false, error: "Gift card not found or inactive" }
      }
      if (e.code === "GIFT_CARD_EXPIRED") {
        return { success: false, error: "Gift card has expired" }
      }
      // GIFT_CARD_INSUFFICIENT — helper's message already includes the balance.
      return { success: false, error: e.message }
    }
    console.error("redeemGiftCard error:", e)
    return { success: false, error: (e as Error).message }
  }
}

export async function validateGiftCard(
  code: string,
): Promise<ActionResult<{ balance: number; status: string; expiresAt: string | null }>> {
  try {
    const { businessId } = await getBusinessContext()

    const giftCard = await prisma.giftCard.findFirst({
      where: { businessId, code },
    })

    if (!giftCard) {
      return { success: false, error: "Gift card not found" }
    }

    if (!giftCard.isActive) {
      return { success: false, error: "Gift card is inactive" }
    }

    if (giftCard.expiresAt && giftCard.expiresAt < new Date()) {
      return { success: false, error: "Gift card has expired" }
    }

    return {
      success: true,
      data: {
        balance: Number(giftCard.currentBalance),
        status: giftCard.isActive ? "active" : "inactive",
        expiresAt: giftCard.expiresAt ? giftCard.expiresAt.toISOString() : null,
      },
    }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
