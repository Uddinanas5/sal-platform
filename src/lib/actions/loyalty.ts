"use server"

import { prisma } from "@/lib/prisma"
import { getBusinessContext } from "@/lib/auth-utils"

// Pure rate math lives in src/lib/loyalty.ts (not a "use server" module — that
// file's exports are constants/sync helpers and can be imported by the writer,
// the UI, and tests). This action file only exposes async server actions.

export type LoyaltyBalanceResult =
  | { success: true; data: { points: number } }
  | { success: false; error: string }

/**
 * Read a client's current loyalty balance for the AUTHENTICATED business only.
 * businessId is derived from the session — never accepted from the caller — so
 * one tenant can't probe another tenant's client balances. Used by the cart's
 * "redeem points" affordance to show the live available balance.
 */
export async function getClientLoyaltyBalance(clientId: string): Promise<LoyaltyBalanceResult> {
  try {
    const { businessId } = await getBusinessContext()
    const client = await prisma.client.findFirst({
      where: { id: clientId, businessId, deletedAt: null },
      select: { loyaltyPoints: true },
    })
    if (!client) return { success: false, error: "Client not found" }
    return { success: true, data: { points: client.loyaltyPoints } }
  } catch (e) {
    const msg = (e as Error).message
    if (msg === "Not authenticated" || msg === "No business context") {
      return { success: false, error: msg }
    }
    console.error("getClientLoyaltyBalance error:", e)
    return { success: false, error: "Failed to load loyalty balance" }
  }
}
