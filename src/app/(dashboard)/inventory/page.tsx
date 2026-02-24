import { auth } from "@/lib/auth"
import { getProducts } from "@/lib/queries/products"
import { InventoryClient } from "./client"

export const dynamic = "force-dynamic"
export default async function InventoryPage() {
  const session = await auth()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const businessId = (session?.user as any)?.businessId as string | undefined

  const products = await getProducts(businessId)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const categories = Array.from(new Set(products.map((p: any) => p.category))) as string[]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <InventoryClient initialProducts={products as any} categories={categories} />
}
