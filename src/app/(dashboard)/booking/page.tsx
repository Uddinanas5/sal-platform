import { getServices } from "@/lib/queries/services"
import { getStaff } from "@/lib/queries/staff"
import { getBusinessContext } from "@/lib/auth-utils"
import { prisma } from "@/lib/prisma"
import { BookingClient } from "./client"

export const dynamic = "force-dynamic"
export default async function BookingPage() {
  const { businessId } = await getBusinessContext()
  const [services, staff, business] = await Promise.all([
    getServices(businessId),
    getStaff(businessId),
    prisma.business.findUnique({
      where: { id: businessId },
      select: { slug: true },
    }),
  ])

  return (
    <BookingClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      services={services as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      staff={staff as any}
      businessSlug={business?.slug ?? ""}
    />
  )
}
