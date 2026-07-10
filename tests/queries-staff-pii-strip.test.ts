import { describe, it, expect, vi, beforeEach } from "vitest"

// L-044 — getStaff() returned every colleague's commission + email + phone to ANY
// caller, and staff-accessible pages (/calendar, /services, /booking, search)
// forward the array to the browser. getStaff is now SECURE BY DEFAULT: pay + PII
// are stripped unless the caller passes an admin+ viewerRole.

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }))
vi.mock("@/lib/prisma", () => ({ prisma: { staff: { findMany } } }))

import { getStaff } from "@/lib/queries/staff"

const ROW = {
  id: "s1",
  isActive: true,
  commissionRate: 45,
  color: "#111111",
  user: {
    firstName: "Bob",
    lastName: "Barber",
    email: "bob@shop.com",
    phone: "+15551234",
    avatarUrl: null,
    role: "staff",
  },
  staffServices: [{ serviceId: "svc1" }],
  staffSchedules: [],
}

beforeEach(() => {
  findMany.mockReset()
  findMany.mockResolvedValue([ROW])
})

describe("getStaff — strips pay/PII for non-admin callers (L-044)", () => {
  it("no viewerRole (default) → commission 0, email/phone blank", async () => {
    const [s] = await getStaff("biz")
    expect(s.commission).toBe(0)
    expect(s.email).toBe("")
    expect(s.phone).toBe("")
    // Non-sensitive fields still flow (calendar/services need these).
    expect(s.name).toBe("Bob Barber")
    expect(s.services).toEqual(["svc1"])
    expect(s.color).toBe("#111111")
  })

  it("viewerRole 'staff' → still stripped (a staff caller can't see colleagues' pay)", async () => {
    const [s] = await getStaff("biz", "staff")
    expect(s.commission).toBe(0)
    expect(s.email).toBe("")
    expect(s.phone).toBe("")
  })

  it("viewerRole null (revoked) → stripped (fail-closed)", async () => {
    const [s] = await getStaff("biz", null)
    expect(s.commission).toBe(0)
    expect(s.email).toBe("")
  })

  it("viewerRole 'admin' → full commission + contact PII", async () => {
    const [s] = await getStaff("biz", "admin")
    expect(s.commission).toBe(45)
    expect(s.email).toBe("bob@shop.com")
    expect(s.phone).toBe("+15551234")
  })

  it("viewerRole 'owner' → full commission + contact PII", async () => {
    const [s] = await getStaff("biz", "owner")
    expect(s.commission).toBe(45)
    expect(s.email).toBe("bob@shop.com")
    expect(s.phone).toBe("+15551234")
  })
})
