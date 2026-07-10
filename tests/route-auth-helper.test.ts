import { describe, it, expect, beforeEach, vi } from "vitest"

// L-048 — shared auth helper for internal /api/* route handlers. These routes sat
// outside the (dashboard) layout and trusted the raw 7-day JWT: no live-role
// re-check (L-036 class) and no session-invalidation watermark (L-034 class).
// getRouteBusinessContext is the getBusinessContext equivalent that returns null
// (for a 401) instead of throwing; getLiveUserId is the pre-business variant for
// the onboarding actions.

const { authMock, resolveRoleMock, prismaMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  resolveRoleMock: vi.fn(),
  prismaMock: { user: { findUnique: vi.fn() } },
}))

vi.mock("@/lib/auth", () => ({ auth: authMock }))
vi.mock("@/lib/auth-utils", () => ({ resolveBusinessRole: resolveRoleMock }))
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))

import { getRouteBusinessContext, getLiveUserId } from "@/lib/api/route-auth"

beforeEach(() => {
  vi.clearAllMocks()
})

describe("getRouteBusinessContext (L-048)", () => {
  it("returns the live context for a valid session", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", businessId: "b1" }, loginAt: 1000 })
    resolveRoleMock.mockResolvedValue("admin")
    expect(await getRouteBusinessContext()).toEqual({ userId: "u1", businessId: "b1", role: "admin" })
  })

  it("ALWAYS forwards the session watermark to resolveBusinessRole — the sidebar-data bug was calling it without opts, silently skipping the L-034 check", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", businessId: "b1" }, loginAt: 1234 })
    resolveRoleMock.mockResolvedValue("staff")
    await getRouteBusinessContext()
    expect(resolveRoleMock).toHaveBeenCalledWith("u1", "b1", { sessionLoginAt: 1234 })
  })

  it("forwards sessionLoginAt: null (not undefined) for a legacy token with no loginAt, so a set watermark fails CLOSED", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", businessId: "b1" } })
    resolveRoleMock.mockResolvedValue("staff")
    await getRouteBusinessContext()
    expect(resolveRoleMock).toHaveBeenCalledWith("u1", "b1", { sessionLoginAt: null })
  })

  it("returns null when there is no session", async () => {
    authMock.mockResolvedValue(null)
    expect(await getRouteBusinessContext()).toBeNull()
    expect(resolveRoleMock).not.toHaveBeenCalled()
  })

  it("returns null when the session has no businessId", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } })
    expect(await getRouteBusinessContext()).toBeNull()
  })

  it("returns null when the live role resolves to null (removed member / stale session)", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", businessId: "b1" }, loginAt: 1000 })
    resolveRoleMock.mockResolvedValue(null)
    expect(await getRouteBusinessContext()).toBeNull()
  })
})

describe("getLiveUserId (L-048 — onboarding actions, pre-business)", () => {
  it("returns the userId for an active user with no watermark", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" }, loginAt: 1000 })
    prismaMock.user.findUnique.mockResolvedValue({ status: "active", sessionsValidAfter: null })
    expect(await getLiveUserId()).toBe("u1")
  })

  it("returns null with no session", async () => {
    authMock.mockResolvedValue(null)
    expect(await getLiveUserId()).toBeNull()
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
  })

  it("returns null for a suspended account (live status check, not the JWT)", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" }, loginAt: 1000 })
    prismaMock.user.findUnique.mockResolvedValue({ status: "suspended", sessionsValidAfter: null })
    expect(await getLiveUserId()).toBeNull()
  })

  it("returns null for a deleted user row", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" }, loginAt: 1000 })
    prismaMock.user.findUnique.mockResolvedValue(null)
    expect(await getLiveUserId()).toBeNull()
  })

  it("returns null for a session issued BEFORE the invalidation watermark (post-reset stolen session dies)", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" }, loginAt: 1000 })
    prismaMock.user.findUnique.mockResolvedValue({ status: "active", sessionsValidAfter: new Date(2000) })
    expect(await getLiveUserId()).toBeNull()
  })

  it("accepts a session issued AFTER the watermark", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" }, loginAt: 3000 })
    prismaMock.user.findUnique.mockResolvedValue({ status: "active", sessionsValidAfter: new Date(2000) })
    expect(await getLiveUserId()).toBe("u1")
  })

  it("fails CLOSED for a legacy token with no loginAt once a watermark exists", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } })
    prismaMock.user.findUnique.mockResolvedValue({ status: "active", sessionsValidAfter: new Date(2000) })
    expect(await getLiveUserId()).toBeNull()
  })
})
