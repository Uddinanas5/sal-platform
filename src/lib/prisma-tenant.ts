import { getTenantContext } from "@/lib/tenant-context"
import { baseLogger } from "@/lib/log/logger"

// GLOBAL FAIL-CLOSED TENANCY GUARD (Phase 1B).
//
// The footgun: a forgotten `where businessId` clause fails OPEN (cross-tenant
// leak). This guard inspects every Prisma query and flags/blocks a tenant-owned
// query that lacks its businessId scope. It is GATED by TENANT_GUARD:
//   off   (default) — does nothing (zero behavior change; safe to ship inert)
//   log            — logs violations, never throws (telemetry / bake period)
//   throw          — throws on a violation (enforcement; flip after a clean bake)
// A businessId MISMATCH (active cross-tenant attempt) always throws in log/throw.
//
// Two-tier classification, because ~half of tenant models have NO businessId
// column (they're scoped through a relation) — a uniform "require businessId" is
// impossible. The guard's teeth are on the DIRECT_BUSINESS_ID class; the
// relation-scoped class is covered by assertOwnedRefs + the cross-tenant tests +
// (future) RLS.

export class TenantGuardError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "TenantGuardError"
  }
}

// Models with a real business_id column → the guard enforces a businessId clause.
export const DIRECT_BUSINESS_ID = new Set([
  "Client", "Appointment", "Service", "ServiceCategory", "Payment", "Invoice",
  "GiftCard", "Review", "WaitlistEntry", "FormTemplate", "Product", "ProductCategory",
  "Campaign", "Deal", "AutomatedMessage", "MembershipPlan", "Resource", "VisitNote",
  "LoyaltyTransaction", "Notification", "ServiceBundle", "PayrollPeriod",
  "StaffInvitation", "Location", "Discount",
])

// Models that are tenant-owned only via a relation (no business_id column). The
// guard does NOT hard-require a clause here (it can't synthesize the join); it's
// the job of assertOwnedRefs + cross-tenant tests + RLS.
export const RELATION_SCOPED = new Set([
  "Staff", "Commission", "Membership", "AppointmentService", "AppointmentProduct",
  "GroupParticipant", "StaffSchedule", "StaffTimeOff", "StaffService", "StaffLocation",
  "StaffBreak", "ProductInventory", "InventoryTransaction", "ServiceVariation",
  "FormSubmission", "BusinessHours",
])

const GUARDED_OPS = new Set([
  "findMany", "findFirst", "findFirstOrThrow", "findUnique", "findUniqueOrThrow",
  "update", "updateMany", "delete", "deleteMany", "count", "aggregate", "groupBy",
])

export type GuardMode = "off" | "log" | "throw"
export function guardMode(): GuardMode {
  const m = process.env.TENANT_GUARD
  return m === "log" || m === "throw" ? m : "off"
}

// Extract a businessId constraint from a Prisma `where` (top level or inside a
// top-level AND). Returns the value, or undefined if absent.
function whereBusinessId(where: unknown): string | undefined {
  if (!where || typeof where !== "object") return undefined
  const w = where as Record<string, unknown>
  if (typeof w.businessId === "string") return w.businessId
  if (Array.isArray(w.AND)) {
    for (const clause of w.AND) {
      const v = whereBusinessId(clause)
      if (v !== undefined) return v
    }
  }
  return undefined
}

type Logger = { warn: (o: unknown, m: string) => void; error: (o: unknown, m: string) => void }

/**
 * Inspect one query. Returns void (allowed) or throws TenantGuardError (blocked).
 * Pure + side-effect-light (only logs) — the Prisma extension wraps this in
 * try/catch so a guard bug can never break a real query.
 */
export function inspectTenantScope(
  model: string | undefined,
  operation: string,
  args: { where?: unknown } | undefined,
  opts: { mode: GuardMode; log?: Logger } = { mode: guardMode() },
): void {
  const mode = opts.mode
  if (mode === "off" || !model || !GUARDED_OPS.has(operation)) return

  const ctx = getTenantContext()
  if (ctx?.bypass) return // system path (webhook/cron/auth)

  if (RELATION_SCOPED.has(model)) {
    opts.log?.warn({ model, operation }, "[tenant-guard] relation-scoped query (not hard-checked)")
    return
  }
  if (!DIRECT_BUSINESS_ID.has(model)) return // GLOBAL model

  const clauseBiz = whereBusinessId(args?.where)

  // Active cross-tenant attempt: the query is scoped to a DIFFERENT business than
  // the authenticated tenant. Always a hard error (never a forgotten-clause FP).
  if (clauseBiz !== undefined && ctx?.businessId && clauseBiz !== ctx.businessId) {
    const msg = `[tenant-guard] businessId MISMATCH on ${model}.${operation} (query=${clauseBiz} session=${ctx.businessId})`
    opts.log?.error({ model, operation }, msg)
    throw new TenantGuardError(msg)
  }

  // Forgotten clause: a tenant-owned query with no businessId scope → fails OPEN.
  if (clauseBiz === undefined) {
    const msg = `[tenant-guard] ${model}.${operation} has no businessId scope (would fail open)`
    if (mode === "throw") {
      opts.log?.error({ model, operation }, msg)
      throw new TenantGuardError(msg)
    }
    opts.log?.warn({ model, operation }, msg)
  }
}

// Apply the guard to a Prisma client. When TENANT_GUARD=off (default) the client
// is returned UNCHANGED (no extension, no overhead). Otherwise every query is
// inspected; inspection is wrapped so a guard bug can never break a query.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyTenantGuard<T extends { $extends: (...a: any[]) => any }>(client: T): T {
  if (guardMode() === "off") return client
  return client.$extends({
    query: {
      $allModels: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async $allOperations({ model, operation, args, query }: any) {
          try {
            inspectTenantScope(model, operation, args, { mode: guardMode(), log: baseLogger })
          } catch (e) {
            if (e instanceof TenantGuardError) throw e // intentional block
            // any other inspection bug must NOT break the query
          }
          return query(args)
        },
      },
    },
  }) as T
}
