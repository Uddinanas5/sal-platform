import type { ApiContext } from "./auth"

/**
 * Build a tenant-scoped Prisma `where` clause.
 *
 * Always include this in v1 handler queries so a leaked id from biz A can't
 * be read/mutated by biz B's bearer. The id-only path (`findUnique({ where: { id } })`)
 * is the footgun — swap to `findFirst({ where: scopedWhere(ctx, { id }) })`.
 */
export function scopedWhere<T extends Record<string, unknown>>(
  ctx: Pick<ApiContext, "businessId">,
  extra?: T,
): { businessId: string } & T {
  return { businessId: ctx.businessId, ...(extra ?? ({} as T)) }
}

/**
 * Assert a fetched record belongs to the caller's tenant.
 *
 * Use when a record was fetched without a scoped where (e.g. inside a
 * transaction that needs the id-only lookup for join semantics) and you
 * need to gate the next step. Returns the record narrowed to non-null,
 * or null if it's missing OR cross-tenant — caller maps null to 404.
 */
export function requireOwned<T extends { businessId: string } | null | undefined>(
  record: T,
  ctx: Pick<ApiContext, "businessId">,
): NonNullable<T> | null {
  if (!record) return null
  if (record.businessId !== ctx.businessId) return null
  return record as NonNullable<T>
}
