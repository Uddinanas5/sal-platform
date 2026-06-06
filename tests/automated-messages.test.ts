import { describe, it, expect, beforeEach, vi } from "vitest"

// Proves the automated-message execution engine
// (src/lib/automation/automated-messages.ts):
//  (A) pure matchers: isBirthdayToday (business-local) + occasionKey.
//  (B) runDueAutomatedMessages fires birthday + win_back, skips
//      covered-by-other-flows triggers, and skips SMS rows (beta).
//  (C) idempotency: a client already stamped for the same (message, occasion)
//      is never re-sent; the stamp is written BEFORE the send.
//  (D) consent: only email-on-file clients are emailed (the query gate also
//      enforces emailConsent + marketingConsent).
// Mocks prisma + sendEmail — no DB, no network. vi.hoisted pattern.

const { prismaMock, sendEmailMock } = vi.hoisted(() => {
  const prismaMock = {
    automatedMessage: { findMany: vi.fn(), update: vi.fn() },
    client: { findMany: vi.fn() },
    notification: { findMany: vi.fn(), create: vi.fn() },
  }
  const sendEmailMock = vi.fn()
  return { prismaMock, sendEmailMock }
})

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/lib/email", () => ({ sendEmail: sendEmailMock }))

import {
  runDueAutomatedMessages,
  isBirthdayToday,
  occasionKey,
  birthdayMonthDay,
  AUTOMATED_MESSAGE_NOTIFICATION_TYPE,
} from "@/lib/automation/automated-messages"
import { AutomatedMessageTrigger } from "@/generated/prisma"

const BIZ = "11111111-1111-4111-8111-111111111111"

function message(overrides: Record<string, unknown> = {}) {
  return {
    id: "m-birthday",
    businessId: BIZ,
    trigger: AutomatedMessageTrigger.birthday,
    channel: "email",
    subject: "Happy Birthday, {firstName}!",
    body: "Happy birthday from {businessName}.",
    business: { name: "Anas Cuts", timezone: "UTC" },
    ...overrides,
  }
}

function client(overrides: Record<string, unknown> = {}) {
  return {
    id: "client-1",
    email: "client@example.com",
    firstName: "Jordan",
    lastName: "Reyes",
    dateOfBirth: new Date("1990-06-06T00:00:00.000Z"),
    lastVisitAt: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.automatedMessage.findMany.mockResolvedValue([])
  prismaMock.client.findMany.mockResolvedValue([])
  prismaMock.notification.findMany.mockResolvedValue([])
  prismaMock.notification.create.mockResolvedValue({ id: "n1" })
  prismaMock.automatedMessage.update.mockResolvedValue({})
  sendEmailMock.mockResolvedValue({ success: true })
})

describe("birthday matcher (pure)", () => {
  it("matches month/day in the business timezone", () => {
    const dob = new Date("1990-06-06T00:00:00.000Z")
    expect(birthdayMonthDay(dob)).toBe("06-06")
    // Same calendar day in UTC.
    expect(isBirthdayToday(dob, new Date("2026-06-06T12:00:00.000Z"), "UTC")).toBe(true)
    // A different day is not a match.
    expect(isBirthdayToday(dob, new Date("2026-06-07T12:00:00.000Z"), "UTC")).toBe(false)
  })

  it("respects the business timezone at day boundaries", () => {
    const dob = new Date("1990-06-06T00:00:00.000Z")
    // 2026-06-07 01:00 UTC is still 2026-06-06 in Los Angeles (UTC-7) → match.
    const now = new Date("2026-06-07T01:00:00.000Z")
    expect(isBirthdayToday(dob, now, "America/Los_Angeles")).toBe(true)
    // ...but it is already 2026-06-07 in UTC → no match.
    expect(isBirthdayToday(dob, now, "UTC")).toBe(false)
  })
})

describe("occasionKey (pure)", () => {
  it("scopes a birthday to the business-local year", () => {
    const key = occasionKey(
      AutomatedMessageTrigger.birthday,
      client() as never,
      new Date("2026-06-06T12:00:00.000Z"),
      "UTC"
    )
    expect(key).toBe("birthday:2026")
  })

  it("scopes a win-back to the client's current lastVisitAt (a new visit = new occasion)", () => {
    const lastVisit = new Date("2025-01-01T00:00:00.000Z")
    const key = occasionKey(
      AutomatedMessageTrigger.win_back,
      client({ lastVisitAt: lastVisit }) as never,
      new Date("2026-06-06T12:00:00.000Z"),
      "UTC"
    )
    expect(key).toBe(`win_back:${lastVisit.toISOString()}`)
  })
})

describe("runDueAutomatedMessages — birthday", () => {
  it("stamps a Notification BEFORE sending, then emails the client", async () => {
    prismaMock.automatedMessage.findMany.mockResolvedValue([message()])
    prismaMock.client.findMany.mockResolvedValue([client()])

    const now = new Date("2026-06-06T12:00:00.000Z")
    const res = await runDueAutomatedMessages(now)

    expect(res.emailsSent).toBe(1)
    // Stamp carries the dedup identity.
    expect(prismaMock.notification.create).toHaveBeenCalledTimes(1)
    const stamp = prismaMock.notification.create.mock.calls[0][0].data
    expect(stamp.businessId).toBe(BIZ)
    expect(stamp.clientId).toBe("client-1")
    expect(stamp.type).toBe(AUTOMATED_MESSAGE_NOTIFICATION_TYPE)
    expect(stamp.metadata).toMatchObject({
      automatedMessageId: "m-birthday",
      occasionKey: "birthday:2026",
    })

    // The email subject/body went through template rendering (merge fields filled).
    const sent = sendEmailMock.mock.calls[0][0]
    expect(sent.to).toBe("client@example.com")
    expect(sent.subject).toBe("Happy Birthday, Jordan!")
    expect(sent.html).toContain("Anas Cuts")

    // sendCount incremented for analytics.
    expect(prismaMock.automatedMessage.update).toHaveBeenCalledTimes(1)
    expect(prismaMock.automatedMessage.update.mock.calls[0][0].data).toEqual({
      sendCount: { increment: 1 },
    })
  })

  it("does NOT send when the client already has a stamp for the same occasion (idempotent)", async () => {
    prismaMock.automatedMessage.findMany.mockResolvedValue([message()])
    prismaMock.client.findMany.mockResolvedValue([client()])
    // A prior stamp for THIS message + THIS year already exists.
    prismaMock.notification.findMany.mockResolvedValue([
      { metadata: { automatedMessageId: "m-birthday", occasionKey: "birthday:2026" } },
    ])

    const res = await runDueAutomatedMessages(new Date("2026-06-06T12:00:00.000Z"))

    expect(res.skippedAlreadySent).toBe(1)
    expect(res.emailsSent).toBe(0)
    expect(prismaMock.notification.create).not.toHaveBeenCalled()
    expect(sendEmailMock).not.toHaveBeenCalled()
  })

  it("still sends when a stamp exists but for a DIFFERENT occasion (last year)", async () => {
    prismaMock.automatedMessage.findMany.mockResolvedValue([message()])
    prismaMock.client.findMany.mockResolvedValue([client()])
    prismaMock.notification.findMany.mockResolvedValue([
      { metadata: { automatedMessageId: "m-birthday", occasionKey: "birthday:2025" } },
    ])

    const res = await runDueAutomatedMessages(new Date("2026-06-06T12:00:00.000Z"))
    expect(res.emailsSent).toBe(1)
    expect(prismaMock.notification.create).toHaveBeenCalledTimes(1)
  })

  it("does not email a client whose birthday is not today", async () => {
    prismaMock.automatedMessage.findMany.mockResolvedValue([message()])
    prismaMock.client.findMany.mockResolvedValue([
      client({ dateOfBirth: new Date("1990-12-25T00:00:00.000Z") }),
    ])

    const res = await runDueAutomatedMessages(new Date("2026-06-06T12:00:00.000Z"))
    expect(res.emailsSent).toBe(0)
    expect(prismaMock.notification.create).not.toHaveBeenCalled()
  })
})

describe("runDueAutomatedMessages — win-back & gating", () => {
  it("fires win_back for lapsed clients, querying on a lastVisitAt cutoff", async () => {
    prismaMock.automatedMessage.findMany.mockResolvedValue([
      message({ id: "m-winback", trigger: AutomatedMessageTrigger.win_back, subject: "We miss you" }),
    ])
    prismaMock.client.findMany.mockResolvedValue([
      client({ lastVisitAt: new Date("2024-01-01T00:00:00.000Z"), dateOfBirth: null }),
    ])

    const res = await runDueAutomatedMessages(new Date("2026-06-06T12:00:00.000Z"))

    // Candidate query gates on lapsed lastVisitAt + consent.
    const where = prismaMock.client.findMany.mock.calls[0][0].where
    expect(where.businessId).toBe(BIZ)
    expect(where.emailConsent).toBe(true)
    expect(where.marketingConsent).toBe(true)
    expect(where.lastVisitAt).toHaveProperty("lt")

    expect(res.emailsSent).toBe(1)
    const stamp = prismaMock.notification.create.mock.calls[0][0].data
    expect(stamp.metadata.occasionKey).toBe(`win_back:${new Date("2024-01-01T00:00:00.000Z").toISOString()}`)
  })

  it("skips SMS rows entirely (beta)", async () => {
    prismaMock.automatedMessage.findMany.mockResolvedValue([message({ channel: "sms" })])

    const res = await runDueAutomatedMessages(new Date("2026-06-06T12:00:00.000Z"))
    expect(res.skippedNonEmail).toBe(1)
    expect(res.messagesEvaluated).toBe(0)
    expect(prismaMock.client.findMany).not.toHaveBeenCalled()
    expect(sendEmailMock).not.toHaveBeenCalled()
  })

  it("skips appointment-linked triggers (covered by reminders / lifecycle flows)", async () => {
    prismaMock.automatedMessage.findMany.mockResolvedValue([
      message({ id: "m-rem", trigger: AutomatedMessageTrigger.appointment_reminder }),
      message({ id: "m-rev", trigger: AutomatedMessageTrigger.review_request }),
    ])

    const res = await runDueAutomatedMessages(new Date("2026-06-06T12:00:00.000Z"))
    expect(res.skippedCoveredElsewhere).toBe(2)
    expect(res.messagesEvaluated).toBe(0)
    expect(sendEmailMock).not.toHaveBeenCalled()
  })

  it("stays stamped even if sendEmail throws (no re-send loop)", async () => {
    prismaMock.automatedMessage.findMany.mockResolvedValue([message()])
    prismaMock.client.findMany.mockResolvedValue([client()])
    sendEmailMock.mockRejectedValue(new Error("provider down"))

    const res = await runDueAutomatedMessages(new Date("2026-06-06T12:00:00.000Z"))
    expect(res.emailsSent).toBe(0)
    // Stamp was written before the failed send and is not rolled back.
    expect(prismaMock.notification.create).toHaveBeenCalledTimes(1)
  })
})
