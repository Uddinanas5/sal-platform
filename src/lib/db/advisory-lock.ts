import { createHash } from "node:crypto"
import { Prisma } from "@/generated/prisma"

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

/**
 * Transaction-scoped advisory lock keyed on (businessId, giftCardCode).
 * Serializes concurrent checkouts that redeem the SAME gift card so the
 * balance read → verify → decrement pair cannot race and over-redeem (which
 * would drive currentBalance negative / double-spend a card). The "giftcard:"
 * prefix keeps this keyspace distinct from the staff/client locks.
 * Released automatically on commit or rollback.
 */
export async function lockGiftCard(
  tx: Prisma.TransactionClient,
  businessId: string,
  code: string,
): Promise<void> {
  const hash = createHash("sha256").update(`giftcard:${businessId}:${code}`).digest()
  const key1 = hash.readInt32BE(0)
  const key2 = hash.readInt32BE(4)
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${key1}::int4, ${key2}::int4)`
}

/**
 * Transaction-scoped advisory lock keyed on businessId alone. Serializes
 * business-wide bootstrap operations that would otherwise race (e.g. auto-
 * creating the first PayrollPeriod on the first-ever checkout), where two
 * concurrent transactions for different clients share no other lock. The
 * "business:" prefix keeps this keyspace distinct.
 */
export async function lockBusiness(
  tx: Prisma.TransactionClient,
  businessId: string,
): Promise<void> {
  const hash = createHash("sha256").update(`business:${businessId}`).digest()
  const key1 = hash.readInt32BE(0)
  const key2 = hash.readInt32BE(4)
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${key1}::int4, ${key2}::int4)`
}

/**
 * Transaction-scoped advisory lock keyed on (businessId, appointmentId).
 * Serializes concurrent checkouts of the SAME appointment so the
 * already-paid / already-completed re-check can run INSIDE the transaction
 * without two writers both passing it and double-recording the sale
 * (Payment + commission + loyalty + revenue). The "appt:" prefix keeps this
 * keyspace distinct from the staff/client/gift-card locks. Released on
 * commit or rollback.
 */
export async function lockAppointment(
  tx: Prisma.TransactionClient,
  businessId: string,
  appointmentId: string,
): Promise<void> {
  const hash = createHash("sha256").update(`appt:${businessId}:${appointmentId}`).digest()
  const key1 = hash.readInt32BE(0)
  const key2 = hash.readInt32BE(4)
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${key1}::int4, ${key2}::int4)`
}

/**
 * Detect the contention-induced failures a booking/checkout $transaction can
 * surface when many concurrent requests serialize behind the same advisory
 * lock. These are NOT integrity failures — exactly one writer still wins; the
 * losers either hit the interactive-transaction timeout (P2028) or a
 * write-conflict/deadlock retry (P2034). They should map to the SAME "slot is
 * already taken, please try again" client error as a CONFLICT, never a 500.
 *
 * P2028 = transaction API error (timeout / transaction already closed)
 * P2034 = write conflict or deadlock; transaction should be retried
 *
 * Also matches the raw timeout strings ("expired transaction" /
 * "Transaction API error") as a belt-and-braces fallback in case the engine
 * surfaces them without a typed code.
 */
export function isBookingContentionError(e: unknown): boolean {
  if (
    e instanceof Prisma.PrismaClientKnownRequestError &&
    (e.code === "P2028" || e.code === "P2034")
  ) {
    return true
  }
  const message = e instanceof Error ? e.message : ""
  return (
    message.includes("expired transaction") ||
    message.includes("Transaction API error")
  )
}
