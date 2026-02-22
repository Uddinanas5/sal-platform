import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getLowStockProducts } from "@/lib/queries/products"
import { subHours } from "date-fns"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const session = await auth()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const businessId = (session?.user as any)?.businessId as string | undefined
    const businessFilter = businessId ? { businessId } : {}

    const since = subHours(new Date(), 24)

    const [recentAppointments, recentPayments, recentReviews, lowStock] =
      await Promise.all([
        // Recent bookings and cancellations
        prisma.appointment.findMany({
          where: {
            ...businessFilter,
            OR: [
              { createdAt: { gte: since } },
              { status: "cancelled", updatedAt: { gte: since } },
            ],
          },
          include: {
            client: true,
            services: { include: { service: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 5,
        }),
        // Recent payments
        prisma.payment.findMany({
          where: {
            ...businessFilter,
            status: "completed",
            createdAt: { gte: since },
          },
          include: {
            appointment: { include: { client: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 3,
        }),
        // Recent reviews
        prisma.review.findMany({
          where: { ...businessFilter, createdAt: { gte: since } },
          include: { client: true },
          orderBy: { createdAt: "desc" },
          take: 3,
        }),
        // Low stock products (uses JS filtering)
        getLowStockProducts(businessId),
      ])

    interface NotificationItem {
      id: string
      type: "booking" | "payment" | "review" | "cancellation" | "inventory"
      title: string
      description: string
      time: string
      read: boolean
    }

    const notifications: NotificationItem[] = []

    // Map appointments to notifications
    for (const appt of recentAppointments) {
      const clientName = appt.client
        ? `${appt.client.firstName} ${appt.client.lastName}`
        : "Walk-in"
      const serviceName = appt.services[0]?.name || "Appointment"

      if (appt.status === "cancelled") {
        notifications.push({
          id: `cancel-${appt.id}`,
          type: "cancellation",
          title: "Appointment cancelled",
          description: `${clientName} cancelled their appointment`,
          time: appt.updatedAt.toISOString(),
          read: false,
        })
      } else {
        notifications.push({
          id: `booking-${appt.id}`,
          type: "booking",
          title: "New booking",
          description: `${clientName} - ${serviceName}`,
          time: appt.createdAt.toISOString(),
          read: false,
        })
      }
    }

    // Map payments to notifications
    for (const payment of recentPayments) {
      const clientName = payment.appointment?.client
        ? `${payment.appointment.client.firstName} ${payment.appointment.client.lastName}`
        : "Client"
      notifications.push({
        id: `payment-${payment.id}`,
        type: "payment",
        title: "Payment received",
        description: `$${Number(payment.totalAmount).toFixed(2)} from ${clientName}`,
        time: payment.createdAt.toISOString(),
        read: false,
      })
    }

    // Map reviews to notifications
    for (const review of recentReviews) {
      const clientName = `${review.client.firstName} ${review.client.lastName}`
      notifications.push({
        id: `review-${review.id}`,
        type: "review",
        title: "Review received",
        description: `${review.overallRating}\u2605 from ${clientName}`,
        time: review.createdAt.toISOString(),
        read: false,
      })
    }

    // Map low stock to notifications (up to 3)
    for (const product of lowStock.slice(0, 3)) {
      notifications.push({
        id: `inventory-${product.id}`,
        type: "inventory",
        title: "Low stock alert",
        description: `${product.name} (${product.stockLevel} remaining)`,
        time: new Date().toISOString(),
        read: true,
      })
    }

    // Sort by time descending
    notifications.sort(
      (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
    )

    return NextResponse.json({ notifications: notifications.slice(0, 10) })
  } catch (e) {
    console.error("GET /api/notifications error:", e)
    // Return empty notifications so the UI still renders
    return NextResponse.json({ notifications: [] })
  }
}
