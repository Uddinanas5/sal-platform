import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
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

    const businessFilter = businessId ? { businessId } : {}

    const [dashboardStats, clients, lowStockProducts, pendingReviewsCount] =
      await Promise.all([
        getDashboardStats(businessId),
        getClients(undefined, businessId),
        getLowStockProducts(businessId),
        prisma.review.count({ where: { ...businessFilter, response: null } }),
      ])

    return NextResponse.json({
      todayAppointments: dashboardStats.todayAppointments,
      clientsCount: clients.length,
      lowStockCount: lowStockProducts.length,
      pendingReviewsCount,
      dashboardStats: {
        todayRevenue: dashboardStats.todayRevenue,
        todayAppointments: dashboardStats.todayAppointments,
        completedAppointments: dashboardStats.completedAppointments,
        upcomingAppointments: dashboardStats.upcomingAppointments,
      },
    })
  } catch (e) {
    console.error("GET /api/sidebar-data error:", e)
    // Return fallback zeros so the UI still renders
    return NextResponse.json({
      todayAppointments: 0,
      clientsCount: 0,
      lowStockCount: 0,
      pendingReviewsCount: 0,
      dashboardStats: {
        todayRevenue: 0,
        todayAppointments: 0,
        completedAppointments: 0,
        upcomingAppointments: 0,
      },
    })
  }
}
