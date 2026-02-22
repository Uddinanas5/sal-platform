import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getClients } from "@/lib/queries/clients"
import { getServices } from "@/lib/queries/services"
import { getStaff } from "@/lib/queries/staff"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const session = await auth()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const businessId = (session?.user as any)?.businessId as string | undefined

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
