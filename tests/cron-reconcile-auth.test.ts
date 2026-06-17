import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"

// Proves /api/cron/reconcile clones cron/dispatch's FAIL-CLOSED security model
// (shared src/lib/cron-auth.ts) and that the drift digest email is sent ONLY
// when drift exists (no alarm fatigue). The reconcile lib + email sender are
// mocked — this asserts orchestration only, no DB and no Stripe.

const { loadSpy, computeSpy, digestSpy, sendEmailSpy } = vi.hoisted(() => ({
  loadSpy: vi.fn(),
  computeSpy: vi.fn(),
  digestSpy: vi.fn(),
  sendEmailSpy: vi.fn(),
}))

const EMPTY_INPUTS = {
  stripePaymentIntents: [],
  stripeDisputes: [],
  stripeSubscriptions: [],
  dbPayments: [],
  dbDisputes: [],
  dbBusinesses: [],
}

const SAMPLE_DRIFT = [
  {
    kind: "missing_payment",
    paymentIntentId: "pi_x",
    stripeStatus: "succeeded",
    amountCents: 1200,
    currency: "usd",
  },
]

describe("cron/reconcile — fail-closed auth + digest-only-on-drift", () => {
  const ORIGINAL_CRON = process.env.CRON_SECRET
  const ORIGINAL_ALERT = process.env.ALERT_EMAIL

  beforeEach(() => {
    vi.resetModules()
    loadSpy.mockReset()
    computeSpy.mockReset()
    digestSpy.mockReset()
    sendEmailSpy.mockReset()
    loadSpy.mockResolvedValue(EMPTY_INPUTS)
    computeSpy.mockReturnValue([])
    digestSpy.mockReturnValue({ subject: "[SAL] drift", html: "<p>drift</p>" })
    sendEmailSpy.mockResolvedValue({ success: true })
    process.env.ALERT_EMAIL = "founder@meetsal.ai"
  })

  afterEach(() => {
    if (ORIGINAL_CRON === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = ORIGINAL_CRON
    if (ORIGINAL_ALERT === undefined) delete process.env.ALERT_EMAIL
    else process.env.ALERT_EMAIL = ORIGINAL_ALERT
  })

  async function loadRoute() {
    vi.doMock("@/lib/billing/reconcile", () => ({
      loadReconcileInputs: loadSpy,
      computeDrift: computeSpy,
      buildDriftDigest: digestSpy,
    }))
    vi.doMock("@/lib/email", () => ({ sendEmail: sendEmailSpy }))
    return import("@/app/api/cron/reconcile/route")
  }

  function req(headers: Record<string, string> = {}) {
    return new Request("https://app.test/api/cron/reconcile", {
      method: "GET",
      headers,
    }) as never
  }

  it("401 + NOTHING runs when CRON_SECRET is unset (fail closed, no open-by-default)", async () => {
    delete process.env.CRON_SECRET
    const { GET } = await loadRoute()
    const res = await GET(req({ authorization: "Bearer anything" }))
    expect(res.status).toBe(401)
    expect(loadSpy).not.toHaveBeenCalled()
    expect(sendEmailSpy).not.toHaveBeenCalled()
  })

  it("401 + NOTHING runs on a wrong secret", async () => {
    process.env.CRON_SECRET = "the-real-secret"
    const { GET } = await loadRoute()
    const res = await GET(req({ authorization: "Bearer wrong-secret" }))
    expect(res.status).toBe(401)
    expect(loadSpy).not.toHaveBeenCalled()
  })

  it("200 on the correct secret; clean run sends NO email (digest only on drift)", async () => {
    process.env.CRON_SECRET = "the-real-secret"
    const { GET } = await loadRoute()
    const res = await GET(req({ authorization: "Bearer the-real-secret" }))
    expect(res.status).toBe(200)
    const body = await (res as unknown as Response).json()
    expect(body.ok).toBe(true)
    expect(body.driftCount).toBe(0)
    expect(body.emailed).toBe(false)
    expect(loadSpy).toHaveBeenCalledTimes(1)
    expect(computeSpy).toHaveBeenCalledWith(EMPTY_INPUTS)
    expect(sendEmailSpy).not.toHaveBeenCalled()
  })

  it("accepts the x-cron-secret header too (manual/portable runs, dispatch parity)", async () => {
    process.env.CRON_SECRET = "the-real-secret"
    const { GET } = await loadRoute()
    const res = await GET(req({ "x-cron-secret": "the-real-secret" }))
    expect(res.status).toBe(200)
  })

  it("drift present → digest email sent exactly once to ALERT_EMAIL", async () => {
    process.env.CRON_SECRET = "the-real-secret"
    computeSpy.mockReturnValue(SAMPLE_DRIFT)
    const { GET } = await loadRoute()
    const res = await GET(req({ authorization: "Bearer the-real-secret" }))
    expect(res.status).toBe(200)
    const body = await (res as unknown as Response).json()
    expect(body.driftCount).toBe(1)
    expect(body.emailed).toBe(true)
    expect(sendEmailSpy).toHaveBeenCalledTimes(1)
    expect(sendEmailSpy.mock.calls[0][0]).toMatchObject({
      to: "founder@meetsal.ai",
      subject: "[SAL] drift",
    })
    expect(digestSpy).toHaveBeenCalledWith(SAMPLE_DRIFT, expect.any(Date))
  })

  it("drift but ALERT_EMAIL unset → no email, still 200, drift still reported in the response", async () => {
    process.env.CRON_SECRET = "the-real-secret"
    delete process.env.ALERT_EMAIL
    computeSpy.mockReturnValue(SAMPLE_DRIFT)
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const { GET } = await loadRoute()
    const res = await GET(req({ authorization: "Bearer the-real-secret" }))
    expect(res.status).toBe(200)
    const body = await (res as unknown as Response).json()
    expect(body.driftCount).toBe(1)
    expect(body.emailed).toBe(false)
    expect(sendEmailSpy).not.toHaveBeenCalled()
    expect(
      errorSpy.mock.calls.some((c) => String(c[0]).includes("ALERT_EMAIL is not set"))
    ).toBe(true)
    errorSpy.mockRestore()
  })

  it("fails closed (500) when the loader throws — cron simply retries next tick", async () => {
    process.env.CRON_SECRET = "the-real-secret"
    loadSpy.mockRejectedValue(new Error("stripe down"))
    const { GET } = await loadRoute()
    const res = await GET(req({ authorization: "Bearer the-real-secret" }))
    expect(res.status).toBe(500)
    expect(sendEmailSpy).not.toHaveBeenCalled()
  })
})
