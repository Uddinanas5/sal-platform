import { AsyncLocalStorage } from "node:async_hooks"
import type { Prisma, PrismaClient } from "@/generated/prisma"

const transactionDepth = new AsyncLocalStorage<number>()

export function inTrackedTransaction(): boolean {
  return (transactionDepth.getStore() ?? 0) > 0
}

export async function trackTransactionScope<T>(fn: () => Promise<T>): Promise<T> {
  const depth = transactionDepth.getStore() ?? 0
  return transactionDepth.run(depth + 1, fn)
}

export async function trackedTransaction<T>(
  prisma: PrismaClient,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: Parameters<PrismaClient["$transaction"]>[1]
): Promise<T> {
  return prisma.$transaction((tx) => trackTransactionScope(() => fn(tx)), options)
}

export function assertOutsideTransaction(operation: string): void {
  if (!inTrackedTransaction()) return

  throw new Error(
    `${operation} cannot run inside a tracked database transaction. Move the external side effect after commit.`
  )
}
