import type { Prisma } from "@/generated/prisma"
import { lockGiftCard } from "@/lib/db/advisory-lock"

/**
 * In-transaction gift-card redemption used by the single money writer
 * (recordCheckout). Lives outside `src/lib/actions/gift-cards.ts` on purpose:
 * that file is `"use server"` and may only export serializable async server
 * actions, whereas this helper takes a non-serializable `tx` and exports a
 * sync mask helper + an Error subclass. The user-facing server actions
 * (issueGiftCard / redeemGiftCard / validateGiftCard) stay in the actions file.
 */

/**
 * Typed error thrown by the in-transaction gift-card redemption path. The
 * surrounding checkout transaction rolls back on any of these, and each entry
 * point maps the code to a friendly message. Distinct from RecordCheckoutError
 * so the gift-card failure modes stay self-documenting.
 */
export type GiftCardErrorCode =
  | "GIFT_CARD_NOT_FOUND"
  | "GIFT_CARD_EXPIRED"
  | "GIFT_CARD_INSUFFICIENT"

export class GiftCardError extends Error {
  constructor(public code: GiftCardErrorCode, message: string) {
    super(message)
    this.name = "GiftCardError"
  }
}

/** Last-4 masked label for a gift-card code, honest + safe to persist/show. */
export function maskGiftCardCode(code: string): string {
  const last4 = code.slice(-4)
  return `Gift card •••• ${last4}`
}

/**
 * Redeem a gift card for `amount` INSIDE an existing checkout transaction.
 *
 * Server-authoritative + concurrency-safe: the caller (recordCheckout) has
 * already computed the server `total`; this helper takes an advisory lock on
 * (businessId, code) so a concurrent checkout of the SAME card can't double
 * spend, then re-reads the balance under the lock, verifies it covers the full
 * amount, and decrements. When the balance hits 0 the card is deactivated and
 * stamped redeemedAt.
 *
 * BETA RULE: the gift card must cover the FULL amount — there is NO partial /
 * split redemption (a partial tender would need a second tender we don't
 * collect in beta). Partial redemption is a post-beta feature.
 *
 * Throws GiftCardError (NOT_FOUND / EXPIRED / INSUFFICIENT) so the surrounding
 * transaction rolls back and no Payment is recorded against a card that wasn't
 * actually charged. All lookups are scoped by businessId (tenant isolation)
 * even though `code` is globally unique.
 */
export async function redeemGiftCardInTx(
  tx: Prisma.TransactionClient,
  businessId: string,
  code: string,
  amount: number,
): Promise<{ giftCardId: string; remainingBalance: number; maskedCode: string }> {
  // Serialize concurrent redemptions of the SAME card (read → verify →
  // decrement is atomic under this lock; released on commit/rollback).
  await lockGiftCard(tx, businessId, code)

  // Tenant-scoped lookup: businessId + code + active. An inactive card (already
  // fully redeemed or manually disabled) is treated as NOT_FOUND here.
  const giftCard = await tx.giftCard.findFirst({
    where: { businessId, code, isActive: true },
    select: { id: true, currentBalance: true, expiresAt: true },
  })

  if (!giftCard) {
    throw new GiftCardError("GIFT_CARD_NOT_FOUND", "Gift card not found or inactive")
  }

  if (giftCard.expiresAt && giftCard.expiresAt < new Date()) {
    throw new GiftCardError("GIFT_CARD_EXPIRED", "Gift card has expired")
  }

  const balance = Number(giftCard.currentBalance)
  // FULL-cover only (beta): no partial redemption. The small epsilon absorbs
  // float dust so a $50.00 card can pay a $50.00 total.
  if (balance + 0.0049 < amount) {
    throw new GiftCardError(
      "GIFT_CARD_INSUFFICIENT",
      `Insufficient gift-card balance. Available: $${balance.toFixed(2)}, required: $${amount.toFixed(2)}`,
    )
  }

  const newBalance = Math.round((balance - amount) * 100) / 100
  await tx.giftCard.update({
    where: { id: giftCard.id },
    data: {
      currentBalance: newBalance,
      ...(newBalance === 0 ? { isActive: false, redeemedAt: new Date() } : {}),
    },
  })

  return { giftCardId: giftCard.id, remainingBalance: newBalance, maskedCode: maskGiftCardCode(code) }
}
