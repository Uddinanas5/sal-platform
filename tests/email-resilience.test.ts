import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"

// Phase 4D — sendEmail must survive a slow/flaky provider: timeout + bounded
// retry on transient errors, NO retry on terminal 4xx, and NEVER throw (email is
// a best-effort post-commit side effect; it must not break the request).

const { sendMock } = vi.hoisted(() => {
  process.env.RESEND_API_KEY = "re_test"
  process.env.EMAIL_TIMEOUT_MS = "10000"
  return { sendMock: vi.fn() }
})

vi.mock("resend", () => ({ Resend: class { emails = { send: sendMock } } }))
vi.mock("@/lib/db/transaction-side-effects", () => ({ assertOutsideTransaction: vi.fn() }))

import { sendEmail } from "@/lib/email"

const msg = { to: "c@example.com", subject: "Hi", html: "<p>hi</p>" }

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
})
afterEach(() => vi.useRealTimers())

async function run(call: Promise<unknown>) {
  await vi.runAllTimersAsync()
  return call
}

describe("sendEmail resilience", () => {
  it("retries a transient failure and ultimately succeeds", async () => {
    sendMock
      .mockRejectedValueOnce(new Error("ECONNRESET"))
      .mockRejectedValueOnce(new Error("ECONNRESET"))
      .mockResolvedValue({ data: { id: "em_1" }, error: null })
    const result = (await run(sendEmail(msg))) as { success: boolean }
    expect(result.success).toBe(true)
    expect(sendMock).toHaveBeenCalledTimes(3)
  })

  it("does NOT retry a terminal 4xx (invalid recipient) and returns failure", async () => {
    sendMock.mockResolvedValue({ data: null, error: { statusCode: 422, name: "validation_error" } })
    const result = (await run(sendEmail(msg))) as { success: boolean }
    expect(result.success).toBe(false)
    expect(sendMock).toHaveBeenCalledTimes(1)
  })

  it("times out a hung send, retries, and returns failure WITHOUT throwing", async () => {
    sendMock.mockReturnValue(new Promise(() => {})) // never resolves
    let threw = false
    const p = sendEmail(msg).catch(() => {
      threw = true
      return { success: false }
    })
    const result = (await run(p)) as { success: boolean }
    expect(threw).toBe(false)
    expect(result.success).toBe(false)
    expect(sendMock).toHaveBeenCalledTimes(3) // initial + 2 retries, each timed out
  })
})
