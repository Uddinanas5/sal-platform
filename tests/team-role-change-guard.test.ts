import { describe, it, expect, vi } from "vitest"

// role-change-guard.ts imports the real @/lib/prisma at module load (only as the
// default client arg); stub it so importing the module doesn't construct a real DB
// client. Every test passes its own `client` explicitly.
vi.mock("@/lib/prisma", () => ({ prisma: { business: { findFirst: vi.fn() }, staff: { findFirst: vi.fn() } } }))

import { belongsToAnotherBusiness } from "@/lib/team/role-change-guard"

// Auth audit P1: User.role is a GLOBAL column, so changing it from business A also
// changes the user's privileges at business B. The guard refuses when the target
// belongs elsewhere. This locks its logic (mock the two scoped lookups).

const BIZ = "11111111-1111-4111-8111-111111111111"

function client(opts: { ownsOther?: boolean; staffElsewhere?: boolean }) {
  return {
    business: { findFirst: vi.fn(async () => (opts.ownsOther ? { id: "b2" } : null)) },
    staff: { findFirst: vi.fn(async () => (opts.staffElsewhere ? { id: "s2" } : null)) },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

describe("belongsToAnotherBusiness — cross-tenant role-change guard (auth audit P1)", () => {
  it("is false when the user belongs only to this business", async () => {
    expect(await belongsToAnotherBusiness("u1", BIZ, client({}))).toBe(false)
  })

  it("is true when the user OWNS another business", async () => {
    expect(await belongsToAnotherBusiness("u1", BIZ, client({ ownsOther: true }))).toBe(true)
  })

  it("is true when the user is active STAFF at another business", async () => {
    expect(await belongsToAnotherBusiness("u1", BIZ, client({ staffElsewhere: true }))).toBe(true)
  })

  it("scopes both lookups to EXCLUDE the current business", async () => {
    const c = client({})
    await belongsToAnotherBusiness("u1", BIZ, c)
    expect(c.business.findFirst.mock.calls[0][0].where).toMatchObject({ ownerId: "u1", id: { not: BIZ } })
    expect(c.staff.findFirst.mock.calls[0][0].where).toMatchObject({
      userId: "u1",
      isActive: true,
      deletedAt: null,
      primaryLocation: { businessId: { not: BIZ } },
    })
  })
})
