import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { resolveBusinessRole } from "@/lib/auth-utils"
import { hasRole } from "@/lib/permissions"
import { getDashboardStats } from "@/lib/queries/appointments"
import { getClients } from "@/lib/queries/clients"
import { getLowStockProducts } from "@/lib/queries/products"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const session = await auth()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const businessId = (session?.user as any)?.businessId as string | undefined

    if (!businessId) {
      return NextResponse.json({
        todayAppointments: 0,
        clientsCount: 0,
        lowStockCount: 0,
        pendingReviewsCount: 0,
        staffProfileId: null,
        dashboardStats: {
          todayRevenue: 0,
          todayAppointments: 0,
          completedAppointments: 0,
          upcomingAppointments: 0,
        },
      })
    }

    const userId = session?.user?.id as string | undefined
    // LIVE role, not the stale JWT — shop revenue is admin-only (mirrors the
    // dashboard page, which zeroes revenue for non-admins). A demoted admin must
    // stop seeing todayRevenue in the sidebar immediately (L-044).
    const liveRole = userId ? await resolveBusinessRole(userId, businessId) : null
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
