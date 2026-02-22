import { auth } from "@/lib/auth"
import { getServices } from "@/lib/queries/services"
import { getProducts } from "@/lib/queries/products"
import { getClients } from "@/lib/queries/clients"
import { mockServices, mockClients } from "@/data/mock-data"
import { mockProducts, productCategories } from "@/data/mock-products"
import CheckoutClient from "./client"

export const dynamic = "force-dynamic"

export default async function CheckoutPage() {
  const session = await auth()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const businessId = (session?.user as any)?.businessId as string | undefined

  let services
  let products
  let clients

  try {
    services = await getServices(businessId)
  } catch {
    services = mockServices
  }

  try {
    products = await getProducts(businessId)
  } catch {
    products = mockProducts
  }

  try {
    clients = await getClients(undefined, businessId)
  } catch {
    clients = mockClients.map((c) => ({
      ...c,
      totalVisits: c.totalVisits,
      totalSpent: c.totalSpent,
      lastVisit: c.lastVisit,
      createdAt: c.createdAt,
      tags: c.tags || [],
      loyaltyPoints: c.loyaltyPoints || 0,
      walletBalance: c.walletBalance || 0,
    }))
  }

  // Derive product categories from actual products
  const categories = Array.from(new Set(products.map((p) => p.category)))

  return (
    <CheckoutClient
      services={services}
      products={products}
      clients={clients}
      productCategories={categories.length > 0 ? categories : productCategories}
    />
  )
}
