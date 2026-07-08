import { describe, it, expect } from "vitest"
import { collectUnaccepted, collectBlocking } from "../scripts/check-audit.mjs"

// Gate G.3 — the dependency-audit gate's core filter. A high/critical advisory in
// an allowlisted package is accepted (triaged, documented); one in ANY other
// package must block. Moderate/low never block. This locks that logic so the gate
// can't silently start ignoring a new critical.

const allowlist = [
  { package: "next", severity: "high" },
  { package: "fast-uri", severity: "high" },
]

describe("check:audit — collectUnaccepted (Gate G.3)", () => {
  it("accepts a high in an allowlisted package (returns nothing to block on)", () => {
    const audit = { vulnerabilities: { next: { severity: "high" }, "fast-uri": { severity: "high" } } }
    expect(collectUnaccepted(audit, allowlist)).toEqual([])
  })

  it("BLOCKS a high/critical in a package that is NOT allowlisted", () => {
    const audit = {
      vulnerabilities: {
        next: { severity: "high" }, // allowlisted → ok
        lodash: { severity: "critical" }, // NOT allowlisted → must block
      },
    }
    const out = collectUnaccepted(audit, allowlist)
    expect(out).toEqual([{ package: "lodash", severity: "critical" }])
  })

  it("never blocks on moderate/low severities", () => {
    const audit = { vulnerabilities: { foo: { severity: "moderate" }, bar: { severity: "low" } } }
    expect(collectUnaccepted(audit, allowlist)).toEqual([])
  })

  it("collectBlocking lists every high/critical (for transparent reporting), allowlisted or not", () => {
    const audit = { vulnerabilities: { next: { severity: "high" }, lodash: { severity: "critical" }, foo: { severity: "low" } } }
    expect(collectBlocking(audit).map((b) => b.package).sort()).toEqual(["lodash", "next"])
  })

  it("tolerates an empty/malformed audit object", () => {
    expect(collectUnaccepted({}, allowlist)).toEqual([])
    expect(collectUnaccepted({ vulnerabilities: {} }, [])).toEqual([])
  })
})
