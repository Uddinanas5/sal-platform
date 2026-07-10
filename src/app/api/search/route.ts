import { NextResponse } from "next/server"
import { getRouteBusinessContext } from "@/lib/api/route-auth"
import { getClients } from "@/lib/queries/clients"
import { getServices } from "@/lib/queries/services"
import { getStaff } from "@/lib/queries/staff"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    // L-048: search returns client names+emails — require a LIVE member (fresh
    // role + session watermark), not just a 7-day JWT that once said so.
    const ctx = await getRouteBusinessContext()
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const { businessId } = ctx

    const [clients, services, staff] = await Promise.all([
      getClients(undefined, businessId),
      getServices(businessId),
      getStaff(businessId),
    ])

    return NextResponse.json({
      clients: clients.map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
      })),
      services: services.map((s) => ({
        id: s.id,
        name: s.name,
        price: s.price,
        category: s.category,
      })),
      staff: staff.map((s) => ({
        id: s.id,
        name: s.name,
        role: s.role,
      })),
    })
  } catch (e) {
    console.error("GET /api/search error:", e)
    return NextResponse.json({
      clients: [],
      services: [],
      staff: [],
    })
  }
}
