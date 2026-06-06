import { describe, it, expect, beforeEach, vi } from "vitest"

// Proves the REAL campaign sender (src/lib/actions/marketing.ts sendCampaign):
//  (A) audience resolution applies a consent-first gate (email present +
//      emailConsent + marketingConsent) on EVERY bucket, scoped by businessId,
//      and the audienceType only narrows that consented pool.
//  (B) sendCampaign emails in batches with per-recipient try/catch so one
//      bounce does not abort the run, and stamps recipientCount = real successes.
//  (C) non-email channels and already-sent campaigns are rejected (honest).
//  (D) the safety cap refuses oversize sends.
// Mocks prisma + sendEmail + auth — no DB, no network. vi.hoisted pattern.

const { prismaMock, sendEmailMock } = vi.hoisted(() => {
  const prismaMock = {
    campaign: { findFirst: vi.fn(), update: vi.fn() },
    business: { findUnique: vi.fn() },
    client: { findMany: vi.fn() },
  }
  const sendEmailMock = vi.fn()
  return { prismaMock, sendEmailMock }
})

const BIZ = "11111111-1111-4111-8111-111111111111"

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/lib/email", () => ({ sendEmail: sendEmailMock }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/auth-utils", () => ({
  requireMinRole: vi.fn(async () => ({ userId: "u1", businessId: BIZ, role: "admin" })),
}))

import { sendCampaign } from "@/lib/actions/marketing"
import {
  resolveCampaignAudience,
  CAMPAIGN_RECIPIENT_CAP,
} from "@/lib/marketing/audience"

const CAMPAIGN_ID = "22222222-2222-4222-8222-222222222222"

function client(i: number, overrides: Record<string, unknown> = {}) {
  return {
    id: `c-${i}`,
    email: `c${i}@example.com`,
    firstName: `First${i}`,
    lastName: `Last${i}`,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.business.findUnique.mockResolvedValue({ name: "Anas Cuts" })
  prismaMock.campaign.update.mockResolvedValue({ id: CAMPAIGN_ID })
  sendEmailMock.mockResolvedValue({ success: true })
})

describe("resolveCampaignAudience — consent-first gate", () => {
  it("applies the email+emailConsent+marketingConsent gate, scoped by businessId, for 'all'", async () => {
    prismaMock.client.findMany.mockResolvedValue([client(1)])
    await resolveCampaignAudience(BIZ, "All Clients")

    const where = prismaMock.client.findMany.mock.calls[0][0].where
    expect(where.businessId).toBe(BIZ)
    expect(where.emailConsent).toBe(true)
    expect(where.marketingConsent).toBe(true)
    expect(where.email).toEqual({ not: null })
    expect(where.isBlocked).toBe(false)
    expect(where.deletedAt).toBeNull()
  })

  it("VIP narrows the consented pool by tag/loyalty without dropping the consent gate", async () => {
    prismaMock.client.findMany.mockResolvedValue([])
    await resolveCampaignAudience(BIZ, "VIP Clients")

    const where = prismaMock.client.findMany.mock.calls[0][0].where
    // Consent gate still present.
    expect(where.emailConsent).toBe(true)
    expect(where.marketingConsent).toBe(true)
    // VIP narrowing.
    expect(where.OR).toEqual([{ tags: { has: "vip" } }, { loyaltyPoints: { gt: 0 } }])
  })

  it("Inactive Clients filters on a lastVisitAt cutoff, still consent-gated", async () => {
    prismaMock.client.findMany.mockResolvedValue([])
    await resolveCampaignAudience(BIZ, "Inactive Clients")

    const where = prismaMock.client.findMany.mock.calls[0][0].where
    expect(where.emailConsent).toBe(true)
    expect(where.lastVisitAt).toHaveProperty("lt")
  })
})

describe("sendCampaign — delivery", () => {
  function draftCampaign(overrides: Record<string, unknown> = {}) {
    return {
      channel: "email",
      status: "draft",
      name: "Spring Sale",
      subject: "Big news",
      body: "Hello {firstName}",
      audienceType: "All Clients",
      ...overrides,
    }
  }

  it("emails every consented recipient in batches and stamps recipientCount = successes", async () => {
    prismaMock.campaign.findFirst.mockResolvedValue(draftCampaign())
    // 45 recipients → 3 batches of 20/20/5.
    prismaMock.client.findMany.mockResolvedValue(
      Array.from({ length: 45 }, (_, i) => client(i))
    )

    const res = await sendCampaign(CAMPAIGN_ID)

    expect(res).toMatchObject({ success: true, sent: 45 })
    expect(sendEmailMock).toHaveBeenCalledTimes(45)

    // First update marks "sending"; final update stamps sent + recipientCount.
    const finalUpdate = prismaMock.campaign.update.mock.calls.at(-1)![0]
    expect(finalUpdate.where).toEqual({ id: CAMPAIGN_ID, businessId: BIZ })
    expect(finalUpdate.data.status).toBe("sent")
    expect(finalUpdate.data.recipientCount).toBe(45)
    expect(finalUpdate.data.sentAt).toBeInstanceOf(Date)
  })

  it("tolerates a single failing recipient — the rest still send, count excludes the failure", async () => {
    prismaMock.campaign.findFirst.mockResolvedValue(draftCampaign())
    prismaMock.client.findMany.mockResolvedValue([client(1), client(2), client(3)])

    // Middle recipient: provider rejects (returns {success:false}); last one
    // throws outright. Neither aborts the run.
    sendEmailMock
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: false, error: "bounced" })
      .mockRejectedValueOnce(new Error("provider down"))

    const res = await sendCampaign(CAMPAIGN_ID)

    expect(res).toMatchObject({ success: true })
    // All three attempted, only one genuine success counted.
    expect(sendEmailMock).toHaveBeenCalledTimes(3)
    expect((res as { sent: number }).sent).toBe(1)
    const finalUpdate = prismaMock.campaign.update.mock.calls.at(-1)![0]
    expect(finalUpdate.data.recipientCount).toBe(1)
  })

  it("rejects an SMS campaign (beta) without sending", async () => {
    prismaMock.campaign.findFirst.mockResolvedValue(draftCampaign({ channel: "sms" }))

    const res = await sendCampaign(CAMPAIGN_ID)
    expect(res).toEqual({ success: false, error: "SMS messaging is not configured yet" })
    expect(sendEmailMock).not.toHaveBeenCalled()
  })

  it("refuses to re-send an already-sent campaign", async () => {
    prismaMock.campaign.findFirst.mockResolvedValue(draftCampaign({ status: "sent" }))

    const res = await sendCampaign(CAMPAIGN_ID)
    expect(res).toMatchObject({ success: false })
    expect(sendEmailMock).not.toHaveBeenCalled()
  })

  it("returns an honest error when the audience has no consented recipients", async () => {
    prismaMock.campaign.findFirst.mockResolvedValue(draftCampaign())
    prismaMock.client.findMany.mockResolvedValue([])

    const res = await sendCampaign(CAMPAIGN_ID)
    expect(res).toMatchObject({ success: false })
    expect(sendEmailMock).not.toHaveBeenCalled()
    // Never marked sent.
    const calls = prismaMock.campaign.update.mock.calls
    expect(calls.find((c) => c[0].data?.status === "sent")).toBeUndefined()
  })

  it("refuses sends above the safety cap", async () => {
    prismaMock.campaign.findFirst.mockResolvedValue(draftCampaign())
    prismaMock.client.findMany.mockResolvedValue(
      Array.from({ length: CAMPAIGN_RECIPIENT_CAP + 1 }, (_, i) => client(i))
    )

    const res = await sendCampaign(CAMPAIGN_ID)
    expect(res).toMatchObject({ success: false })
    expect((res as { error: string }).error).toContain("limit")
    expect(sendEmailMock).not.toHaveBeenCalled()
  })

  it("reverts a campaign to 'draft' (not stuck in 'sending') when the final stamp throws", async () => {
    prismaMock.campaign.findFirst.mockResolvedValue(draftCampaign())
    prismaMock.client.findMany.mockResolvedValue([client(1), client(2)])

    // 1st update = mark "sending" (ok). 2nd update = final "sent" stamp → throws
    // (e.g. dropped pooled connection). 3rd update = best-effort revert to draft.
    prismaMock.campaign.update
      .mockResolvedValueOnce({ id: CAMPAIGN_ID }) // sending flip
      .mockRejectedValueOnce(new Error("connection dropped during final write")) // final stamp
      .mockResolvedValueOnce({ id: CAMPAIGN_ID }) // revert

    await expect(sendCampaign(CAMPAIGN_ID)).rejects.toThrow(/connection dropped/)

    // The emails were attempted before the failing stamp.
    expect(sendEmailMock).toHaveBeenCalledTimes(2)

    // A revert update must have fired, putting the row back to "draft" (and
    // clearing sendingStartedAt) so it is re-sendable — never stranded in "sending".
    const revert = prismaMock.campaign.update.mock.calls.at(-1)![0]
    expect(revert.where).toEqual({ id: CAMPAIGN_ID, businessId: BIZ })
    expect(revert.data.status).toBe("draft")
    expect(revert.data.sendingStartedAt).toBeNull()
  })

  it("treats a STALE 'sending' campaign as recoverable and re-sends it", async () => {
    // Abandoned mid-send (crash/timeout) 30 min ago → no longer in flight.
    prismaMock.campaign.findFirst.mockResolvedValue(
      draftCampaign({ status: "sending", sendingStartedAt: new Date(Date.now() - 30 * 60 * 1000) })
    )
    prismaMock.client.findMany.mockResolvedValue([client(1)])

    const res = await sendCampaign(CAMPAIGN_ID)
    expect(res).toMatchObject({ success: true, sent: 1 })
    expect(sendEmailMock).toHaveBeenCalledTimes(1)
    const finalUpdate = prismaMock.campaign.update.mock.calls.at(-1)![0]
    expect(finalUpdate.data.status).toBe("sent")
  })

  it("refuses a campaign that is ACTIVELY 'sending' (recent sendingStartedAt)", async () => {
    prismaMock.campaign.findFirst.mockResolvedValue(
      draftCampaign({ status: "sending", sendingStartedAt: new Date() })
    )

    const res = await sendCampaign(CAMPAIGN_ID)
    expect(res).toMatchObject({ success: false })
    expect((res as { error: string }).error).toMatch(/already being sent/i)
    expect(sendEmailMock).not.toHaveBeenCalled()
  })
})
