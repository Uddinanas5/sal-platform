import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"

// Proves the cron dispatch route runs BOTH engines on an authorized tick and
// aggregates their results in one JSON response, while still failing closed.
// Both engine modules are mocked so this asserts orchestration only — no DB.

const { remindersSpy, automatedSpy } = vi.hoisted(() => ({
  remindersSpy: vi.fn(),
  automatedSpy: vi.fn(),
}))

describe("cron/dispatch — aggregates reminders + automated messages", () => {
  const ORIGINAL = process.env.CRON_SECRET

  beforeEach(() => {
    vi.resetModules()
    remindersSpy.mockReset()
    automatedSpy.mockReset()
    remindersSpy.mockResolvedValue({
      windows: [],
      scanned: 0,
      emailsSent: 2,
      skippedNoEmail: 0,
      skippedNoConsent: 0,
      stamped: 2,
    })
    automatedSpy.mockResolvedValue({
      messagesEvaluated: 1,
      skippedCoveredElsewhere: 0,
      skippedNonEmail: 0,
      candidatesScanned: 3,
      emailsSent: 1,
      skippedAlreadySent: 1,
      skippedNoEmailOrConsent: 0,
    })
  })

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = ORIGINAL
  })

  async function loadRoute() {
    vi.doMock("@/lib/automation/reminders", () => ({ runDueReminders: remindersSpy }))
    vi.doMock("@/lib/automation/automated-messages", () => ({
      runDueAutomatedMessages: automatedSpy,
    }))
    return import("@/app/api/cron/dispatch/route")
  }

  function req(headers: Record<string, string> = {}) {
    return new Request("https://app.test/api/cron/dispatch", { method: "GET", headers }) as never
  }

  it("runs nothing on an unauthorized request (fails closed)", async () => {
    delete process.env.CRON_SECRET
    const { GET } = await loadRoute()
    const res = await GET(req({ authorization: "Bearer anything" }))
    expect(res.status).toBe(401)
    expect(remindersSpy).not.toHaveBeenCalled()
    expect(automatedSpy).not.toHaveBeenCalled()
  })

  it("runs both engines and returns both result sets on a correct secret", async () => {
    process.env.CRON_SECRET = "the-real-secret"
    const { GET } = await loadRoute()
    const res = await GET(req({ authorization: "Bearer the-real-secret" }))
    expect(res.status).toBe(200)
    expect(remindersSpy).toHaveBeenCalledTimes(1)
    expect(automatedSpy).toHaveBeenCalledTimes(1)

    const body = await (res as unknown as Response).json()
    expect(body.ok).toBe(true)
    // Reminder fields preserved at the top level (backward compatible).
    expect(body.emailsSent).toBe(2)
    // Both engines also exposed under named keys.
    expect(body.reminders.emailsSent).toBe(2)
    expect(body.automatedMessages.emailsSent).toBe(1)
    expect(body.automatedMessages.skippedAlreadySent).toBe(1)
  })

  it("both engines receive the same tick timestamp", async () => {
    process.env.CRON_SECRET = "the-real-secret"
    const { GET } = await loadRoute()
    await GET(req({ authorization: "Bearer the-real-secret" }))
    const reminderArg = remindersSpy.mock.calls[0][0]
    const automatedArg = automatedSpy.mock.calls[0][0]
    expect(reminderArg).toBeInstanceOf(Date)
    expect(automatedArg).toBeInstanceOf(Date)
    expect(reminderArg.getTime()).toBe(automatedArg.getTime())
  })
})
