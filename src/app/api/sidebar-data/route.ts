import { NextResponse } from "next/server"
import { getRouteBusinessContext } from "@/lib/api/route-auth"
import { hasRole } from "@/lib/permissions"
import { getDashboardStats } from "@/lib/queries/appointments"
import { getClients } from "@/lib/queries/clients"
import { getLowStockProducts } from "@/lib/queries/products"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    // L-048: previously this resolved the live role WITHOUT the session
    // watermark and only gated revenue instead of denying — a removed member or
    // stale post-reset session still read appointment/client/review counts. The
    // shared helper enforces liveness + watermark and we DENY on null.
    const ctx = await getRouteBusinessContext()
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const { userId, businessId, role: liveRole } = ctx
    // Shop revenue stays admin-only (mirrors the dashboard page, which zeroes
    // revenue for non-admins) — a demoted admin loses todayRevenue immediately (L-044).
    const canSeeRevenue = hasRole(liveRole, "admin")

    const [dashboardStats, clients, lowStockProducts, pendingReviewsCount] =
      await Promise.all([
        getDashboardStats(businessId),
        getClients(undefined, businessId),
        getLowStockProducts(businessId),
        prisma.review.count({ where: { businessId, response: null } }),
      ])

    // Look up staff profile ID for non-admin members (for the "My Profile" link)
    let staffProfileId: string | null = null
    if (liveRole === "staff" && userId && businessId) {
      const staffProfile = await prisma.staff.findFirst({
        where: { userId, primaryLocation: { businessId }, isActive: true },
        select: { id: true },
      })
      staffProfileId = staffProfile?.id ?? null
    }

    return NextResponse.json({
      todayAppointments: dashboardStats.todayAppointments,
      clientsCount: clients.length,
      lowStockCount: lowStockProducts.length,
      pendingReviewsCount,
      staffProfileId,
      dashboardStats: {
        todayRevenue: canSeeRevenue ? dashboardStats.todayRevenue : 0,
        todayAppointments: dashboardStats.todayAppointments,
        completedAppointments: dashboardStats.completedAppointments,
        upcomingAppointments: dashboardStats.upcomingAppointments,
      },
    })
  } catch (e) {
    console.error("GET /api/sidebar-data error:", e)
    // Signal a real failure instead of returning zeros: fake zeros are
    // indistinguishable from a genuinely-empty shop and hide outages. The client
    // renders sidebar counters as "unavailable" on a non-200 rather than "0".
    return NextResponse.json({ error: "Failed to load sidebar data" }, { status: 500 })
  }
}
