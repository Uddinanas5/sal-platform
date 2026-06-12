import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"

// Phase 4B — the rate limiter must use Upstash (distributed) when configured and
// fall back to the in-memory limiter otherwise, behind one async signature.

const { limitMock } = vi.hoisted(() => ({ limitMock: vi.fn() }))

vi.mock("@upstash/redis", () => ({ Redis: class {} }))
vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class {
    static slidingWindow = vi.fn(() => ({}))
    limit = limitMock
  },
}))

const ENV_URL = "UPSTASH_REDIS_REST_URL"
const ENV_TOKEN = "UPSTASH_REDIS_REST_TOKEN"

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
  delete process.env[ENV_URL]
  delete process.env[ENV_TOKEN]
})
afterEach(() => {
  delete process.env[ENV_URL]
  delete process.env[ENV_TOKEN]
})

describe("rateLimit — Upstash backend (configured)", () => {
  it("delegates to Upstash and maps a denied result to { limited, retryAfterMs }", async () => {
    process.env[ENV_URL] = "https://example.upstash.io"
    process.env[ENV_TOKEN] = "tok"
    const reset = Date.now() + 30_000
    limitMock.mockResolvedValue({ success: false, remaining: 0, reset })
    const { rateLimit } = await import("@/lib/rate-limit")
    const r = await rateLimit("login:a@b.com", 5, 60_000)
    expect(limitMock).toHaveBeenCalledWith("login:a@b.com")
    expect(r.limited).toBe(true)
    if (r.limited) expect(r.retryAfterMs).toBeGreaterThan(0)
  })

  it("maps an allowed Upstash result to { limited:false, remaining }", async () => {
    process.env[ENV_URL] = "https://example.upstash.io"
    process.env[ENV_TOKEN] = "tok"
    limitMock.mockResolvedValue({ success: true, remaining: 4, reset: Date.now() + 60_000 })
    const { rateLimit } = await import("@/lib/rate-limit")
    const r = await rateLimit("login:a@b.com", 5, 60_000)
    expect(r).toEqual({ limited: false, remaining: 4 })
  })

  it("falls back to in-memory when Upstash throws (Redis hiccup must not block auth)", async () => {
    process.env[ENV_URL] = "https://example.upstash.io"
    process.env[ENV_TOKEN] = "tok"
    limitMock.mockRejectedValue(new Error("network"))
    const { rateLimit } = await import("@/lib/rate-limit")
    const r = await rateLimit("login:hiccup@b.com", 5, 60_000)
    expect(r).toEqual({ limited: false, remaining: 4 }) // first in-memory hit
  })
})

describe("rateLimit — in-memory fallback (no Upstash env)", () => {
  it("allows up to maxAttempts then limits, and the limited result carries retryAfterMs", async () => {
    const { rateLimit } = await import("@/lib/rate-limit")
    const key = `fallback:${Math.random()}`
    expect(await rateLimit(key, 3, 60_000)).toEqual({ limited: false, remaining: 2 })
    expect(await rateLimit(key, 3, 60_000)).toEqual({ limited: false, remaining: 1 })
    expect(await rateLimit(key, 3, 60_000)).toEqual({ limited: false, remaining: 0 })
    const fourth = await rateLimit(key, 3, 60_000)
    expect(fourth.limited).toBe(true)
    if (fourth.limited) expect(fourth.retryAfterMs).toBeGreaterThan(0)
    // Upstash was never touched on the fallback path.
    expect(limitMock).not.toHaveBeenCalled()
  })

  it("resets after the window elapses", async () => {
    vi.useFakeTimers()
    try {
      const { rateLimit } = await import("@/lib/rate-limit")
      const key = `window:${Math.random()}`
      await rateLimit(key, 1, 1_000)
      expect((await rateLimit(key, 1, 1_000)).limited).toBe(true)
      vi.advanceTimersByTime(1_100)
      expect(await rateLimit(key, 1, 1_000)).toEqual({ limited: false, remaining: 0 })
    } finally {
      vi.useRealTimers()
    }
  })
})
