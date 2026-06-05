import { createHash } from "node:crypto"
import type { Prisma } from "@/generated/prisma"

/**
 * Serializes appointment writes for one staff member inside a transaction.
 * The lock is released automatically when the transaction commits or rolls back.
 */
export async function lockStaffSchedule(
  tx: Pick<Prisma.TransactionClient, "$executeRaw">,
  businessId: string,
  staffId: string
): Promise<void> {
  const hash = createHash("sha256").update(`${businessId}:${staffId}`).digest()
  const key1 = hash.readInt32BE(0)
  const key2 = hash.readInt32BE(4)

  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${key1}::int4, ${key2}::int4)`
}
