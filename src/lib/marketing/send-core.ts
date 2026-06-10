import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"
import { marketingEmail } from "@/lib/email-templates"
import {
  resolveCampaignAudience,
  CAMPAIGN_RECIPIENT_CAP,
  CAMPAIGN_BATCH_SIZE,
} from "@/lib/marketing/audience"

// ============================================================================
// Shared campaign send core.
//
// Kept in its own (non-"use server") module so BOTH the dashboard server action
// (src/lib/actions/marketing.ts sendCampaign) and the MCP tool
// (src/lib/mcp/tools/marketing.ts send-campaign) drive the SAME real send: one
// consent-first audience resolution, one safety cap, one batched send, one
// completion write. The MCP tool previously only flipped status→"sending" and
// returned ok() — emailing nobody and bricking the campaign in "sending"
// forever. Routing it through this core removes both the fake-send and the
// brick, exactly as the MCP checkout tool routes through recordCheckout.
//
// The server action owns session-derived businessId (requireMinRole); the MCP
// tool owns ctx.businessId (after its isAdmin check). Both pass the resolved
// businessId in, so this core never touches auth/session — it only does the
// actual send work, tenant-scoped by the businessId it is handed.
// ============================================================================

/**
 * A "sending" campaign whose sendingStartedAt is older than this is treated as
 * ABANDONED (crash / serverless timeout where the catch-revert never ran) and
 * is therefore re-sendable / editable. Without this, a hard crash between the
 * status flip and the final write would strand the row in "sending" forever.
 */
export const SENDING_RECOVERY_MS = 10 * 60 * 1000 // 10 minutes

export type SendCampaignResult =
  | { success: true; sent: number; recipientCount: number; campaign: { id: string } }
  | { success: false; error: string }

/**
 * True when a "sending" campaign is still considered actively in flight (so a
 * concurrent send/edit must be refused). A "sending" row with no
 * sendingStartedAt, or one older than the recovery window, is NOT in flight —
 * it is abandoned and may be re-sent/edited.
 */
export function isSendInFlight(
  status: string,
  sendingStartedAt: Date | null | undefined,
  now: Date = new Date()
): boolean {
  if (status !== "sending") return false
  if (!sendingStartedAt) return false
  return now.getTime() - sendingStartedAt.getTime() < SENDING_RECOVERY_MS
}

/**
 * Actually send an email campaign for `businessId`. Single source of truth used
 * by the dashboard action and the MCP tool.
 *
 *  1. Tenant-scoped load. Reject if not found / not this business's.
 *  2. Reject non-email channels (SMS stays disabled for beta).
 *  3. Reject an already-"sent" campaign, or one actively "sending" (recent
 *     sendingStartedAt). A STALE "sending" (abandoned) is allowed through.
 *  4. Resolve the consented audience; refuse an empty or over-cap audience.
 *  5. Mark status="sending" + sendingStartedAt up front so a concurrent click
 *     sees it in flight.
 *  6. Email in sequential batches with per-recipient try/catch so one bounce
 *     does not abort the run.
 *  7. Stamp status="sent", sentAt, recipientCount = actual successful sends.
 *  8. If anything between the flip and the final write throws, revert status to
 *     "draft" (best-effort) before rethrowing so the row is never stranded.
 */
export async function sendCampaignCore(
  businessId: string,
  campaignId: string
): Promise<SendCampaignResult> {
  const existing = await prisma.campaign.findFirst({
    where: { id: campaignId, businessId },
    select: {
      channel: true,
      status: true,
      name: true,
      subject: true,
      body: true,
      audienceType: true,
      sendingStartedAt: true,
    },
  })
  if (!existing) return { success: false, error: "Campaign not found" }
  if (existing.channel !== "email") {
    return { success: false, error: "SMS messaging is not configured yet" }
  }
  if (existing.status === "sent") {
    return { success: false, error: "This campaign has already been sent" }
  }
  // Only block on "sending" when the send is genuinely still in flight; a stale
  // (abandoned) "sending" is recoverable and falls through to be re-sent.
  if (isSendInFlight(existing.status, existing.sendingStartedAt)) {
    return { success: false, error: "This campaign is already being sent" }
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { name: true },
  })

  const audience = await resolveCampaignAudience(businessId, existing.audienceType)
  const deliverable = audience.filter((c) => c.email)

  if (deliverable.length === 0) {
    return {
      success: false,
      error: "No consented recipients with an email address match this audience",
    }
  }
  if (deliverable.length > CAMPAIGN_RECIPIENT_CAP) {
    return {
      success: false,
      error: `This audience has ${deliverable.length} recipients, above the ${CAMPAIGN_RECIPIENT_CAP} per-send limit. Narrow the audience and try again.`,
    }
  }

  // Atomically CLAIM the campaign by flipping to "sending" only if it is not
  // already sent and not currently in flight (status≠sending, or a null/stale
  // sendingStartedAt). The pre-checks above are a fast fail; this guarded
  // compare-and-set is the real race protection — two concurrent sends (double
  // click, dashboard + MCP) can both pass the reads, but only ONE updateMany
  // matches the row, so the audience is never emailed twice.
  const staleBefore = new Date(Date.now() - SENDING_RECOVERY_MS)
  const claim = await prisma.campaign.updateMany({
    where: {
      id: campaignId,
      businessId,
      status: { not: "sent" },
      OR: [
        { status: { not: "sending" } },
        { sendingStartedAt: null },
        { sendingStartedAt: { lt: staleBefore } },
      ],
    },
    data: { status: "sending", sendingStartedAt: new Date() },
  })
  if (claim.count === 0) {
    return { success: false, error: "This campaign is already being sent" }
  }

  try {
    const subject = existing.subject?.trim() || existing.name
    const html = marketingEmail({
      subject: existing.subject?.trim() || undefined,
      body: existing.body,
      businessName: business?.name,
    })

    let sent = 0
    for (let i = 0; i < deliverable.length; i += CAMPAIGN_BATCH_SIZE) {
      const batch = deliverable.slice(i, i + CAMPAIGN_BATCH_SIZE)
      for (const client of batch) {
        try {
          const res = await sendEmail({
            to: client.email as string,
            subject,
            html,
          })
          // sendEmail never throws; it returns {success:false} when the provider
          // rejects or is unconfigured. Count only genuine successes.
          if (res?.success) sent++
        } catch (e) {
          // Belt-and-suspenders: a single bad recipient must not abort the run.
          console.error("[sendCampaignCore] recipient failed", {
            campaignId,
            error: e,
          })
        }
      }
    }

    const campaign = await prisma.campaign.update({
      where: { id: campaignId, businessId },
      data: {
        status: "sent",
        sentAt: new Date(),
        recipientCount: sent,
      },
    })
    return { success: true, sent, recipientCount: sent, campaign }
  } catch (e) {
    // A throw after the "sending" flip (e.g. a dropped pooled connection during
    // the final write) would otherwise strand the row in "sending". Best-effort
    // revert to "draft" so it stays re-sendable; swallow a secondary failure so
    // we still rethrow the real error (the stale-sending recovery in
    // isSendInFlight is the second line of defence if this revert can't run).
    try {
      await prisma.campaign.update({
        where: { id: campaignId, businessId },
        data: { status: "draft", sendingStartedAt: null },
      })
    } catch {
      // ignore — rethrow the original error below
    }
    throw e
  }
}
