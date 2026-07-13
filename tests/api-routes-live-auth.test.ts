import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

// L-048 — every internal /api/* route that used bare auth() (raw 7-day JWT) must
// now go through getRouteBusinessContext and DENY (401) a caller whose live
// membership is gone or whose session predates the invalidation watermark:
//   /api/stripe/create-payment-intent  — financial mutation (mints a PaymentIntent)
//   /api/search                        — client names + emails
//   /api/notifications                 — appointments, payment amounts, reviews
//   /api/sidebar-data                  — counts + revenue (previously only zeroed)
//   /api/stripe/connect, /api/stripe/dashboard-link — Stripe account access
// The financial route must additionally make NO Stripe call and write NO rows
// on denial.

const { routeCtxMock, stripeMock, prismaMock, queriesMock } = vi.hoisted(() => ({
  routeCtxMock: vi.fn(),
  stripeMock: {
    createPaymentIntent: vi.fn(),
    getOrCreateCustomer: vi.fn(),
    createDashboardLink: vi.fn(),
    createConnectAccount: vi.fn(),
    stripe: { accountLinks: { create: vi.fn() } },
  },
  prismaMock: {
    business: { findFirst: vi.fn(), update: vi.fn() },
    appointment: { findMany: vi.fn(), findFirst: vi.fn() },
    payment: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    review: { findMany: vi.fn(), count: vi.fn() },
    staff: { findFirst: vi.fn() },
  },
  queriesMock: {
    getClients: vi.fn(),
    getServices: vi.fn(),
    getStaff: vi.fn(),
    getDashboardStats: vi.fn(),
    getLowStockProducts: vi.fn(),
  },
}))

vi.mock("@/lib/api/route-auth", () => ({ getRouteBusinessContext: routeCtxMock }))
vi.mock("@/lib/stripe", () => stripeMock)
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/lib/queries/clients", () => ({ getClients: queriesMock.getClients }))
vi.mock("@/lib/queries/services", () => ({ getServices: queriesMock.getServices }))
vi.mock("@/lib/queries/staff", () => ({ getStaff: queriesMock.getStaff }))
vi.mock("@/lib/queries/appointments", () => ({ getDashboardStats: queriesMock.getDashboardStats }))
vi.mock("@/lib/queries/products", () => ({ getLowStockProducts: queriesMock.getLowStockProducts }))

import { POST as createPaymentIntentPOST } from "@/app/api/stripe/create-payment-intent/route"
import { GET as searchGET } from "@/app/api/search/route"
import { GET as notificationsGET } from "@/app/api/notifications/route"
import { GET as sidebarDataGET } from "@/app/api/sidebar-data/route"
import { POST as stripeConnectPOST } from "@/app/api/stripe/connect/route"
import { POST as dashboardLinkPOST } from "@/app/api/stripe/dashboard-link/route"

const APPT = "22222222-2222-4222-8222-222222222222"
const BIZ = "11111111-1111-4111-8111-111111111111"

beforeEach(() => {
  vi.clearAllMocks()
  routeCtxMock.mockResolvedValue(null) // dead session: removed member or stale watermark
})

describe("L-048 — /api routes deny a non-live session with 401", () => {
  it("create-payment-intent: 401, no PaymentIntent minted, no payment row written", async () => {
    const res = await createPaymentIntentPOST(
      new NextRequest("http://localhost/api/stripe/create-payment-intent", {
        method: "POST",
        body: JSON.stringify({ appointmentId: APPT }),
      })
    )
    expect(res.status).toBe(401)
    expect(stripeMock.createPaymentIntent).not.toHaveBeenCalled()
    expect(prismaMock.payment.create).not.toHaveBeenCalled()
  })

  it("search: 401, no client/service/staff queries run", async () => {
    const res = await searchGET()
    expect(res.status).toBe(401)
    expect(queriesMock.getClients).not.toHaveBeenCalled()
    expect(queriesMock.getStaff).not.toHaveBeenCalled()
  })

  it("notifications: 401, no appointment/payment/review reads", async () => {
    const res = await notificationsGET()
    expect(res.status).toBe(401)
    expect(prismaMock.appointment.findMany).not.toHaveBeenCalled()
    expect(prismaMock.payment.findMany).not.toHaveBeenCalled()
  })

  it("sidebar-data: 401 (denies outright — previously only zeroed revenue)", async () => {
    const res = await sidebarDataGET()
    expect(res.status).toBe(401)
    expect(queriesMock.getDashboardStats).not.toHaveBeenCalled()
  })

  it("stripe/connect: 401, no Connect account or account link created", async () => {
    const res = await stripeConnectPOST(
      new NextRequest("http://localhost/api/stripe/connect", {
        method: "POST",
        body: JSON.stringify({ businessId: BIZ, businessName: "X", email: "x@x.com" }),
      })
    )
    expect(res.status).toBe(401)
    expect(stripeMock.createConnectAccount).not.toHaveBeenCalled()
    expect(stripeMock.stripe.accountLinks.create).not.toHaveBeenCalled()
  })

  it("stripe/dashboard-link: 401, no Express login link minted", async () => {
    const res = await dashboardLinkPOST()
    expect(res.status).toBe(401)
    expect(stripeMock.createDashboardLink).not.toHaveBeenCalled()
  })
})

describe("L-048 — a live member still gets through (no over-blocking)", () => {
  it("search returns data for a live staff member", async () => {
    routeCtxMock.mockResolvedValue({ userId: "u1", businessId: BIZ, role: "staff" })
    queriesMock.getClients.mockResolvedValue([{ id: "c1", name: "A", email: "a@x.com" }])
    queriesMock.getServices.mockResolvedValue([])
    queriesMock.getStaff.mockResolvedValue([])
    const res = await searchGET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.clients).toHaveLength(1)
    expect(queriesMock.getClients).toHaveBeenCalledWith(undefined, BIZ)
  })

  it("dashboard-link works for a live owner", async () => {
    routeCtxMock.mockResolvedValue({ userId: "u1", businessId: BIZ, role: "owner" })
    prismaMock.business.findFirst.mockResolvedValue({ stripeAccountId: "acct_1" })
    stripeMock.createDashboardLink.mockResolvedValue("https://stripe.example/login")
    const res = await dashboardLinkPOST()
    expect(res.status).toBe(200)
    // Account is resolved from the caller's own business (ownerId), never the body.
    expect(prismaMock.business.findFirst).toHaveBeenCalledWith({
      where: { ownerId: "u1", deletedAt: null },
      select: { stripeAccountId: true },
    })
  })
})
