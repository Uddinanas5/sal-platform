import { createHash } from "node:crypto"
import type { Prisma } from "@/generated/prisma"

/**
 * Transaction-scoped advisory lock keyed on (businessId, staffId).
 * Serializes concurrent appointment writes for the same staff member so
 * the conflict-check / insert pair in a $transaction cannot race.
 * Released automatically on commit or rollback.
 */
export async function lockStaffSchedule(
  tx: Prisma.TransactionClient,
  businessId: string,
  staffId: string,
): Promise<void> {
  const hash = createHash("sha256").update(`${businessId}:${staffId}`).digest()
  const key1 = hash.readInt32BE(0)
  const key2 = hash.readInt32BE(4)
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${key1}::int4, ${key2}::int4)`
}

/**
 * Transaction-scoped advisory lock keyed on (businessId, clientId).
 * Serializes concurrent checkouts for the same client so the loyalty-point
 * read → validate → decrement pair cannot race and drive the balance negative.
 * The "client:" prefix keeps this keyspace distinct from lockStaffSchedule.
 * Released automatically on commit or rollback.
 */
export async function lockClient(
  tx: Prisma.TransactionClient,
  businessId: string,
  clientId: string,
): Promise<void> {
  const hash = createHash("sha256").update(`client:${businessId}:${clientId}`).digest()
  const key1 = hash.readInt32BE(0)
  const key2 = hash.readInt32BE(4)
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${key1}::int4, ${key2}::int4)`
}
