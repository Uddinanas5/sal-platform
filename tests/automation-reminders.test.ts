import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"

// Proves SAL's "Never Miss Again" reminder backbone:
//  (A) findDueReminders queries ONLY appointments that are (1) un-reminded
//      (reminderSentAt: null), (2) in a remindable status, and (3) inside a
//      24h-or-2h start-time window. The select carries businessId so each row
//      is self-describing and tenant-safe.
//  (B) runDueReminders stamps reminderSentAt atomically (updateMany guarded by
//      reminderSentAt: null + the row's own businessId) and only emails clients
//      who have an email AND emailConsent. It never double-sends.
//  (C) the cron route fails CLOSED — 401 on missing/wrong/unset CRON_SECRET,
//      and only runs the dispatch on a correct constant-time match.
// Mocks prisma + sendEmail — no DB, no network.

const { prismaMock, sendEmailMock, runDueRemindersSpy } = vi.hoisted(() => {
  const prismaMock = {
    appointment: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
  }
  const sendEmailMock = vi.fn()
  // Spy used by the route test so we can assert it is NOT called when unauthorized.
  const runDueRemindersSpy = vi.fn()
  return { prismaMock, sendEmailMock, runDueRemindersSpy }
})

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/lib/email", () => ({ sendEmail: sendEmailMock }))

import {
  buildReminderWindows,
  findDueReminders,
  runDueReminders,
  REMINDER_BATCH_CAP,
} from "@/lib/automation/reminders"

const BIZ = "11111111-1111-4111-8111-111111111111"
const OTHER_BIZ = "99999999-9999-4999-8999-999999999999"

function appt(overrides: Record<string, unknown> = {}) {
  return {
    id: "aaaaaaaa-0000-4000-8000-000000000001",
    businessId: BIZ,
    startTime: new Date("2026-06-05T10:00:00.000Z"),
    bookingReference: "SAL-001",
    client: {
      email: "client@example.com",
      firstName: "Jordan",
      lastName: "Reyes",
      emailConsent: true,
    },
    business: { name: "Anas Cuts", email: "shop@example.com", phone: "5551234" },
    services: [{ name: "Haircut" }],
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.appointment.findMany.mockResolvedValue([])
  // Default: every claim wins (one row stamped).
  prismaMock.appointment.updateMany.mockResolvedValue({ count: 1 })
  sendEmailMock.mockResolvedValue({ success: true })
})

describe("buildReminderWindows", () => {
  it("produces a 24h and a 2h window straddling the target times", () => {
    const now = new Date("2026-06-04T12:00:00.000Z")
    const [w24, w2] = buildReminderWindows(now)
    expect(w24.label).toBe("24h")
    expect(w2.label).toBe("2h")
    // 24h window centered on now+24h (+/- 15 min).
    expect(w24.start.toISOString()).toBe("2026-06-05T11:45:00.000Z")
    expect(w24.end.toISOString()).toBe("2026-06-05T12:15:00.000Z")
    // 2h window centered on now+2h (+/- 15 min).
    expect(w2.start.toISOString()).toBe("2026-06-04T13:45:00.000Z")
    expect(w2.end.toISOString()).toBe("2026-06-04T14:15:00.000Z")
  })
})

describe("findDueReminders — query selectivity", () => {
  it("filters on un-reminded + remindable status + the time windows, bounded", async () => {
    const windows = buildReminderWindows(new Date("2026-06-04T12:00:00.000Z"))
    await findDueReminders(windows)

    expect(prismaMock.appointment.findMany).toHaveBeenCalledTimes(1)
    const arg = prismaMock.appointment.findMany.mock.calls[0][0]

    // (1) Only un-reminded rows.
    expect(arg.where.reminderSentAt).toBeNull()
    // (2) Only live/remindable statuses — never cancelled/no_show/completed.
    expect(arg.where.status).toEqual({ in: ["pending", "confirmed"] })
    // (3) Time windows ORed together, each a startTime range.
    expect(arg.where.OR).toEqual([
      { startTime: { gte: windows[0].start, lte: windows[0].end } },
      { startTime: { gte: windows[1].start, lte: windows[1].end } },
    ])
    // Bounded per run.
    expect(arg.take).toBe(REMINDER_BATCH_CAP)
    // Selects businessId so each row is tenant-self-describing.
    expect(arg.select.businessId).toBe(true)
  })
})

describe("runDueReminders — stamping + consent + idempotency", () => {
  it("stamps reminderSentAt atomically, scoped to the row's own businessId", async () => {
    prismaMock.appointment.findMany.mockResolvedValue([appt()])

    const now = new Date("2026-06-04T12:00:00.000Z")
    const res = await runDueReminders(now)

    // The claim is an updateMany guarded by reminderSentAt: null (idempotency
    // lock) AND the appointment's OWN businessId (tenant scoping of the write).
    expect(prismaMock.appointment.updateMany).toHaveBeenCalledTimes(1)
    const upd = prismaMock.appointment.updateMany.mock.calls[0][0]
    expect(upd.where.id).toBe("aaaaaaaa-0000-4000-8000-000000000001")
    expect(upd.where.businessId).toBe(BIZ)
    expect(upd.where.reminderSentAt).toBeNull()
    expect(upd.data.reminderSentAt).toBe(now)

    expect(res.stamped).toBe(1)
    expect(res.emailsSent).toBe(1)
    expect(sendEmailMock).toHaveBeenCalledTimes(1)
    expect(sendEmailMock.mock.calls[0][0].to).toBe("client@example.com")
  })

  it("does not email a client without emailConsent (and does not stamp)", async () => {
    prismaMock.appointment.findMany.mockResolvedValue([
      appt({
        client: {
          email: "noconsent@example.com",
          firstName: "Sam",
          lastName: "Doe",
          emailConsent: false,
        },
      }),
    ])

    const res = await runDueReminders(new Date())

    expect(res.skippedNoConsent).toBe(1)
    expect(res.emailsSent).toBe(0)
    // No stamp burned on a non-consenting client — leave it for nothing.
    expect(prismaMock.appointment.updateMany).not.toHaveBeenCalled()
    expect(sendEmailMock).not.toHaveBeenCalled()
  })

  it("skips a client with no email on file", async () => {
    prismaMock.appointment.findMany.mockResolvedValue([
      appt({
        client: {
          email: null,
          firstName: "Pat",
          lastName: "Lee",
          emailConsent: true,
        },
      }),
    ])

    const res = await runDueReminders(new Date())
    expect(res.skippedNoEmail).toBe(1)
    expect(sendEmailMock).not.toHaveBeenCalled()
    expect(prismaMock.appointment.updateMany).not.toHaveBeenCalled()
  })

  it("does not double-send when the atomic claim is lost (race)", async () => {
    prismaMock.appointment.findMany.mockResolvedValue([appt()])
    // Simulate another concurrent cron tick already stamped this row.
    prismaMock.appointment.updateMany.mockResolvedValue({ count: 0 })

    const res = await runDueReminders(new Date())

    expect(res.stamped).toBe(0)
    expect(res.emailsSent).toBe(0)
    // Claim was attempted but the send was suppressed because we lost the race.
    expect(prismaMock.appointment.updateMany).toHaveBeenCalledTimes(1)
    expect(sendEmailMock).not.toHaveBeenCalled()
  })

  it("stays stamped even if sendEmail throws (no re-send loop)", async () => {
    prismaMock.appointment.findMany.mockResolvedValue([appt()])
    sendEmailMock.mockRejectedValue(new Error("provider down"))

    const res = await runDueReminders(new Date())

    // We claimed (stamped) before sending, and we do NOT roll back on failure.
    expect(res.stamped).toBe(1)
    expect(res.emailsSent).toBe(0)
    expect(prismaMock.appointment.updateMany).toHaveBeenCalledTimes(1)
  })

  it("renders each email only from the row's own business — tenant isolation", async () => {
    prismaMock.appointment.findMany.mockResolvedValue([
      appt({ businessId: OTHER_BIZ, business: { name: "Other Shop", email: null, phone: null } }),
    ])

    await runDueReminders(new Date())

    // The write is scoped to the row's own (other) businessId, never a shared one.
    const upd = prismaMock.appointment.updateMany.mock.calls[0][0]
    expect(upd.where.businessId).toBe(OTHER_BIZ)
    // The email body is built from that row's own business name.
    const html = sendEmailMock.mock.calls[0][0].html as string
    expect(html).toContain("Other Shop")
  })
})

// --- Route auth (fail closed) -------------------------------------------------

describe("cron/dispatch route — fails closed on CRON_SECRET", () => {
  const ORIGINAL = process.env.CRON_SECRET

  beforeEach(() => {
    vi.resetModules()
    runDueRemindersSpy.mockReset()
    runDueRemindersSpy.mockResolvedValue({
      windows: [],
      scanned: 0,
      emailsSent: 0,
      skippedNoEmail: 0,
      skippedNoConsent: 0,
      stamped: 0,
    })
  })

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = ORIGINAL
  })

  async function loadRoute() {
    // Re-mock the helper so the route under test calls our spy, letting us
    // assert it is NEVER invoked on an unauthorized request.
    vi.doMock("@/lib/automation/reminders", () => ({
      runDueReminders: runDueRemindersSpy,
    }))
    return import("@/app/api/cron/dispatch/route")
  }

  function req(headers: Record<string, string> = {}) {
    return new Request("https://app.test/api/cron/dispatch", {
      method: "GET",
      headers,
    }) as never
  }

  it("returns 401 and runs nothing when CRON_SECRET is unset", async () => {
    delete process.env.CRON_SECRET
    const { GET } = await loadRoute()
    const res = await GET(req({ authorization: "Bearer anything" }))
    expect(res.status).toBe(401)
    expect(runDueRemindersSpy).not.toHaveBeenCalled()
  })

  it("returns 401 and runs nothing when the secret does not match", async () => {
    process.env.CRON_SECRET = "the-real-secret"
    const { GET } = await loadRoute()
    const res = await GET(req({ authorization: "Bearer wrong-secret" }))
    expect(res.status).toBe(401)
    expect(runDueRemindersSpy).not.toHaveBeenCalled()
  })

  it("returns 401 when no credential header is present", async () => {
    process.env.CRON_SECRET = "the-real-secret"
    const { GET } = await loadRoute()
    const res = await GET(req())
    expect(res.status).toBe(401)
    expect(runDueRemindersSpy).not.toHaveBeenCalled()
  })

  it("runs the dispatch on a correct Bearer secret", async () => {
    process.env.CRON_SECRET = "the-real-secret"
    const { GET } = await loadRoute()
    const res = await GET(req({ authorization: "Bearer the-real-secret" }))
    expect(res.status).toBe(200)
    expect(runDueRemindersSpy).toHaveBeenCalledTimes(1)
  })

  it("also accepts the x-cron-secret header", async () => {
    process.env.CRON_SECRET = "the-real-secret"
    const { GET } = await loadRoute()
    const res = await GET(req({ "x-cron-secret": "the-real-secret" }))
    expect(res.status).toBe(200)
    expect(runDueRemindersSpy).toHaveBeenCalledTimes(1)
  })
})
