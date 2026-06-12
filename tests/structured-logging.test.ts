import { describe, it, expect } from "vitest"
import { Writable } from "node:stream"
import pino from "pino"
import { redact } from "@/lib/log/logger"
import { withLogContext, currentLogFields, setLogContext } from "@/lib/log/context"

// Phase 4C — structured logging must (a) never leak secrets/PII into a line, and
// (b) bind requestId/businessId to the request scope without bleeding across
// concurrent scopes.

function capture() {
  const lines: string[] = []
  const stream = new Writable({
    write(chunk, _enc, cb) { lines.push(chunk.toString()); cb() },
  })
  const logger = pino({ redact }, stream)
  return { logger, lines }
}

describe("logger redaction", () => {
  it("censors secrets + PII anywhere in the logged object", () => {
    const { logger, lines } = capture()
    logger.info(
      {
        authorization: "Bearer sk_live_secret",
        password: "hunter2",
        email: "client@example.com",
        phone: "+15551234567",
        nested: { token: "tok_abc", secret: "shh" },
        businessId: "biz_keepme",
        requestId: "req_keepme",
      },
      "event",
    )
    const out = lines.join("")
    expect(out).not.toContain("sk_live_secret")
    expect(out).not.toContain("hunter2")
    expect(out).not.toContain("client@example.com")
    expect(out).not.toContain("tok_abc")
    expect(out).toContain("[Redacted]")
    // Useful debug context survives.
    expect(out).toContain("biz_keepme")
    expect(out).toContain("req_keepme")
  })
})

describe("log context (AsyncLocalStorage)", () => {
  it("generates a requestId and exposes scope fields", () => {
    let fields: ReturnType<typeof currentLogFields> = null
    withLogContext({ businessId: "b1", route: "/x" }, () => {
      fields = currentLogFields()
    })
    expect(fields).toBeTruthy()
    expect(fields!.requestId).toBeTruthy()
    expect(fields!.businessId).toBe("b1")
    expect(fields!.route).toBe("/x")
  })

  it("isolates concurrent scopes (no bleed) and honors a supplied requestId", async () => {
    const seen: Record<string, string | undefined> = {}
    await Promise.all([
      new Promise<void>((res) =>
        withLogContext({ requestId: "r1", businessId: "bizA" }, () => {
          setTimeout(() => { seen.a = currentLogFields()?.businessId; res() }, 5)
        }),
      ),
      new Promise<void>((res) =>
        withLogContext({ requestId: "r2", businessId: "bizB" }, () => {
          setTimeout(() => { seen.b = currentLogFields()?.businessId; res() }, 1)
        }),
      ),
    ])
    expect(seen.a).toBe("bizA")
    expect(seen.b).toBe("bizB")
    expect(currentLogFields()).toBeNull() // outside any scope
  })

  it("setLogContext refines fields mid-scope (e.g. businessId after auth)", () => {
    let after: string | undefined
    withLogContext({ route: "/api" }, () => {
      setLogContext({ businessId: "late" })
      after = currentLogFields()?.businessId
    })
    expect(after).toBe("late")
  })
})
