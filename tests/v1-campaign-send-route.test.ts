import { describe, it, expect, beforeEach, vi } from "vitest"

// The REST route POST /api/v1/marketing/campaigns/[id]/send used to be a THIRD
// fake send: a bare status→"sent" + sentAt flip returning the campaign, emailing
// nobody and skipping the consent gate + per-send cap. It now delegates to the
// same shared sendCampaignCore as the dashboard action and the MCP tool, so it
// genuinely emails the consented audience (or returns an honest error).

const { prismaMock, sendEmailMock, withV1AuthMock } = vi.hoisted(() => {
  const prismaMock = {
    campaign: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn(async () => ({ count: 1 })) },
    business: { findUnique: vi.fn() },
    client: { findMany: vi.fn() },
  }
  return { prismaMock, sendEmailMock: vi.fn(), withV1AuthMock: vi.fn() }
})

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/lib/email", () => ({ sendEmail: sendEmailMock }))
vi.mock("@/lib/email-templates", () => ({ marketingEmail: vi.fn(() => "<html>") }))
vi.mock("@/lib/api/auth", () => ({ withV1Auth: withV1AuthMock }))

import { POST } from "@/app/api/v1/marketing/campaigns/[id]/send/route"

const BIZ = "11111111-1111-4111-8111-111111111111"
const CID = "22222222-2222-4222-8222-222222222222"
const req = () => new Request("https://x/api/v1/marketing/campaigns/" + CID + "/send", { method: "POST" })
const params = Promise.resolve({ id: CID })
const client = (i: number, o: Record<string, unknown> = {}) => ({ id: "c-" + i, email: "c" + i + "@x.com", firstName: "F" + i, lastName: "L" + i, ...o })

beforeEach(() => {
  vi.clearAllMocks()
  withV1AuthMock.mockResolvedValue({ userId: "u1", businessId: BIZ, role: "admin" })
  prismaMock.business.findUnique.mockResolvedValue({ id: BIZ, name: "SAL" })
  prismaMock.campaign.update.mockResolvedValue({ id: CID, status: "sent" })
  sendEmailMock.mockResolvedValue({ success: true })
})

describe("POST /api/v1/marketing/campaigns/[id]/send", () => {
  it("rejects a non-admin caller (403) without sending", async () => {
    withV1AuthMock.mockResolvedValue({ userId: "u1", businessId: BIZ, role: "staff" })
    const res = await POST(req(), { params })
    expect(res.status).toBe(403)
    expect(sendEmailMock).not.toHaveBeenCalled()
  })

  it("rejects an unauthenticated caller (401)", async () => {
    withV1AuthMock.mockResolvedValue(null)
    const res = await POST(req(), { params })
    expect(res.status).toBe(401)
    expect(sendEmailMock).not.toHaveBeenCalled()
  })

  it("actually emails the consented audience and reports recipientCount (no fake send)", async () => {
    prismaMock.campaign.findFirst.mockResolvedValue({ id: CID, businessId: BIZ, channel: "email", status: "draft", subject: "Hi", body: "Body", audienceType: "all" })
    prismaMock.client.findMany.mockResolvedValue([client(1), client(2), client(3)])
    const res = await POST(req(), { params })
    expect(res.status).toBe(200)
    expect(sendEmailMock).toHaveBeenCalledTimes(3)
    const body = await res.json()
    expect(body.data.recipientCount).toBe(3)
    // It must go through the core's "sent" completion, not a bare flip.
    expect(prismaMock.campaign.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "sent", recipientCount: 3 }) }))
  })

  it("does NOT report success for an already-sent campaign", async () => {
    prismaMock.campaign.findFirst.mockResolvedValue({ id: CID, businessId: BIZ, channel: "email", status: "sent", subject: "Hi", body: "Body", audienceType: "all" })
    const res = await POST(req(), { params })
    expect(res.status).toBe(400)
    expect(sendEmailMock).not.toHaveBeenCalled()
  })

  it("404s a campaign that does not belong to the caller's business", async () => {
    prismaMock.campaign.findFirst.mockResolvedValue(null)
    const res = await POST(req(), { params })
    expect(res.status).toBe(404)
    expect(sendEmailMock).not.toHaveBeenCalled()
  })
})
