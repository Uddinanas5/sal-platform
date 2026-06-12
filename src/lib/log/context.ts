import { AsyncLocalStorage } from "node:async_hooks"
import { randomUUID } from "node:crypto"
import type { Logger } from "pino"
import { baseLogger } from "./logger"

// Per-request log context (requestId + businessId + route), propagated via
// AsyncLocalStorage so handlers don't have to thread a logger through every call.
type LogContext = { requestId: string; businessId?: string; route?: string }

const als = new AsyncLocalStorage<{ ctx: LogContext; logger: Logger }>()

/**
 * Run `fn` inside a fresh log scope. Every getLog() inside is bound to this
 * context's requestId/businessId/route. Generates a requestId if not supplied.
 */
export function withLogContext<T>(ctx: Partial<LogContext>, fn: () => T): T {
  const full: LogContext = { requestId: ctx.requestId || randomUUID(), businessId: ctx.businessId, route: ctx.route }
  const logger = baseLogger.child(full)
  return als.run({ ctx: full, logger }, fn)
}

/** The logger bound to the current request scope (or the base logger outside one). */
export function getLog(): Logger {
  return als.getStore()?.logger ?? baseLogger
}

/** Attach/refine fields (e.g. businessId once auth resolves) for the rest of the scope. */
export function setLogContext(fields: Partial<LogContext>): void {
  const store = als.getStore()
  if (!store) return
  Object.assign(store.ctx, fields)
  store.logger = baseLogger.child(store.ctx)
}

/** The current scope's fields (requestId/businessId/route), or null outside a scope. Test/diagnostic. */
export function currentLogFields(): LogContext | null {
  return als.getStore()?.ctx ?? null
}
