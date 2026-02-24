import { auth } from "@/lib/auth"
import { getServices } from "@/lib/queries/services"
import { getProducts } from "@/lib/queries/products"
import { getClients } from "@/lib/queries/clients"
import CheckoutClient from "./client"

export const dynamic = "force-dynamic"

export default async function CheckoutPage() {
  const session = await auth()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const businessId = (session?.user as any)?.businessId as string | undefined

  const [services, products, clients] = await Promise.all([
    getServices(businessId),
    getProducts(businessId),
    getClients(undefined, businessId),
  ])

  // Derive product categories from actual products
  const categories = Array.from(new Set(products.map((p) => p.category)))

  return (
    <CheckoutClient
      services={services}
      products={products}
      clients={clients}
      productCategories={categories}
    />
  )
}
