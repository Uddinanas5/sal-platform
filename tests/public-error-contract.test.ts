import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { withSafeErrors } from "@/lib/api/safe-handler"

// Guards the public error contract (GAP-027 / the availability-leak bug): a
// thrown error on an anonymous-reachable route must surface as a generic 503
// envelope with NO ORM/driver/stack detail, while the real cause is logged
// server-side. Non-throwing responses pass through untouched.

describe("withSafeErrors — public error contract", () => {
  let errSpy: ReturnType<typeof vi.spyOn>
  beforeEach(() => {
    errSpy = vi.spyOn(console, "error").mockImplementation(() => {})
  })
  afterEach(() => {
    errSpy.mockRestore()
  })

  it("maps a thrown Prisma-like error to a generic 503 with no leaked internals", async () => {
    const leak = new Error(
      "Invalid `prisma.service.findUnique()` invocation: Error opening a TLS connection at /node_modules/@prisma/client"
    )
    const handler = withSafeErrors("test-route", async () => {
      throw leak
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await handler({} as any, {} as any)

    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error.code).toBe("TEMPORARY_UNAVAILABLE")

    const serialized = JSON.stringify(body).toLowerCase()
    expect(serialized).not.toContain("prisma")
    expect(serialized).not.toContain("node_modules")
    expect(serialized).not.toContain("tls")

    // The real cause must still reach server logs.
    expect(errSpy).toHaveBeenCalled()
    const logged = errSpy.mock.calls.flat().map(String).join(" ")
    expect(logged).toContain("prisma")
  })

  it("passes a non-throwing handler's Response through unchanged", async () => {
    const ok = Response.json({ ok: true }, { status: 200 })
    const handler = withSafeErrors("test-route", async () => ok)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await handler({} as any, {} as any)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(errSpy).not.toHaveBeenCalled()
  })
})
