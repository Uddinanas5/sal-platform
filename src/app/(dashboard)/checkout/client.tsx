"use client"

import React, { useReducer, useCallback, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { ShoppingCart } from "lucide-react"
import { ServiceProductBrowser } from "@/components/checkout/service-product-browser"
import { CartPanel } from "@/components/checkout/cart-panel"
import { generateId, formatCurrency } from "@/lib/utils"
import { toast } from "sonner"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"

// ---------- Types ----------

interface CartItem {
  id: string
  type: "service" | "product"
  name: string
  price: number
  quantity: number
  staffId?: string
  staffName?: string
}

interface CartState {
  items: CartItem[]
  clientId: string | null
  clientName: string | null
  discount: number
  discountType: "percentage" | "fixed"
  tip: number
  paymentMethod: "cash" | "card" | "gift_card" | null
}

// ---------- Actions ----------

type CartAction =
  | {
      type: "ADD_SERVICE"
      payload: { id: string; name: string; price: number }
    }
  | {
      type: "ADD_PRODUCT"
      payload: { id: string; name: string; price: number }
    }
  | { type: "REMOVE_ITEM"; payload: { id: string } }
  | { type: "UPDATE_QUANTITY"; payload: { id: string; quantity: number } }
  | { type: "SET_CLIENT"; payload: { clientId: string; clientName: string } }
  | { type: "CLEAR_CLIENT" }
  | {
      type: "SET_DISCOUNT"
      payload: { value: number; discountType: "percentage" | "fixed" }
    }
  | { type: "CLEAR_DISCOUNT" }
  | { type: "SET_TIP"; payload: { amount: number } }
  | {
      type: "SET_PAYMENT_METHOD"
      payload: { method: "cash" | "card" | "gift_card" }
    }
  | { type: "CLEAR_CART" }

// ---------- Initial state ----------

const initialState: CartState = {
  items: [],
  clientId: null,
  clientName: null,
  discount: 0,
  discountType: "percentage",
  tip: 0,
  paymentMethod: null,
}

// ---------- Reducer ----------

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "ADD_SERVICE": {
      // Services are always added as new line items (no stacking)
      const newItem: CartItem = {
        id: `cart-${generateId()}`,
        type: "service",
        name: action.payload.name,
        price: action.payload.price,
        quantity: 1,
      }
      return { ...state, items: [...state.items, newItem] }
    }

    case "ADD_PRODUCT": {
      // Products stack if same product ID already in cart
      const existingIndex = state.items.findIndex(
        (item) =>
          item.type === "product" &&
          item.name === action.payload.name
      )
      if (existingIndex >= 0) {
        const updated = [...state.items]
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + 1,
        }
        return { ...state, items: updated }
      }
      const newItem: CartItem = {
        id: `cart-${generateId()}`,
        type: "product",
        name: action.payload.name,
        price: action.payload.price,
        quantity: 1,
      }
      return { ...state, items: [...state.items, newItem] }
    }

    case "REMOVE_ITEM":
      return {
        ...state,
        items: state.items.filter((item) => item.id !== action.payload.id),
      }

    case "UPDATE_QUANTITY": {
      if (action.payload.quantity <= 0) {
        return {
          ...state,
          items: state.items.filter((item) => item.id !== action.payload.id),
        }
      }
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === action.payload.id
            ? { ...item, quantity: action.payload.quantity }
            : item
        ),
      }
    }

    case "SET_CLIENT":
      return {
        ...state,
        clientId: action.payload.clientId,
        clientName: action.payload.clientName,
      }

    case "CLEAR_CLIENT":
      return { ...state, clientId: null, clientName: null }

    case "SET_DISCOUNT":
      return {
        ...state,
        discount: action.payload.value,
        discountType: action.payload.discountType,
      }

    case "CLEAR_DISCOUNT":
      return { ...state, discount: 0, discountType: "percentage" }

    case "SET_TIP":
      return { ...state, tip: action.payload.amount }

    case "SET_PAYMENT_METHOD":
      return { ...state, paymentMethod: action.payload.method }

    case "CLEAR_CART":
      return { ...initialState }

    default:
      return state
  }
}

// ---------- Types for server data ----------

interface ServiceItem {
  id: string
  name: string
  description: string
  duration: number
  price: number
  category: string
  color: string
  isActive: boolean
}

interface ProductItem {
  id: string
  name: string
  description: string
  sku: string
  category: string
  costPrice: number
  retailPrice: number
  stockLevel: number
  reorderLevel: number
  supplier: string
  isActive: boolean
}

interface ClientItem {
  id: string
  name: string
  email: string
  phone: string
  avatar?: string
  tags?: string[]
}

interface CheckoutClientProps {
  services: ServiceItem[]
  products: ProductItem[]
  clients: ClientItem[]
  productCategories: string[]
}

// ---------- Page Component ----------

export default function CheckoutClient({
  services,
  products,
  clients,
  productCategories,
}: CheckoutClientProps) {
  const [state, dispatch] = useReducer(cartReducer, initialState)
  const [mobileCartOpen, setMobileCartOpen] = useState(false)

  // Cart summary for the mobile floating button
  const cartSummary = useMemo(() => {
    const itemCount = state.items.length
    const subtotal = state.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    )
    return { itemCount, subtotal }
  }, [state.items])

  // Handlers
  const handleAddService = useCallback(
    (service: { id: string; name: string; price: number }) => {
      dispatch({ type: "ADD_SERVICE", payload: service })
      toast.success(`${service.name} added to cart`)
    },
    []
  )

  const handleAddProduct = useCallback(
    (product: { id: string; name: string; price: number }) => {
      dispatch({ type: "ADD_PRODUCT", payload: product })
      toast.success(`${product.name} added to cart`)
    },
    []
  )

  const handleAddQuickSale = useCallback(
    (amount: number, description: string) => {
      dispatch({
        type: "ADD_SERVICE",
        payload: { id: `qs-${generateId()}`, name: description, price: amount },
      })
      toast.success(`Quick sale added: $${amount.toFixed(2)}`)
    },
    []
  )

  const handleUpdateQuantity = useCallback(
    (id: string, quantity: number) => {
      dispatch({ type: "UPDATE_QUANTITY", payload: { id, quantity } })
    },
    []
  )

  const handleRemoveItem = useCallback((id: string) => {
    dispatch({ type: "REMOVE_ITEM", payload: { id } })
  }, [])

  const handleSetClient = useCallback(
    (clientId: string, clientName: string) => {
      dispatch({ type: "SET_CLIENT", payload: { clientId, clientName } })
    },
    []
  )

  const handleClearClient = useCallback(() => {
    dispatch({ type: "CLEAR_CLIENT" })
  }, [])

  const handleSetDiscount = useCallback(
    (value: number, discountType: "percentage" | "fixed") => {
      dispatch({ type: "SET_DISCOUNT", payload: { value, discountType } })
    },
    []
  )

  const handleClearDiscount = useCallback(() => {
    dispatch({ type: "CLEAR_DISCOUNT" })
  }, [])

  const handleSetTip = useCallback((amount: number) => {
    dispatch({ type: "SET_TIP", payload: { amount } })
  }, [])

  const handleSetPaymentMethod = useCallback(
    (method: "cash" | "card" | "gift_card") => {
      dispatch({ type: "SET_PAYMENT_METHOD", payload: { method } })
    },
    []
  )

  const handleClearCart = useCallback(() => {
    dispatch({ type: "CLEAR_CART" })
    setMobileCartOpen(false)
  }, [])

  const cartPanelProps = {
    clients,
    items: state.items,
    clientId: state.clientId,
    clientName: state.clientName,
    discount: state.discount,
    discountType: state.discountType,
    tip: state.tip,
    paymentMethod: state.paymentMethod,
    onUpdateQuantity: handleUpdateQuantity,
    onRemoveItem: handleRemoveItem,
    onSetClient: handleSetClient,
    onClearClient: handleClearClient,
    onSetDiscount: handleSetDiscount,
    onClearDiscount: handleClearDiscount,
    onSetTip: handleSetTip,
    onSetPaymentMethod: handleSetPaymentMethod,
    onClearCart: handleClearCart,
  }

  return (
    <div className="min-h-screen bg-cream">
      {/* Page header */}
      <div className="border-b bg-card/80 backdrop-blur-sm px-4 py-4 lg:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sal-100">
            <ShoppingCart className="h-5 w-5 text-sal-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold font-heading">Checkout</h1>
            <p className="text-sm text-muted-foreground">
              Point of Sale
            </p>
          </div>
        </div>
      </div>

      {/* Desktop: 2-column side-by-side layout (>= 1024px) */}
      <div className="hidden lg:flex h-[calc(100vh-73px)]">
        {/* Left panel: Service/Product browser (60%) */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-[60%] overflow-hidden border-r p-6"
        >
          <ServiceProductBrowser
            services={services}
            products={products}
            productCategories={productCategories}
            onAddService={handleAddService}
            onAddProduct={handleAddProduct}
            onAddQuickSale={handleAddQuickSale}
          />
        </motion.div>

        {/* Right panel: Cart (40%) */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-[40%] overflow-y-auto p-4"
        >
          <div className="sticky top-0">
            <CartPanel {...cartPanelProps} />
          </div>
        </motion.div>
      </div>

      {/* Mobile: Full-width service browser + floating cart button (< 1024px) */}
      <div className="lg:hidden flex flex-col h-[calc(100vh-73px)]">
        {/* Service/Product browser takes full width */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex-1 overflow-hidden p-4 pb-20"
        >
          <ServiceProductBrowser
            services={services}
            products={products}
            productCategories={productCategories}
            onAddService={handleAddService}
            onAddProduct={handleAddProduct}
            onAddQuickSale={handleAddQuickSale}
          />
        </motion.div>

        {/* Sticky bottom bar to open cart */}
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-white/95 dark:bg-card/95 backdrop-blur-sm px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
          <button
            onClick={() => setMobileCartOpen(true)}
            className="flex w-full items-center justify-between rounded-xl bg-sal-500 px-4 py-3 text-white shadow-lg transition-all active:scale-[0.98] hover:bg-sal-600"
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <ShoppingCart className="h-6 w-6" />
                {cartSummary.itemCount > 0 && (
                  <span className="absolute -right-2 -top-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-sal-600">
                    {cartSummary.itemCount}
                  </span>
                )}
              </div>
              <span className="text-sm font-semibold">
                {cartSummary.itemCount === 0
                  ? "View Cart"
                  : `${cartSummary.itemCount} item${cartSummary.itemCount !== 1 ? "s" : ""} in cart`}
              </span>
            </div>
            <span className="text-base font-bold">
              {formatCurrency(cartSummary.subtotal)}
            </span>
          </button>
        </div>

        {/* Mobile cart sheet (slides up from bottom) */}
        <Sheet open={mobileCartOpen} onOpenChange={setMobileCartOpen}>
          <SheetContent side="bottom" className="h-[90vh] sm:h-[85vh] max-h-[90vh] sm:max-h-[85vh] overflow-y-auto rounded-t-2xl p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Shopping Cart</SheetTitle>
              <SheetDescription>Review and manage items in your cart</SheetDescription>
            </SheetHeader>
            {/* Drag handle indicator */}
            <div className="sticky top-0 z-10 flex justify-center bg-background pb-2 pt-3">
              <div className="h-1.5 w-12 rounded-full bg-muted-foreground/20" />
            </div>
            <div className="px-4 pb-4">
              <CartPanel {...cartPanelProps} />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  )
}
