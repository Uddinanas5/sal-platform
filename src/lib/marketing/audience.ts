import { prisma } from "@/lib/prisma"

// ============================================================================
// Marketing audience resolution + shared constants.
//
// Kept in its own (non-"use server") module so both the campaign sender
// (src/lib/actions/marketing.ts, a server-action file that may only export
// async functions) and the automated-message engine
// (src/lib/automation/automated-messages.ts) can import the constants and the
// resolver without tripping Next.js's "use server" export rules.
// ============================================================================

// Hard safety cap on a single manual campaign send. Campaigns are sent inline
// from a server action (not a background queue), so we bound the work to keep
// the request well within the function timeout and to stop a fat-finger blast.
// Above this, the sender refuses honestly and asks the operator to narrow down.
export const CAMPAIGN_RECIPIENT_CAP = 500

// Recipients are emailed in sequential batches of this size. Sequential (not
// parallel) keeps us gentle on the provider's rate limits; per-recipient
// try/catch in the sender means a single bad address never aborts the run.
export const CAMPAIGN_BATCH_SIZE = 20

// Days with no visit after which a client is "lapsed" — used by the "Inactive
// Clients" campaign audience AND the win-back automated-message engine so both
// share one definition of inactive.
export const INACTIVE_CLIENT_DAYS = 90

export type AudienceClient = {
  id: string
  email: string | null
  firstName: string
  lastName: string
}

/**
 * Resolve the deliverable audience for a campaign. The base eligibility gate is
 * ALWAYS consent-first: a client must have an email on file AND emailConsent AND
 * marketingConsent. The campaign's stored `audienceType` (authored in the
 * create-campaign UI — "All Clients" / "VIP Clients" / "Active Clients" /
 * "Inactive Clients" / "Custom", or the legacy default "all") then narrows that
 * consented pool. We never email a client who has not opted in regardless of
 * which audience bucket they fall into.
 *
 * Tenant-scoped by businessId on every query — never trusts ambient context.
 * "VIP" = clients tagged "vip" OR with loyalty; "Active" = visited within the
 * inactive window; "Inactive" = lapsed past it. "Custom" has no server-side
 * filter wired yet, so it conservatively resolves to the full consented pool
 * (honest: it does not silently drop anyone, nor widen past consent).
 */
export async function resolveCampaignAudience(
  businessId: string,
  audienceType: string
): Promise<AudienceClient[]> {
  // Consent + deliverability gate applied to EVERY bucket.
  const base = {
    businessId,
    deletedAt: null,
    isBlocked: false,
    email: { not: null },
    emailConsent: true,
    marketingConsent: true,
  }

  const normalized = audienceType.trim().toLowerCase()
  let where: Record<string, unknown> = base

  if (normalized === "vip clients" || normalized === "vip") {
    where = {
      ...base,
      OR: [{ tags: { has: "vip" } }, { loyaltyPoints: { gt: 0 } }],
    }
  } else if (normalized === "active clients" || normalized === "active") {
    const cutoff = new Date(Date.now() - INACTIVE_CLIENT_DAYS * 24 * 60 * 60 * 1000)
    where = { ...base, lastVisitAt: { gte: cutoff } }
  } else if (normalized === "inactive clients" || normalized === "inactive") {
    const cutoff = new Date(Date.now() - INACTIVE_CLIENT_DAYS * 24 * 60 * 60 * 1000)
    where = { ...base, lastVisitAt: { lt: cutoff } }
  }
  // "all", "all clients", "custom", and anything unrecognized fall through to
  // the consented base pool — never a wider, unconsented set.

  const clients = await prisma.client.findMany({
    where,
    select: { id: true, email: true, firstName: true, lastName: true },
    orderBy: { createdAt: "asc" },
    // One more than the cap so the caller can detect (and refuse) over-cap sends.
    take: CAMPAIGN_RECIPIENT_CAP + 1,
  })
  return clients as AudienceClient[]
}
