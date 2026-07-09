import { describe, it, expect, vi, beforeEach } from "vitest"

// L-044 — GET /api/sidebar-data returned today's shop revenue to ANY authenticated
// member with no role check, contradicting the dashboard page (which zeroes revenue
// for non-admins). Revenue is now gated on the LIVE admin role: staff/revoked → 0,
// admin/owner → real figure.

const { authMock, resolveRoleMock, statsMock, clientsMock, lowStockMock, prismaMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  resolveRoleMock: vi.fn(),
  statsMock: vi.fn(),
  clientsMock: vi.fn(),
  lowStockMock: vi.fn(),
  prismaMock: { review: { count: vi.fn() }, staff: { findFirst: vi.fn() } },
}))

vi.mock("@/lib/auth", () => ({ auth: authMock }))
vi.mock("@/lib/auth-utils", () => ({ resolveBusinessRole: resolveRoleMock }))
vi.mock("@/lib/queries/appointments", () => ({ getDashboardStats: statsMock }))
vi.mock("@/lib/queries/clients", () => ({ getClients: clientsMock }))
vi.mock("@/lib/queries/products", () => ({ getLowStockProducts: lowStockMock }))
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))

import { GET } from "@/app/api/sidebar-data/route"

beforeEach(() => {
  vi.clearAllMocks()
  authMock.mockResolvedValue({ user: { id: "u1", businessId: "b1" } })
  statsMock.mockResolvedValue({ todayRevenue: 1234, todayAppointments: 5, completedAppointments: 2, upcomingAppointments: 3 })
  clientsMock.mockResolvedValue([])
  lowStockMock.mockResolvedValue([])
  prismaMock.review.count.mockResolvedValue(0)
  prismaMock.staff.findFirst.mockResolvedValue({ id: "sp1" })
})

describe("GET /api/sidebar-data — shop revenue gated on the live admin role (L-044)", () => {
  it("zeroes todayRevenue for a live staff member (non-revenue counts still flow)", async () => {
    resolveRoleMock.mockResolvedValue("staff")
    const res = await GET()
    const body = await res.json()
    expect(body.dashboardStats.todayRevenue).toBe(0)
    expect(body.dashboardStats.todayAppointments).toBe(5)
    expect(body.todayAppointments).toBe(5)
  })

  it("zeroes todayRevenue for a revoked (null) member", async () => {
    resolveRoleMock.mockResolvedValue(null)
    const res = await GET()
    const body = await res.json()
    expect(body.dashboardStats.todayRevenue).toBe(0)
  })

  it("returns the real todayRevenue for an admin", async () => {
    resolveRoleMock.mockResolvedValue("admin")
    const res = await GET()
    const body = await res.json()
    expect(body.dashboardStats.todayRevenue).toBe(1234)
  })

  it("returns the real todayRevenue for an owner", async () => {
    resolveRoleMock.mockResolvedValue("owner")
    const res = await GET()
    const body = await res.json()
    expect(body.dashboardStats.todayRevenue).toBe(1234)
  })
})
