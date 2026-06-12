import { describe, it, expect, beforeEach, vi } from "vitest"

// SESSION-EXPIRY — an expired/absent session must be DENIED at the door, with
// ZERO database mutation. The contract under test (clients.ts):
//
//   getBusinessContext() (src/lib/auth-utils.ts) throws "Not authenticated"
//   whenever auth() returns no session.user. A mutating server action calls it
//   BEFORE touching prisma, so an unauthenticated caller can never reach a
//   .create()/.update() write. createClient/updateClient explicitly surface
//   this as { success:false, error:"Not authenticated" }.
//
// This negative test proves the gate is real: if a future refactor moved the
// write ahead of (or dropped) the auth check, prisma.client.create/update WOULD
// be called and these assertions would FAIL. It is not a trivial pass.

// ---------------------------------------------------------------------------
// Hoisted mocks. vi.mock factories hoist above imports, so any symbol they
// reference must be created inside vi.hoisted (pattern copied from
// tests/group-a-tenant-authz.test.ts).
// ---------------------------------------------------------------------------
const { prismaMock, getBusinessContextMock } = vi.hoisted(() => {
  const prismaMock = {
    client: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  }
  return { prismaMock, getBusinessContextMock: vi.fn() }
})

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
// Mock ONLY what clients.ts imports from auth-utils: getBusinessContext. An
// expired/absent session means getBusinessContext rejects with the exact error
// the real implementation throws when auth() returns null (auth-utils.ts:12).
vi.mock("@/lib/auth-utils", () => ({
  getBusinessContext: getBusinessContextMock,
}))

import { createClient, updateClient } from "@/lib/actions/clients"

// Valid v4 UUIDs (version "4" nibble + variant "8/9/a/b" nibble — Zod .uuid()).
const CLIENT_ID = "33333333-3333-4333-8333-333333333333"

beforeEach(() => {
  vi.clearAllMocks()
  // Default: NO valid session. getBusinessContext throws exactly as the real
  // one does when auth() -> null (auth-utils.ts: `throw new Error("Not authenticated")`).
  getBusinessContextMock.mockRejectedValue(new Error("Not authenticated"))
})

describe("session-expiry — unauthenticated mutations are denied with no DB write", () => {
  it("createClient: expired/absent session -> {success:false,'Not authenticated'} and NO prisma write", async () => {
    const res = await createClient({ firstName: "Mallory", lastName: "Unauth" })

    // Denied with the auth error, not a generic failure.
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toBe("Not authenticated")

    // The gate ran BEFORE any DB access: no read, no create. An unauthenticated
    // caller reached zero database rows.
    expect(getBusinessContextMock).toHaveBeenCalledTimes(1)
    expect(prismaMock.client.findFirst).not.toHaveBeenCalled()
    expect(prismaMock.client.create).not.toHaveBeenCalled()
  })

  it("updateClient: expired/absent session -> {success:false,'Not authenticated'} and NO prisma write", async () => {
    const res = await updateClient(CLIENT_ID, { firstName: "Mallory" })

    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toBe("Not authenticated")

    expect(getBusinessContextMock).toHaveBeenCalledTimes(1)
    expect(prismaMock.client.findFirst).not.toHaveBeenCalled()
    expect(prismaMock.client.update).not.toHaveBeenCalled()
  })

  it("FAILS-WITHOUT / PASSES-WITH: a VALID session reaches the create write (proves the gate, not a no-op)", async () => {
    // Flip the gate to authenticated. Now the SAME action must proceed to the
    // DB write. This asserts the test isn't passing merely because createClient
    // never writes — it writes once auth succeeds.
    const BIZ = "11111111-1111-4111-8111-111111111111"
    const USER = "55555555-5555-4555-8555-555555555555"
    getBusinessContextMock.mockResolvedValue({ businessId: BIZ, userId: USER, role: "admin" })
    prismaMock.client.findFirst.mockResolvedValue(null)
    prismaMock.client.create.mockResolvedValue({ id: CLIENT_ID })

    const res = await createClient({ firstName: "Real", lastName: "User" })

    expect(res.success).toBe(true)
    // The write happened, scoped to the SESSION businessId (never caller input).
    expect(prismaMock.client.create).toHaveBeenCalledTimes(1)
    const createArg = prismaMock.client.create.mock.calls[0][0] as unknown as {
      data: { businessId: string }
    }
    expect(createArg.data.businessId).toBe(BIZ)
  })
})
