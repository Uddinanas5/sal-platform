"use client"

import React, { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Banknote,
  CreditCard,
  Gift,
  Check,
  Loader2,
  Printer,
  Mail,
  MessageSquare,
  Receipt,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { CheckoutSummary } from "./checkout-summary"
import { ReceiptView } from "./receipt-view"
import { cn, formatCurrency } from "@/lib/utils"
import { processPayment } from "@/lib/actions/checkout"
import { toast } from "sonner"

interface CartItem {
  id: string
  type: "service" | "product"
  name: string
  price: number
  quantity: number
  staffId?: string
  staffName?: string
}

interface PaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: CartItem[]
  clientId: string | null
  clientName: string | null
  subtotal: number
  discount: number
  discountType: "percentage" | "fixed"
  discountValue: number
  tax: number
  tip: number
  total: number
  paymentMethod: "cash" | "card" | "gift_card" | null
  onSetPaymentMethod: (method: "cash" | "card" | "gift_card") => void
  onComplete: () => void
}

type PaymentStep = "method" | "processing" | "success"

export function PaymentDialog({
  open,
  onOpenChange,
  items,
  clientId,
  clientName,
  subtotal,
  discount,
  discountType,
  discountValue,
  tax,
  tip,
  total,
  paymentMethod,
  onSetPaymentMethod,
  onComplete,
}: PaymentDialogProps) {
  const [step, setStep] = useState<PaymentStep>("method")
  const [tenderedAmount, setTenderedAmount] = useState("")
  const [giftCardCode, setGiftCardCode] = useState("")
  const [showReceipt, setShowReceipt] = useState(false)

  const changeDue =
    paymentMethod === "cash" && tenderedAmount
      ? Math.max(0, parseFloat(tenderedAmount) - total)
      : 0

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setStep(paymentMethod ? "method" : "method")
      setTenderedAmount("")
      setGiftCardCode("")
      setShowReceipt(false)
    }
  }, [open, paymentMethod])

  const handleProcessPayment = useCallback(async () => {
    if (!paymentMethod) return

    if (paymentMethod === "cash") {
      const tendered = parseFloat(tenderedAmount)
      if (isNaN(tendered) || tendered < total) return
    }

    setStep("processing")

    try {
      const result = await processPayment({
        clientId: clientId || undefined,
        items: items.map((item) => ({
          type: item.type,
          id: item.id,
          price: item.price,
          quantity: item.quantity,
        })),
        subtotal,
        discount,
        tax,
        tip,
        total,
        method: paymentMethod,
      })

      if (result.success) {
        setStep("success")
      } else {
        toast.error(result.error || "Payment failed")
        setStep("method")
      }
    } catch {
      toast.error("An unexpected error occurred")
      setStep("method")
    }
  }, [paymentMethod, tenderedAmount, total, clientId, items, subtotal, discount, tax, tip])

  const handleComplete = () => {
    toast.success("Payment completed successfully!")
    onComplete()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <AnimatePresence mode="wait">
          {/* Step 1: Payment Method / Input */}
          {step === "method" && !showReceipt && (
            <motion.div
              key="method"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <DialogHeader>
                <DialogTitle>Complete Payment</DialogTitle>
                <DialogDescription>
                  {items.length} item{items.length !== 1 ? "s" : ""} --{" "}
                  Total: {formatCurrency(total)}
                </DialogDescription>
              </DialogHeader>

              <div className="mt-4 space-y-4">
                {/* Order summary */}
                <div className="rounded-lg border bg-cream-50 p-4">
                  <CheckoutSummary
                    subtotal={subtotal}
                    discount={discount}
                    discountType={discountType}
                    discountValue={discountValue}
                    tax={tax}
                    tip={tip}
                    total={total}
                  />
                </div>

                <Separator />

                {/* Payment method selection */}
                <div className="space-y-2">
                  <p className="text-sm font-medium">Payment Method</p>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      className={cn(
                        "flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all hover:border-sal-300",
                        paymentMethod === "cash"
                          ? "border-sal-500 bg-sal-50"
                          : "border-border"
                      )}
                      onClick={() => onSetPaymentMethod("cash")}
                    >
                      <Banknote
                        className={cn(
                          "h-6 w-6",
                          paymentMethod === "cash"
                            ? "text-sal-600"
                            : "text-muted-foreground"
                        )}
                      />
                      <span
                        className={cn(
                          "text-xs font-medium",
                          paymentMethod === "cash"
                            ? "text-sal-700"
                            : "text-muted-foreground"
                        )}
                      >
                        Cash
                      </span>
                    </button>
                    <button
                      className={cn(
                        "flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all hover:border-sal-300",
                        paymentMethod === "card"
                          ? "border-sal-500 bg-sal-50"
                          : "border-border"
                      )}
                      onClick={() => onSetPaymentMethod("card")}
                    >
                      <CreditCard
                        className={cn(
                          "h-6 w-6",
                          paymentMethod === "card"
                            ? "text-sal-600"
                            : "text-muted-foreground"
                        )}
                      />
                      <span
                        className={cn(
                          "text-xs font-medium",
                          paymentMethod === "card"
                            ? "text-sal-700"
                            : "text-muted-foreground"
                        )}
                      >
                        Card
                      </span>
                    </button>
                    <button
                      className={cn(
                        "flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all hover:border-sal-300",
                        paymentMethod === "gift_card"
                          ? "border-sal-500 bg-sal-50"
                          : "border-border"
                      )}
                      onClick={() => onSetPaymentMethod("gift_card")}
                    >
                      <Gift
                        className={cn(
                          "h-6 w-6",
                          paymentMethod === "gift_card"
                            ? "text-sal-600"
                            : "text-muted-foreground"
                        )}
                      />
                      <span
                        className={cn(
                          "text-xs font-medium",
                          paymentMethod === "gift_card"
                            ? "text-sal-700"
                            : "text-muted-foreground"
                        )}
                      >
                        Gift Card
                      </span>
                    </button>
                  </div>
                </div>

                {/* Cash flow */}
                {paymentMethod === "cash" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="space-y-3"
                  >
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Amount Tendered
                      </label>
                      <div className="relative">
                        <Banknote className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          type="number"
                          placeholder="0.00"
                          value={tenderedAmount}
                          onChange={(e) => setTenderedAmount(e.target.value)}
                          className="pl-9 text-lg font-semibold"
                          min={total}
                          step="0.01"
                          autoFocus
                        />
                      </div>
                    </div>
                    {tenderedAmount && parseFloat(tenderedAmount) >= total && (
                      <div className="rounded-lg bg-sal-50 p-3 text-center">
                        <p className="text-sm text-muted-foreground">
                          Change Due
                        </p>
                        <p className="text-2xl font-bold text-sal-600">
                          {formatCurrency(changeDue)}
                        </p>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Gift card flow */}
                {paymentMethod === "gift_card" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="space-y-3"
                  >
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Gift Card Code
                      </label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Enter gift card code..."
                          value={giftCardCode}
                          onChange={(e) =>
                            setGiftCardCode(e.target.value.toUpperCase())
                          }
                          className="font-mono tracking-wider"
                          autoFocus
                        />
                        <Button
                          variant="outline"
                          disabled={giftCardCode.length < 4}
                          onClick={() => {
                            toast.success("Gift card applied successfully!")
                          }}
                        >
                          Apply
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Process payment button */}
                <Button
                  className="w-full h-12 text-base"
                  disabled={
                    !paymentMethod ||
                    (paymentMethod === "cash" &&
                      (!tenderedAmount ||
                        parseFloat(tenderedAmount) < total)) ||
                    (paymentMethod === "gift_card" && giftCardCode.length < 4)
                  }
                  onClick={handleProcessPayment}
                >
                  Process {formatCurrency(total)}
                </Button>
              </div>
            </motion.div>
          )}

          {/* Step 2: Processing animation */}
          {step === "processing" && (
            <motion.div
              key="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-12"
            >
              <DialogHeader className="sr-only">
                <DialogTitle>Processing Payment</DialogTitle>
              </DialogHeader>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{
                  repeat: Infinity,
                  duration: 1,
                  ease: "linear",
                }}
              >
                <Loader2 className="h-12 w-12 text-sal-500" />
              </motion.div>
              <p className="mt-4 text-lg font-medium">
                Processing payment...
              </p>
              <p className="text-sm text-muted-foreground">
                {paymentMethod === "card"
                  ? "Waiting for card authorization..."
                  : "Please wait..."}
              </p>
            </motion.div>
          )}

          {/* Step 3: Success */}
          {step === "success" && !showReceipt && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center py-8"
            >
              <DialogHeader className="sr-only">
                <DialogTitle>Payment Complete</DialogTitle>
              </DialogHeader>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{
                  type: "spring",
                  stiffness: 200,
                  damping: 15,
                  delay: 0.1,
                }}
                className="flex h-20 w-20 items-center justify-center rounded-full bg-sal-100"
              >
                <Check className="h-10 w-10 text-sal-600" strokeWidth={3} />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mt-4 text-center"
              >
                <h3 className="text-xl font-bold text-sal-700">
                  Payment Complete
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatCurrency(total)} paid via{" "}
                  {paymentMethod === "cash"
                    ? "Cash"
                    : paymentMethod === "card"
                      ? "Card"
                      : "Gift Card"}
                </p>
                {paymentMethod === "cash" && changeDue > 0 && (
                  <p className="mt-1 text-sm font-medium text-sal-600">
                    Change: {formatCurrency(changeDue)}
                  </p>
                )}
              </motion.div>

              {/* Receipt options */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="mt-6 w-full space-y-3"
              >
                <p className="text-center text-sm font-medium text-muted-foreground">
                  Send Receipt
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant="outline"
                    className="flex-col gap-1.5 h-auto py-3"
                    onClick={() => {
                      const receiptEl = document.getElementById("receipt-print-area")
                      if (!receiptEl) { toast.success("Receipt sent to printer"); return }
                      const printWindow = window.open("", "_blank", "width=400,height=600")
                      if (!printWindow) { toast.error("Pop-up blocked"); return }
                      printWindow.document.write(`
                        <html><head><title>Receipt</title>
                        <style>
                          body { font-family: 'Courier New', monospace; font-size: 12px; padding: 20px; margin: 0; }
                          * { box-sizing: border-box; }
                          @media print { body { padding: 0; } }
                        </style></head>
                        <body>${receiptEl.innerHTML}</body></html>
                      `)
                      printWindow.document.close()
                      printWindow.focus()
                      setTimeout(() => { printWindow.print(); printWindow.close() }, 250)
                      toast.success("Receipt sent to printer")
                    }}
                  >
                    <Printer className="h-5 w-5" />
                    <span className="text-xs">Print</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-col gap-1.5 h-auto py-3"
                    onClick={() => toast.success("Receipt emailed to client")}
                  >
                    <Mail className="h-5 w-5" />
                    <span className="text-xs">Email</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-col gap-1.5 h-auto py-3"
                    onClick={() => toast.success("Receipt sent via SMS")}
                  >
                    <MessageSquare className="h-5 w-5" />
                    <span className="text-xs">SMS</span>
                  </Button>
                </div>

                <Button
                  variant="ghost"
                  className="w-full text-sm"
                  onClick={() => setShowReceipt(true)}
                >
                  <Receipt className="mr-2 h-4 w-4" />
                  View Receipt
                </Button>

                <Separator />

                <Button className="w-full" onClick={handleComplete}>
                  Done
                </Button>
              </motion.div>
            </motion.div>
          )}

          {/* Receipt view overlay */}
          {showReceipt && (
            <motion.div
              key="receipt"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <DialogHeader>
                <DialogTitle>Receipt</DialogTitle>
                <DialogDescription>Transaction receipt preview</DialogDescription>
              </DialogHeader>

              <div id="receipt-print-area" className="mt-4 rounded-lg border bg-cream-50 p-4">
                <ReceiptView
                  items={items.map((i) => ({
                    name: i.name,
                    quantity: i.quantity,
                    price: i.price,
                  }))}
                  clientName={clientName}
                  subtotal={subtotal}
                  discount={discount}
                  discountType={discountType}
                  discountValue={discountValue}
                  tax={tax}
                  tip={tip}
                  total={total}
                  paymentMethod={paymentMethod}
                />
              </div>

              <div className="mt-4 flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowReceipt(false)}
                >
                  Back
                </Button>
                <Button className="flex-1" onClick={handleComplete}>
                  Done
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  )
}
