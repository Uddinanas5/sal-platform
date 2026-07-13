import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { isActiveStatus } from "@/lib/permissions"

// L-039 — the credentials authorize() minted a session for ANY user with a correct
// password, never checking user.status. A suspended/deactivated owner could still
// log in and hit the onboarding actions (which authorize by ownerId only, bypassing
// resolveBusinessRole). isActiveStatus is now the shared gate for both authorize()
// and resolveBusinessRole so the two can't disagree about who may hold a session.

describe("isActiveStatus — the session-eligibility predicate (L-039)", () => {
  it("is true ONLY for the 'active' status", () => {
    expect(isActiveStatus("active")).toBe(true)
  })
  it("is false for 'suspended' and 'inactive' (the other UserStatus values)", () => {
    expect(isActiveStatus("suspended")).toBe(false)
    expect(isActiveStatus("inactive")).toBe(false)
  })
  it("is false for null / undefined / empty (fail-closed)", () => {
    expect(isActiveStatus(null)).toBe(false)
    expect(isActiveStatus(undefined)).toBe(false)
    expect(isActiveStatus("")).toBe(false)
  })
  it("is false for an unrecognized status string", () => {
    expect(isActiveStatus("Active")).toBe(false) // case-sensitive; enum is lowercase
    expect(isActiveStatus("pending")).toBe(false)
  })
})

// authorize() is a non-exported credentials-provider closure, so lock the wiring
// with a source-guard: the login path must refuse a non-active account. (The
// resolveBusinessRole side is already behaviourally covered by
// tests/membership-revocation.test.ts — "deactivated user even if still owner".)
describe("authorize() refuses a non-active account (L-039 wiring)", () => {
  it("src/lib/auth.ts gates the login on isActiveStatus(user.status)", () => {
    const src = readFileSync(resolve(process.cwd(), "src/lib/auth.ts"), "utf8")
    expect(src).toContain("isActiveStatus(user.status)")
    // ...and returns null (no session) rather than throwing/continuing.
    expect(/isActiveStatus\(user\.status\)\)\s*return null/.test(src)).toBe(true)
  })
})
