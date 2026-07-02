import { prisma } from "@/lib/prisma"
import { Prisma } from "@/generated/prisma"
import { lockBusiness } from "@/lib/db/advisory-lock"

/**
 * Atomically merge one top-level key into Business.settings (a JSON blob).
 *
 * The settings tabs each own a different key (onlinePresence, notifications,
 * payments, booking) but all persist by read-modify-write on the SAME JSON
 * column. Without serialization, two tabs saving different keys race: both read
 * the old blob, each writes back its key on top of the stale copy, and the
 * first save is lost. A per-business advisory lock inside a transaction makes the
 * read+merge+write atomic so concurrent saves of different keys both survive.
 */
export async function mergeBusinessSettings(
  businessId: string,
  key: string,
  value: unknown
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await lockBusiness(tx, businessId)
    const biz = await tx.business.findUnique({
      where: { id: businessId },
      select: { settings: true },
    })
    const existing =
      biz && typeof biz.settings === "object" && biz.settings !== null
        ? (biz.settings as Record<string, unknown>)
        : {}
    await tx.business.update({
      where: { id: businessId },
      data: { settings: { ...existing, [key]: value } as Prisma.InputJsonValue },
    })
  })
}
