"use server"

import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getBusinessContext } from "@/lib/auth-utils"

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
    const { businessId } = await getBusinessContext()

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

    const giftCard = await prisma.giftCard.create({
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
    const { businessId } = await getBusinessContext()

    const giftCard = await prisma.giftCard.findFirst({
      where: { businessId, code: data.code, isActive: true },
    })

    if (!giftCard) {
      return { success: false, error: "Gift card not found or inactive" }
    }

    if (giftCard.expiresAt && giftCard.expiresAt < new Date()) {
      await prisma.giftCard.update({
        where: { id: giftCard.id },
        data: { isActive: false },
      })
      return { success: false, error: "Gift card has expired" }
    }

    const balance = Number(giftCard.currentBalance)
    if (balance < data.amount) {
      return { success: false, error: `Insufficient balance. Available: $${balance.toFixed(2)}` }
    }

    const newBalance = balance - data.amount
    await prisma.giftCard.update({
      where: { id: giftCard.id },
      data: {
        currentBalance: newBalance,
        ...(newBalance === 0 ? { isActive: false, redeemedAt: new Date() } : {}),
      },
    })

    revalidatePath("/memberships")
    revalidatePath("/checkout")
    return { success: true, data: { remainingBalance: newBalance } }
  } catch (e) {
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
