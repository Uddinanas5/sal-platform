import { prisma } from "@/lib/prisma"
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

/**
 * Foreign-key references a write path may accept from the caller. Each key maps
 * to a tenant-scoped existence check. `staff` is scoped through its location
 * (Staff has no direct businessId — it joins via `primaryLocation.businessId`);
 * every other model carries `businessId` directly.
 */
export type OwnableRefs = {
  client?: string | null
  service?: string | null
  staff?: string | null
  appointment?: string | null
  productCategory?: string | null
  serviceCategory?: string | null
  membershipPlan?: string | null
}

/**
 * Verify every supplied foreign-key id belongs to the caller's tenant.
 *
 * Write paths (REST routes, server actions, MCP tools) must never trust a
 * caller-supplied `clientId`/`serviceId`/`staffId`/etc. — an attacker in biz A
 * can otherwise bind biz B's records into their own data. Pass the ids you're
 * about to persist; returns the human label of the FIRST id that is missing or
 * cross-tenant (caller maps to a 404 / "not found" error), or null if all clear.
 * Undefined/null ids are skipped, so optional refs are safe to pass straight in.
 */
export async function assertOwnedRefs(
  ctx: Pick<ApiContext, "businessId">,
  refs: OwnableRefs,
): Promise<string | null> {
  const businessId = ctx.businessId

  if (refs.client) {
    if ((await prisma.client.count({ where: { id: refs.client, businessId } })) === 0)
      return "Client"
  }
  if (refs.service) {
    if ((await prisma.service.count({ where: { id: refs.service, businessId } })) === 0)
      return "Service"
  }
  if (refs.staff) {
    if (
      (await prisma.staff.count({
        where: { id: refs.staff, primaryLocation: { businessId } },
      })) === 0
    )
      return "Staff"
  }
  if (refs.appointment) {
    if ((await prisma.appointment.count({ where: { id: refs.appointment, businessId } })) === 0)
      return "Appointment"
  }
  if (refs.productCategory) {
    if (
      (await prisma.productCategory.count({ where: { id: refs.productCategory, businessId } })) === 0
    )
      return "Product category"
  }
  if (refs.serviceCategory) {
    if (
      (await prisma.serviceCategory.count({ where: { id: refs.serviceCategory, businessId } })) === 0
    )
      return "Service category"
  }
  if (refs.membershipPlan) {
    if (
      (await prisma.membershipPlan.count({ where: { id: refs.membershipPlan, businessId } })) === 0
    )
      return "Membership plan"
  }
  return null
}
