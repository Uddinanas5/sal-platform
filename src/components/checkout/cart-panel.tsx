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
import { toast } from "sonner"

type SplitPaymentMethod = "cash" | "card" | "gift_card"

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
}: CartPanelProps) {
  const [customTip, setCustomTip] = useState("")
  const [showCustomTip, setShowCustomTip] = useState(false)
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [splitMode, setSplitMode] = useState(false)
  const [splitMethod1, setSplitMethod1] = useState<SplitPaymentMethod>("cash")
  const [splitMethod2, setSplitMethod2] = useState<SplitPaymentMethod>("card")
  const [splitAmount1, setSplitAmount1] = useState("")
  const [splitAmount2, setSplitAmount2] = useState("")

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

  const splitAmount1Num = parseFloat(splitAmount1) || 0
  const splitAmount2Num = parseFloat(splitAmount2) || 0
  const splitSumsMatch =
    Math.abs(splitAmount1Num + splitAmount2Num - total) < 0.01
  const splitValid = splitMode && splitSumsMatch && splitAmount1Num > 0 && splitAmount2Num > 0

  const methodLabel = (m: SplitPaymentMethod) =>
    m === "cash" ? "Cash" : m === "card" ? "Card" : "Gift Card"

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
                    onClick={() => {
                      setSplitMode(false)
                      onSetPaymentMethod("cash")
                    }}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-lg border-2 p-2.5 transition-all",
                      !splitMode && paymentMethod === "cash"
                        ? "border-sal-500 bg-sal-50"
                        : "border-border hover:border-sal-300"
                    )}
                  >
                    <Banknote
                      className={cn(
                        "h-5 w-5",
                        !splitMode && paymentMethod === "cash"
                          ? "text-sal-600"
                          : "text-muted-foreground"
                      )}
                    />
                    <span
                      className={cn(
                        "text-[10px] font-medium",
                        !splitMode && paymentMethod === "cash"
                          ? "text-sal-700"
                          : "text-muted-foreground"
                      )}
                    >
                      Cash
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      setSplitMode(false)
                      onSetPaymentMethod("card")
                    }}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-lg border-2 p-2.5 transition-all",
                      !splitMode && paymentMethod === "card"
                        ? "border-sal-500 bg-sal-50"
                        : "border-border hover:border-sal-300"
                    )}
                  >
                    <CreditCard
                      className={cn(
                        "h-5 w-5",
                        !splitMode && paymentMethod === "card"
                          ? "text-sal-600"
                          : "text-muted-foreground"
                      )}
                    />
                    <span
                      className={cn(
                        "text-[10px] font-medium",
                        !splitMode && paymentMethod === "card"
                          ? "text-sal-700"
                          : "text-muted-foreground"
                      )}
                    >
                      Card
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      setSplitMode(false)
                      onSetPaymentMethod("gift_card")
                    }}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-lg border-2 p-2.5 transition-all",
                      !splitMode && paymentMethod === "gift_card"
                        ? "border-sal-500 bg-sal-50"
                        : "border-border hover:border-sal-300"
                    )}
                  >
                    <Gift
                      className={cn(
                        "h-5 w-5",
                        !splitMode && paymentMethod === "gift_card"
                          ? "text-sal-600"
                          : "text-muted-foreground"
                      )}
                    />
                    <span
                      className={cn(
                        "text-[10px] font-medium",
                        !splitMode && paymentMethod === "gift_card"
                          ? "text-sal-700"
                          : "text-muted-foreground"
                      )}
                    >
                      Gift Card
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      setSplitMode(true)
                      const half = Math.round((total / 2) * 100) / 100
                      const remainder = Math.round((total - half) * 100) / 100
                      setSplitAmount1(half.toFixed(2))
                      setSplitAmount2(remainder.toFixed(2))
                      setSplitMethod1("cash")
                      setSplitMethod2("card")
                    }}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-lg border-2 p-2.5 transition-all",
                      splitMode
                        ? "border-sal-500 bg-sal-50"
                        : "border-border hover:border-sal-300"
                    )}
                  >
                    <ArrowLeftRight
                      className={cn(
                        "h-5 w-5",
                        splitMode
                          ? "text-sal-600"
                          : "text-muted-foreground"
                      )}
                    />
                    <span
                      className={cn(
                        "text-[10px] font-medium",
                        splitMode
                          ? "text-sal-700"
                          : "text-muted-foreground"
                      )}
                    >
                      Split
                    </span>
                  </button>
                </div>

                {/* Split payment section */}
                <AnimatePresence>
                  {splitMode && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
                        {/* Payment 1 */}
                        <div className="space-y-1.5">
                          <p className="text-xs font-medium text-muted-foreground">
                            Payment 1
                          </p>
                          <div className="flex items-center gap-2">
                            <div className="flex gap-1">
                              <button
                                onClick={() => setSplitMethod1("cash")}
                                className={cn(
                                  "rounded border px-2 py-1 text-[10px] font-medium transition-all",
                                  splitMethod1 === "cash"
                                    ? "border-sal-500 bg-sal-50 text-sal-700"
                                    : "border-border text-muted-foreground hover:border-sal-300"
                                )}
                              >
                                Cash
                              </button>
                              <button
                                onClick={() => setSplitMethod1("card")}
                                className={cn(
                                  "rounded border px-2 py-1 text-[10px] font-medium transition-all",
                                  splitMethod1 === "card"
                                    ? "border-sal-500 bg-sal-50 text-sal-700"
                                    : "border-border text-muted-foreground hover:border-sal-300"
                                )}
                              >
                                Card
                              </button>
                              <button
                                onClick={() => setSplitMethod1("gift_card")}
                                className={cn(
                                  "rounded border px-2 py-1 text-[10px] font-medium transition-all",
                                  splitMethod1 === "gift_card"
                                    ? "border-sal-500 bg-sal-50 text-sal-700"
                                    : "border-border text-muted-foreground hover:border-sal-300"
                                )}
                              >
                                Gift Card
                              </button>
                            </div>
                            <Input
                              type="number"
                              value={splitAmount1}
                              onChange={(e) => {
                                setSplitAmount1(e.target.value)
                                const val = parseFloat(e.target.value)
                                if (!isNaN(val) && val >= 0 && val <= total) {
                                  const remaining = Math.round((total - val) * 100) / 100
                                  setSplitAmount2(remaining.toFixed(2))
                                }
                              }}
                              className="h-8 w-28 text-sm font-medium"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                            />
                          </div>
                        </div>

                        {/* Payment 2 */}
                        <div className="space-y-1.5">
                          <p className="text-xs font-medium text-muted-foreground">
                            Payment 2
                          </p>
                          <div className="flex items-center gap-2">
                            <div className="flex gap-1">
                              <button
                                onClick={() => setSplitMethod2("cash")}
                                className={cn(
                                  "rounded border px-2 py-1 text-[10px] font-medium transition-all",
                                  splitMethod2 === "cash"
                                    ? "border-sal-500 bg-sal-50 text-sal-700"
                                    : "border-border text-muted-foreground hover:border-sal-300"
                                )}
                              >
                                Cash
                              </button>
                              <button
                                onClick={() => setSplitMethod2("card")}
                                className={cn(
                                  "rounded border px-2 py-1 text-[10px] font-medium transition-all",
                                  splitMethod2 === "card"
                                    ? "border-sal-500 bg-sal-50 text-sal-700"
                                    : "border-border text-muted-foreground hover:border-sal-300"
                                )}
                              >
                                Card
                              </button>
                              <button
                                onClick={() => setSplitMethod2("gift_card")}
                                className={cn(
                                  "rounded border px-2 py-1 text-[10px] font-medium transition-all",
                                  splitMethod2 === "gift_card"
                                    ? "border-sal-500 bg-sal-50 text-sal-700"
                                    : "border-border text-muted-foreground hover:border-sal-300"
                                )}
                              >
                                Gift Card
                              </button>
                            </div>
                            <Input
                              type="number"
                              value={splitAmount2}
                              onChange={(e) => {
                                setSplitAmount2(e.target.value)
                                const val = parseFloat(e.target.value)
                                if (!isNaN(val) && val >= 0 && val <= total) {
                                  const remaining = Math.round((total - val) * 100) / 100
                                  setSplitAmount1(remaining.toFixed(2))
                                }
                              }}
                              className="h-8 w-28 text-sm font-medium"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                            />
                          </div>
                        </div>

                        {/* Validation message */}
                        {!splitSumsMatch && splitAmount1 !== "" && splitAmount2 !== "" && (
                          <p className="text-[10px] font-medium text-destructive">
                            Amounts must sum to {formatCurrency(total)} (currently{" "}
                            {formatCurrency(splitAmount1Num + splitAmount2Num)})
                          </p>
                        )}
                        {splitSumsMatch && splitAmount1Num > 0 && splitAmount2Num > 0 && (
                          <p className="text-[10px] font-medium text-sal-600">
                            Split payment: {methodLabel(splitMethod1)} ({formatCurrency(splitAmount1Num)}) +{" "}
                            {methodLabel(splitMethod2)} ({formatCurrency(splitAmount2Num)})
                          </p>
                        )}

                        <button
                          onClick={() => setSplitMode(false)}
                          className="text-[10px] text-muted-foreground underline hover:text-foreground"
                        >
                          Cancel Split
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <Button
                  className="w-full h-12 text-base font-semibold"
                  disabled={splitMode ? !splitValid : !paymentMethod}
                  onClick={() => {
                    if (splitMode && splitValid) {
                      toast.info(
                        `Split payment: ${methodLabel(splitMethod1)} (${formatCurrency(splitAmount1Num)}) + ${methodLabel(splitMethod2)} (${formatCurrency(splitAmount2Num)})`
                      )
                      onSetPaymentMethod(splitMethod1)
                      setPaymentDialogOpen(true)
                    } else {
                      setPaymentDialogOpen(true)
                    }
                  }}
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
      />
    </>
  )
}
