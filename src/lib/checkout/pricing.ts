import { TAX_RATE } from "@/lib/utils"

export type CheckoutItemInput = {
  type: "service" | "product" | "custom"
  id: string
  name?: string
  price?: number
  quantity: number
}

export type CheckoutTotals = {
  subtotal: number
  discount: number
  tax: number
  tip: number
  total: number
}

type PricingClient = {
  service: {
    findMany: (args: {
      where: { id: { in: string[] }; businessId: string; isActive: true; deletedAt: null }
      select: {
        id: true
        name: true
        price: true
        taxRate: true
        isTaxable: true
      }
    }) => Promise<Array<{ id: string; name: string; price: unknown; taxRate: unknown; isTaxable: boolean }>>
  }
  product: {
    findMany: (args: {
      where: { id: { in: string[] }; businessId: string; isActive: true; deletedAt: null }
      select: {
        id: true
        name: true
        retailPrice: true
        taxRate: true
        isTaxable: true
      }
    }) => Promise<Array<{ id: string; name: string; retailPrice: unknown; taxRate: unknown; isTaxable: boolean }>>
  }
}

function cents(amount: number) {
  return Math.round((amount + Number.EPSILON) * 100) / 100
}

function taxRateFor(isTaxable: boolean, taxRate: unknown) {
  if (!isTaxable) return 0
  if (taxRate == null) return TAX_RATE
  return Number(taxRate) / 100
}

export async function calculateCheckoutTotals(
  db: PricingClient,
  businessId: string,
  items: CheckoutItemInput[],
  input: { discount: number; tip: number }
): Promise<CheckoutTotals> {
  if (items.length === 0) {
    throw new Error("Cart is empty")
  }

  const serviceIds = Array.from(new Set(items.filter((item) => item.type === "service").map((item) => item.id)))
  const productIds = Array.from(new Set(items.filter((item) => item.type === "product").map((item) => item.id)))

  const [services, products] = await Promise.all([
    serviceIds.length
      ? db.service.findMany({
          where: { id: { in: serviceIds }, businessId, isActive: true, deletedAt: null },
          select: { id: true, name: true, price: true, taxRate: true, isTaxable: true },
        })
      : Promise.resolve([]),
    productIds.length
      ? db.product.findMany({
          where: { id: { in: productIds }, businessId, isActive: true, deletedAt: null },
          select: { id: true, name: true, retailPrice: true, taxRate: true, isTaxable: true },
        })
      : Promise.resolve([]),
  ])

  const servicesById = new Map(services.map((service) => [service.id, service]))
  const productsById = new Map(products.map((product) => [product.id, product]))

  const lines = items.map((item) => {
    if (item.type === "service") {
      const service = servicesById.get(item.id)
      if (!service) throw new Error("Service not found")
      return {
        amount: cents(Number(service.price) * item.quantity),
        taxRate: taxRateFor(service.isTaxable, service.taxRate),
      }
    }

    if (item.type === "product") {
      const product = productsById.get(item.id)
      if (!product) throw new Error("Product not found")
      return {
        amount: cents(Number(product.retailPrice) * item.quantity),
        taxRate: taxRateFor(product.isTaxable, product.taxRate),
      }
    }

    const customPrice = item.price ?? 0
    if (!item.name?.trim()) throw new Error("Custom sale name is required")
    if (customPrice <= 0) throw new Error("Custom sale price must be greater than zero")
    return {
      amount: cents(customPrice * item.quantity),
      taxRate: TAX_RATE,
    }
  })

  const subtotal = cents(lines.reduce((sum, line) => sum + line.amount, 0))
  const discount = cents(Math.min(input.discount, subtotal))
  const tip = cents(input.tip)
  const taxableBase = Math.max(0, subtotal - discount)

  const tax = cents(
    lines.reduce((sum, line) => {
      const lineShare = subtotal > 0 ? line.amount / subtotal : 0
      const discountedLineAmount = taxableBase * lineShare
      return sum + discountedLineAmount * line.taxRate
    }, 0)
  )

  return {
    subtotal,
    discount,
    tax,
    tip,
    total: cents(taxableBase + tax + tip),
  }
}
