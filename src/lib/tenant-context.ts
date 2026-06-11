import { AsyncLocalStorage } from "node:async_hooks"

// Per-request tenant context. When set, the tenant guard (prisma-tenant.ts) can
// verify that a query's businessId matches the authenticated tenant. `bypass` is
// for system paths that legitimately run before/without a tenant (Stripe
// webhooks, cron, auth-by-hash). Keep bypass call sites few + greppable.
type TenantContext = { businessId?: string; bypass?: boolean }

const als = new AsyncLocalStorage<TenantContext>()

/** Run `fn` scoped to a business (queries are checked against this businessId). */
export function runWithTenant<T>(businessId: string, fn: () => T): T {
  return als.run({ businessId }, fn)
}

/** Run `fn` in a bypass scope — the guard will not enforce tenancy here. */
export function withBypass<T>(fn: () => T): T {
  return als.run({ bypass: true }, fn)
}

export function getTenantContext(): TenantContext | undefined {
  return als.getStore()
}
