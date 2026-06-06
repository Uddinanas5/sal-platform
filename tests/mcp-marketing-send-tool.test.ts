import { describe, it, expect, beforeEach, vi } from "vitest"

// The MCP `send-campaign` tool used to be a FAKE send: it only flipped
// status→"sending" + sentAt and returned ok() — emailing nobody, never
// resolving an audience, never enforcing consent/cap, never writing a "sent"
// completion. That bricked the campaign in "sending" forever (the real
// sendCampaign + updateCampaign both refuse a "sending" row) while telling the
// AI assistant the campaign launched. It now routes through the SAME shared
// sendCampaignCore as the dashboard action, so it actually emails the consented
// audience and stamps "sent" + recipientCount.
//
// Pure unit test: mock prisma + sendEmail + email-templates, capture the handler
// the tool registers on a fake McpServer, and assert real delivery + honest
// errors. vi.hoisted pattern (factories hoist above imports).

const { prismaMock, sendEmailMock } = vi.hoisted(() => {
  const prismaMock = {
    campaign: { findFirst: vi.fn(), update: vi.fn() },
    business: { findUnique: vi.fn() },
    client: { findMany: vi.fn() },
  }
  const sendEmailMock = vi.fn()
  return { prismaMock, sendEmailMock }
})

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/lib/email", () => ({ sendEmail: sendEmailMock }))
vi.mock("@/lib/email-templates", () => ({ marketingEmail: vi.fn(() => "<html>") }))

import { registerMarketingTools } from "@/lib/mcp/tools/marketing"
import { CAMPAIGN_RECIPIENT_CAP } from "@/lib/marketing/audience"

const BIZ = "11111111-1111-4111-8111-111111111111"
const CAMPAIGN_ID = "22222222-2222-4222-8222-222222222222"

type ToolHandler = (args: Record<string, unknown>) => Promise<{
  content: { type: "text"; text: string }[]
  isError?: boolean
}>

// Capture the send-campaign handler off a fake McpServer.
function loadSendTool(role = "admin") {
  let handler: ToolHandler | undefined
  const fakeServer = {
    tool: (name: string, _desc: string, _schema: unknown, h: ToolHandler) => {
      if (name === "send-campaign") handler = h
    },
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerMarketingTools(fakeServer as any, { userId: "u1", businessId: BIZ, role } as any)
  if (!handler) throw new Error("send-campaign tool not registered")
  return handler
}

const parse = (out: { content: { text: string }[] }) => JSON.parse(out.content[0].text)

function client(i: number, overrides: Record<string, unknown> = {}) {
  return { id: `c-${i}`, email: `c${i}@example.com`, firstName: `F${i}`, lastName: `L${i}`, ...overrides }
}

function draftCampaign(overrides: Record<string, unknown> = {}) {
  return {
    channel: "email",
    status: "draft",
    name: "Spring Sale",
    subject: "Big news",
    body: "Hello",
    audienceType: "All Clients",
    sendingStartedAt: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.business.findUnique.mockResolvedValue({ name: "Anas Cuts" })
  prismaMock.campaign.update.mockResolvedValue({ id: CAMPAIGN_ID })
  sendEmailMock.mockResolvedValue({ success: true })
})

describe("MCP send-campaign tool", () => {
  it("actually emails each consented recipient and ends status 'sent' with recipientCount", async () => {
    const handler = loadSendTool()
    prismaMock.campaign.findFirst.mockResolvedValue(draftCampaign())
    prismaMock.client.findMany.mockResolvedValue([client(1), client(2), client(3)])

    const out = await handler({ id: CAMPAIGN_ID })

    // Real send happened — not a fake status flip.
    expect(sendEmailMock).toHaveBeenCalledTimes(3)
    // Completion write stamps "sent" + recipientCount = successes.
    const finalUpdate = prismaMock.campaign.update.mock.calls.at(-1)![0]
    expect(finalUpdate.where).toEqual({ id: CAMPAIGN_ID, businessId: BIZ })
    expect(finalUpdate.data.status).toBe("sent")
    expect(finalUpdate.data.recipientCount).toBe(3)
    // The tool returns the REAL result, not a fake ok().
    const body = parse(out)
    expect(out.isError).toBeUndefined()
    expect(body.sent).toBe(3)
    expect(body.recipientCount).toBe(3)
    expect(body.campaignId).toBe(CAMPAIGN_ID)
  })

  it("counts only genuine successes (provider-rejected / no-email excluded)", async () => {
    const handler = loadSendTool()
    prismaMock.campaign.findFirst.mockResolvedValue(draftCampaign())
    // The audience resolver already drops no-email/no-consent clients; here the
    // provider rejects the 2nd recipient — it must not count toward recipientCount.
    prismaMock.client.findMany.mockResolvedValue([client(1), client(2)])
    sendEmailMock
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: false, error: "bounced" })

    const out = await handler({ id: CAMPAIGN_ID })

    expect(sendEmailMock).toHaveBeenCalledTimes(2)
    expect(parse(out).recipientCount).toBe(1)
    const finalUpdate = prismaMock.campaign.update.mock.calls.at(-1)![0]
    expect(finalUpdate.data.recipientCount).toBe(1)
  })

  it("returns isError (not a fake ok) for an over-cap audience and never marks sent", async () => {
    const handler = loadSendTool()
    prismaMock.campaign.findFirst.mockResolvedValue(draftCampaign())
    prismaMock.client.findMany.mockResolvedValue(
      Array.from({ length: CAMPAIGN_RECIPIENT_CAP + 1 }, (_, i) => client(i))
    )

    const out = await handler({ id: CAMPAIGN_ID })

    expect(out.isError).toBe(true)
    expect(parse(out).error).toContain("limit")
    expect(sendEmailMock).not.toHaveBeenCalled()
    // Never flipped to sending/sent.
    expect(prismaMock.campaign.update).not.toHaveBeenCalled()
  })

  it("returns isError for a non-email (SMS) channel without sending", async () => {
    const handler = loadSendTool()
    prismaMock.campaign.findFirst.mockResolvedValue(draftCampaign({ channel: "sms" }))

    const out = await handler({ id: CAMPAIGN_ID })

    expect(out.isError).toBe(true)
    expect(parse(out).error).toMatch(/SMS messaging is not configured/i)
    expect(sendEmailMock).not.toHaveBeenCalled()
  })

  it("returns isError when no consented recipients match", async () => {
    const handler = loadSendTool()
    prismaMock.campaign.findFirst.mockResolvedValue(draftCampaign())
    prismaMock.client.findMany.mockResolvedValue([])

    const out = await handler({ id: CAMPAIGN_ID })

    expect(out.isError).toBe(true)
    expect(parse(out).error).toMatch(/no consented recipients/i)
    expect(sendEmailMock).not.toHaveBeenCalled()
  })

  it("rejects a non-admin before any DB work", async () => {
    const handler = loadSendTool("staff")
    const out = await handler({ id: CAMPAIGN_ID })
    expect(out.isError).toBe(true)
    expect(parse(out).error).toMatch(/insufficient permissions/i)
    expect(prismaMock.campaign.findFirst).not.toHaveBeenCalled()
  })
})
