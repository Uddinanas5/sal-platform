import { describe, it, expect } from "vitest"
import { scrubEvent } from "@/lib/sentry-scrub"
import type { ErrorEvent } from "@sentry/nextjs"

// Phase 4A — Sentry must never exfiltrate client PII or secrets. The beforeSend
// scrubber drops request bodies, redacts sensitive headers/keys, and reduces the
// user to an opaque id, while KEEPING useful debug context (requestId/businessId).

describe("scrubEvent — PII/secret scrubbing", () => {
  it("drops request body + cookies + query, redacts sensitive headers", () => {
    const event = {
      request: {
        method: "POST",
        url: "https://app/checkout",
        query_string: "token=abc123",
        cookies: { "authjs.session-token": "secretcookie" },
        data: { clientEmail: "client@example.com", cardNumber: "4242424242424242" },
        headers: {
          authorization: "Bearer sk_live_xyz",
          "stripe-signature": "t=1,v1=deadbeef",
          "user-agent": "Mozilla",
        },
      },
    } as unknown as ErrorEvent

    const out = scrubEvent(event)
    expect(out.request?.data).toBeUndefined()
    expect(out.request?.cookies).toBeUndefined()
    expect(out.request?.query_string).toBeUndefined()
    expect(out.request?.headers?.authorization).toBe("[Redacted]")
    expect(out.request?.headers?.["stripe-signature"]).toBe("[Redacted]")
    // Non-sensitive headers survive for debugging.
    expect(out.request?.headers?.["user-agent"]).toBe("Mozilla")
  })

  it("reduces the user to an opaque id (no email/ip/username)", () => {
    const event = {
      user: { id: "u_123", email: "client@example.com", ip_address: "1.2.3.4", username: "bob" },
    } as unknown as ErrorEvent
    const out = scrubEvent(event)
    expect(out.user).toEqual({ id: "u_123" })
  })

  it("redacts sensitive keys anywhere in extra, but keeps requestId/businessId", () => {
    const event = {
      extra: {
        requestId: "req_1",
        businessId: "biz_1",
        stripe_secret: "sk_live_abc",
        nested: { apiKey: "k_123", note: "ok", password: "hunter2" },
      },
      tags: { cron_secret: "topsecret", route: "/api/checkout" },
    } as unknown as ErrorEvent

    const out = scrubEvent(event)
    const extra = out.extra as Record<string, unknown>
    expect(extra.requestId).toBe("req_1")
    expect(extra.businessId).toBe("biz_1")
    expect(extra.stripe_secret).toBe("[Redacted]")
    const nested = extra.nested as Record<string, unknown>
    expect(nested.apiKey).toBe("[Redacted]")
    expect(nested.password).toBe("[Redacted]")
    expect(nested.note).toBe("ok")
    const tags = out.tags as Record<string, unknown>
    expect(tags.cron_secret).toBe("[Redacted]")
    expect(tags.route).toBe("/api/checkout")
  })
})
