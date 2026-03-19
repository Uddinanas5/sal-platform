import { auth } from "@/lib/auth"
import { getServices } from "@/lib/queries/services"
import { getProducts } from "@/lib/queries/products"
import { getClients } from "@/lib/queries/clients"
import { prisma } from "@/lib/prisma"
import CheckoutClient from "./client"

export const dynamic = "force-dynamic"

export default async function CheckoutPage() {
  const session = await auth()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const businessId = (session?.user as any)?.businessId as string | undefined

  const [services, products, clients, business] = await Promise.all([
    getServices(businessId),
    getProducts(businessId),
    getClients(undefined, businessId),
    businessId
      ? prisma.business.findUnique({
          where: { id: businessId },
          select: {
            name: true,
            phone: true,
            locations: {
              where: { isPrimary: true, isActive: true },
              select: {
                addressLine1: true,
                addressLine2: true,
                city: true,
                state: true,
                phone: true,
              },
              take: 1,
            },
          },
        })
      : Promise.resolve(null),
  ])

  // Derive product categories from actual products
  const categories = Array.from(new Set(products.map((p) => p.category)))

  const primaryLocation = business?.locations?.[0]
  const businessAddress = primaryLocation
    ? [
        primaryLocation.addressLine1,
        primaryLocation.addressLine2,
        primaryLocation.city,
        primaryLocation.state,
      ]
        .filter(Boolean)
        .join(", ")
    : undefined
  const businessPhone =
    primaryLocation?.phone ?? business?.phone ?? undefined

  return (
    <CheckoutClient
      services={services}
      products={products}
      clients={clients}
      productCategories={categories}
      businessName={business?.name}
      businessAddress={businessAddress}
      businessPhone={businessPhone}
    />
  )
}
