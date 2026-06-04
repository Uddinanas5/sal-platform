"use client"

import React, { useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  ShoppingCart,
  Trash2,
  Banknote,
  CreditCard,
  Gift,
  ArrowLeftRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { CartItemRow } from "./cart-item-row"
import { ClientSelector } from "./client-selector"
import { DiscountSection } from "./discount-section"
import { CheckoutSummary } from "./checkout-summary"
import { PaymentDialog } from "./payment-dialog"
import { cn, formatCurrency, TAX_RATE } from "@/lib/utils"

interface CartItem {
  id: string
  type: "service" | "product"
  name: string
  price: number
  quantity: number
  staffId?: string
  staffName?: string
}

interface ClientItem {
  id: string
  name: string
  email: string
  phone: string
  avatar?: string
  tags?: string[]
}

interface CartPanelProps {
  clients: ClientItem[]
  items: CartItem[]
  clientId: string | null
  clientName: string | null
  discount: number
  discountType: "percentage" | "fixed"
  tip: number
  paymentMethod: "cash" | "card" | "gift_card" | null
  onUpdateQuantity: (id: string, quantity: number) => void
  onRemoveItem: (id: string) => void
  onSetClient: (clientId: string, clientName: string) => void
  onClearClient: () => void
  onSetDiscount: (value: number, type: "percentage" | "fixed") => void
  onClearDiscount: () => void
  onSetTip: (amount: number) => void
  onSetPaymentMethod: (method: "cash" | "card" | "gift_card") => void
  onClearCart: () => void
  businessName?: string
  businessAddress?: string
  businessPhone?: string
}

const tipPresets = [5, 10, 15, 20]

export function CartPanel({
  clients,
  items,
  clientId,
  clientName,
  discount,
  discountType,
  tip,
  paymentMethod,
  onUpdateQuantity,
  onRemoveItem,
  onSetClient,
  onClearClient,
  onSetDiscount,
  onClearDiscount,
  onSetTip,
  onSetPaymentMethod,
  onClearCart,
  businessName,
  businessAddress,
  businessPhone,
}: CartPanelProps) {
  const [customTip, setCustomTip] = useState("")
  const [showCustomTip, setShowCustomTip] = useState(false)
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)

  // Calculations
  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [items]
  )

  const discountValue = discount // raw input value from user
  const discountAmount = useMemo(() => {
    if (discountType === "percentage") {
      return (subtotal * discount) / 100
    }
    return discount
  }, [subtotal, discount, discountType])

  const afterDiscount = Math.max(0, subtotal - discountAmount)
  const tax = afterDiscount * TAX_RATE
  const total = afterDiscount + tax + tip

  const isEmpty = items.length === 0

  return (
    <>
      <div className="flex h-full flex-col rounded-xl border bg-card shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-sal-600" />
            <h2 className="font-semibold">Cart</h2>
            {items.length > 0 && (
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-sal-500 px-1.5 text-[10px] font-bold text-white">
                {items.length}
              </span>
            )}
          </div>
          {items.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground hover:text-destructive"
              onClick={onClearCart}
            >
              <Trash2 className="mr-1 h-3 w-3" />
              Clear
            </Button>
          )}
        </div>

        {/* Client selector */}
        <div className="border-b px-4 py-3">
          <ClientSelector
            clients={clients}
            clientId={clientId}
            clientName={clientName}
            onSelectClient={onSetClient}
            onClearClient={onClearClient}
          />
        </div>

        {/* Cart items */}
        <div className="flex-1 min-h-0">
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <ShoppingCart className="h-7 w-7 text-muted-foreground/50" />
              </div>
              <p className="mt-3 text-sm font-medium text-muted-foreground">
                Cart is empty
              </p>
              <p className="mt-1 text-xs text-muted-foreground/70 text-center">
                Add services or products from the menu
              </p>
            </div>
          ) : (
            <ScrollArea className="h-full max-h-[300px]">
              <div className="space-y-1 px-3 py-2">
                <AnimatePresence>
                  {items.map((item) => (
                    <CartItemRow
                      key={item.id}
                      {...item}
                      onUpdateQuantity={onUpdateQuantity}
                      onRemove={onRemoveItem}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Footer: totals and actions */}
        {!isEmpty && (
          <div className="border-t">
            <div className="space-y-4 px-4 py-4">
              {/* Discount section */}
              <DiscountSection
                discount={discountAmount}
                discountType={discountType}
                discountValue={discountValue}
                subtotal={subtotal}
                onSetDiscount={onSetDiscount}
                onClearDiscount={onClearDiscount}
              />

              {/* Tip section */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Tip
                </p>
                <div className="flex gap-1.5">
                  {tipPresets.map((preset) => (
                    <button
                      key={preset}
                      onClick={() => {
                        onSetTip(preset)
                        setShowCustomTip(false)
                        setCustomTip("")
                      }}
                      className={cn(
                        "flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-all",
                        tip === preset
                          ? "border-sal-500 bg-sal-50 text-sal-700"
                          : "border-border text-muted-foreground hover:border-sal-300"
                      )}
                    >
                      ${preset}
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      setShowCustomTip(!showCustomTip)
                      if (
                        !showCustomTip &&
                        !tipPresets.includes(tip) &&
                        tip > 0
                      ) {
                        setCustomTip(String(tip))
                      }
                    }}
                    className={cn(
                      "flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-all",
                      showCustomTip || (!tipPresets.includes(tip) && tip > 0)
                        ? "border-sal-500 bg-sal-50 text-sal-700"
                        : "border-border text-muted-foreground hover:border-sal-300"
                    )}
                  >
                    Custom
                  </button>
                </div>
                <AnimatePresence>
                  {showCustomTip && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="flex gap-2 pt-1">
                        <Input
                          type="number"
                          placeholder="Custom amount"
                          value={customTip}
                          onChange={(e) => setCustomTip(e.target.value)}
                          className="h-8 text-sm"
                          min="0"
                          step="0.01"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const val = parseFloat(customTip)
                              if (!isNaN(val) && val >= 0) {
                                onSetTip(val)
                                setShowCustomTip(false)
                              }
                            }
                          }}
                        />
                        <Button
                          size="sm"
                          className="h-8"
                          onClick={() => {
                            const val = parseFloat(customTip)
                            if (!isNaN(val) && val >= 0) {
                              onSetTip(val)
                              setShowCustomTip(false)
                            }
                          }}
                        >
                          Set
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                {tip > 0 && (
                  <button
                    onClick={() => {
                      onSetTip(0)
                      setCustomTip("")
                      setShowCustomTip(false)
                    }}
                    className="text-[10px] text-muted-foreground underline hover:text-foreground"
                  >
                    Remove tip
                  </button>
                )}
              </div>

              <Separator />

              {/* Summary */}
              <CheckoutSummary
                subtotal={subtotal}
                discount={discountAmount}
                discountType={discountType}
                discountValue={discountValue}
                tax={tax}
                tip={tip}
                total={total}
              />

              {/* Payment buttons */}
              <div className="space-y-2">
                <div className="grid grid-cols-4 gap-2">
                  <button
                    onClick={() => onSetPaymentMethod("cash")}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-lg border-2 p-2.5 transition-all",
                      paymentMethod === "cash"
                        ? "border-sal-500 bg-sal-50"
                        : "border-border hover:border-sal-300"
                    )}
                  >
                    <Banknote
                      className={cn(
                        "h-5 w-5",
                        paymentMethod === "cash"
                          ? "text-sal-600"
                          : "text-muted-foreground"
                      )}
                    />
                    <span
                      className={cn(
                        "text-[10px] font-medium",
                        paymentMethod === "cash"
                          ? "text-sal-700"
                          : "text-muted-foreground"
                      )}
                    >
                      Cash
                    </span>
                  </button>
                  {/* Card, Gift Card and Split are NOT live in beta (cash only).
                      There is no real charge/redemption/multi-tender behind them,
                      and processPayment rejects "card"/"gift_card" server-side, so
                      these are disabled + labeled instead of throwing a generic
                      "Invalid input" toast on click. Cash stays fully functional. */}
                  <button
                    type="button"
                    disabled
                    title="Coming soon — cash only during beta"
                    className="flex flex-col items-center gap-1 rounded-lg border-2 border-border p-2.5 opacity-40 cursor-not-allowed"
                  >
                    <CreditCard className="h-5 w-5 text-muted-foreground" />
                    <span className="text-[10px] font-medium text-muted-foreground">
                      Card (soon)
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled
                    title="Coming soon — cash only during beta"
                    className="flex flex-col items-center gap-1 rounded-lg border-2 border-border p-2.5 opacity-40 cursor-not-allowed"
                  >
                    <Gift className="h-5 w-5 text-muted-foreground" />
                    <span className="text-[10px] font-medium text-muted-foreground">
                      Gift Card (soon)
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled
                    title="Coming soon — cash only during beta"
                    className="flex flex-col items-center gap-1 rounded-lg border-2 border-border p-2.5 opacity-40 cursor-not-allowed"
                  >
                    <ArrowLeftRight className="h-5 w-5 text-muted-foreground" />
                    <span className="text-[10px] font-medium text-muted-foreground">
                      Split (soon)
                    </span>
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Card, Gift Card and Split are coming soon — cash only during beta.
                </p>

                {/* Split-tender UI removed for beta: only cash is collectable,
                    so there is nothing to split a payment across. The disabled
                    "Split (soon)" button above is the visible placeholder. */}

                <Button
                  className="w-full h-12 text-base font-semibold"
                  disabled={paymentMethod !== "cash"}
                  onClick={() => setPaymentDialogOpen(true)}
                >
                  Charge {formatCurrency(total)}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Payment dialog */}
      <PaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        items={items}
        clientId={clientId}
        clientName={clientName}
        clientEmail={clients.find((c) => c.id === clientId)?.email ?? null}
        subtotal={subtotal}
        discount={discountAmount}
        discountType={discountType}
        discountValue={discountValue}
        tax={tax}
        tip={tip}
        total={total}
        paymentMethod={paymentMethod}
        onSetPaymentMethod={onSetPaymentMethod}
        onComplete={onClearCart}
        businessName={businessName}
        businessAddress={businessAddress}
        businessPhone={businessPhone}
      />
    </>
  )
}
