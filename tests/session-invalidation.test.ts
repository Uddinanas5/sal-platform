import { describe, it, expect, vi, beforeEach } from "vitest"
import { isSessionWatermarkStale } from "@/lib/permissions"

// L-034 — server-side session invalidation. A JWT/session carries a stable `loginAt`
// (set once at sign-in); User.sessionsValidAfter is stamped on password reset /
// "log out everywhere". A session whose loginAt predates the watermark is rejected,
// so a stolen 7-day token dies immediately instead of surviving the reset.

const { prismaMock, authMock } = vi.hoisted(() => ({
  prismaMock: {
    user: { findUnique: vi.fn() },
    business: { findFirst: vi.fn() },
    staff: { findFirst: vi.fn() },
  },
  authMock: vi.fn(),
}))
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/lib/auth", () => ({ auth: authMock }))

import { resolveBusinessRole, getBusinessContext } from "@/lib/auth-utils"

const USER = "u1"
const BIZ = "b1"

beforeEach(() => vi.clearAllMocks())

describe("isSessionWatermarkStale — pure predicate (L-034)", () => {
  const t0 = 1_700_000_000_000
  it("no watermark → NOT stale", () => {
    expect(isSessionWatermarkStale(t0, null)).toBe(false)
    expect(isSessionWatermarkStale(t0, undefined)).toBe(false)
  })
  it("session issued BEFORE the watermark → stale", () => {
    expect(isSessionWatermarkStale(t0, new Date(t0 + 1000))).toBe(true)
  })
  it("session issued AFTER the watermark → NOT stale", () => {
    expect(isSessionWatermarkStale(t0, new Date(t0 - 1000))).toBe(false)
  })
  it("session issued EXACTLY at the watermark → NOT stale (boundary)", () => {
    expect(isSessionWatermarkStale(t0, new Date(t0))).toBe(false)
  })
  it("legacy token (no login time) WITH a watermark set → stale (fail closed)", () => {
    expect(isSessionWatermarkStale(null, new Date(t0))).toBe(true)
    expect(isSessionWatermarkStale(undefined, new Date(t0))).toBe(true)
  })
  it("legacy token (no login time) with NO watermark → NOT stale (nothing to enforce)", () => {
    expect(isSessionWatermarkStale(null, null)).toBe(false)
    expect(isSessionWatermarkStale(undefined, undefined)).toBe(false)
  })
})

describe("resolveBusinessRole — honours the session watermark (L-034)", () => {
  beforeEach(() => {
    prismaMock.business.findFirst.mockResolvedValue({ id: BIZ }) // active owner
    prismaMock.staff.findFirst.mockResolvedValue(null)
  })

  it("DENIES a session issued before the watermark", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: "owner", status: "active", sessionsValidAfter: new Date(2000) })
    expect(await resolveBusinessRole(USER, BIZ, { sessionLoginAt: 1000 })).toBeNull()
  })

  it("ALLOWS a session issued after the watermark", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: "owner", status: "active", sessionsValidAfter: new Date(2000) })
    expect(await resolveBusinessRole(USER, BIZ, { sessionLoginAt: 3000 })).toBe("owner")
  })

  it("ALLOWS when the user has no watermark", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: "owner", status: "active", sessionsValidAfter: null })
    expect(await resolveBusinessRole(USER, BIZ, { sessionLoginAt: 1000 })).toBe("owner")
  })

  it("does NOT enforce the watermark for a NON-session caller (no opts) — API keys are exempt", async () => {
    // API-key liveness check (L-047) calls resolveBusinessRole with no opts; even a
    // far-future watermark must NOT deny it — API keys have their own revocation.
    prismaMock.user.findUnique.mockResolvedValue({ role: "owner", status: "active", sessionsValidAfter: new Date(9_999_999_999_999) })
    expect(await resolveBusinessRole(USER, BIZ)).toBe("owner")
  })

  it("DENIES a session caller with a legacy token (opts present, no loginAt) when a watermark is set", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: "owner", status: "active", sessionsValidAfter: new Date(2000) })
    expect(await resolveBusinessRole(USER, BIZ, { sessionLoginAt: undefined })).toBeNull()
  })
})

describe("getBusinessContext — rejects a stale session end-to-end (L-034)", () => {
  beforeEach(() => {
    prismaMock.business.findFirst.mockResolvedValue({ id: BIZ })
    prismaMock.staff.findFirst.mockResolvedValue(null)
    prismaMock.user.findUnique.mockResolvedValue({ role: "owner", status: "active", sessionsValidAfter: new Date(2000) })
  })

  it("throws for a session issued BEFORE the watermark", async () => {
    authMock.mockResolvedValue({ user: { id: USER, businessId: BIZ }, loginAt: 1000 })
    await expect(getBusinessContext()).rejects.toThrow("No business context")
  })

  it("succeeds for a session issued AFTER the watermark", async () => {
    authMock.mockResolvedValue({ user: { id: USER, businessId: BIZ }, loginAt: 3000 })
    expect(await getBusinessContext()).toEqual({ userId: USER, businessId: BIZ, role: "owner" })
  })
})
