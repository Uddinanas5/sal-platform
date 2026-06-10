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
  Receipt,
  AlertCircle,
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
import { processPayment, sendReceiptEmailAction } from "@/lib/actions/checkout"
import { validateGiftCard } from "@/lib/actions/gift-cards"
import { toast } from "sonner"

interface CartItem {
  id: string
  catalogId?: string
  type: "service" | "product" | "custom"
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
  clientEmail?: string | null
  subtotal: number
  discount: number
  discountType: "percentage" | "fixed"
  discountValue: number
  loyaltyDiscount?: number
  redeemPoints?: number
  tax: number
  tip: number
  total: number
  paymentMethod: "cash" | "card" | "gift_card" | null
  onSetPaymentMethod: (method: "cash" | "card" | "gift_card") => void
  onComplete: () => void
  businessName?: string
  businessAddress?: string
  businessPhone?: string
}

type PaymentStep = "method" | "processing" | "success"

// Result of a "Check balance" lookup against validateGiftCard. `checked` becomes
// true only after a lookup has run, so the Process button can stay disabled
// until the cashier has actually verified the card covers the full total.
type GiftCardCheck =
  | { checked: false }
  | { checked: true; valid: false; error: string }
  | { checked: true; valid: true; balance: number; expiresAt: string | null }

export function PaymentDialog({
  open,
  onOpenChange,
  items,
  clientId,
  clientName,
  clientEmail,
  subtotal,
  discount,
  discountType,
  discountValue,
  loyaltyDiscount = 0,
  redeemPoints = 0,
  tax,
  tip,
  total,
  paymentMethod,
  onSetPaymentMethod,
  onComplete,
  businessName,
  businessAddress,
  businessPhone,
}: PaymentDialogProps) {
  const [step, setStep] = useState<PaymentStep>("method")
  const [tenderedAmount, setTenderedAmount] = useState("")
  const [giftCardCode, setGiftCardCode] = useState("")
  const [giftCardCheck, setGiftCardCheck] = useState<GiftCardCheck>({ checked: false })
  const [isCheckingGiftCard, setIsCheckingGiftCard] = useState(false)
  const [showReceipt, setShowReceipt] = useState(false)
  const [receiptNumber, setReceiptNumber] = useState("")
  const [isSendingEmail, setIsSendingEmail] = useState(false)

  // BETA: a gift card must cover the FULL total — no partial/split redemption
  // (post-beta feature). The Process button is gated on a verified card whose
  // balance >= total; an insufficient card shows an honest "use cash" message.
  const giftCardCoversTotal =
    giftCardCheck.checked && giftCardCheck.valid && giftCardCheck.balance + 0.0049 >= total

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
      setGiftCardCheck({ checked: false })
      setIsCheckingGiftCard(false)
      setShowReceipt(false)
      setReceiptNumber("")
      setIsSendingEmail(false)
    }
  }, [open, paymentMethod])

  // Look up the gift card balance/expiry server-side. The result gates the
  // Process button; we never trust the balance for the actual decrement — that
  // is re-read + verified server-side inside recordCheckout.
  const handleCheckGiftCard = useCallback(async () => {
    const code = giftCardCode.trim()
    if (code.length < 4) return
    setIsCheckingGiftCard(true)
    try {
      const result = await validateGiftCard(code)
      if (result.success) {
        setGiftCardCheck({
          checked: true,
          valid: true,
          balance: result.data.balance,
          expiresAt: result.data.expiresAt,
        })
      } else {
        setGiftCardCheck({ checked: true, valid: false, error: result.error })
      }
    } catch {
      setGiftCardCheck({ checked: true, valid: false, error: "Could not check this gift card. Try again." })
    } finally {
      setIsCheckingGiftCard(false)
    }
  }, [giftCardCode])

  const handleProcessPayment = useCallback(async () => {
    if (!paymentMethod) return

    if (paymentMethod === "cash") {
      const tendered = parseFloat(tenderedAmount)
      if (isNaN(tendered) || tendered < total) return
    }

    if (paymentMethod === "gift_card") {
      // Must be a verified card that covers the FULL total (no partial in beta).
      if (!giftCardCoversTotal) {
        toast.error("This gift card can't cover the full total. Please use cash instead.")
        return
      }
    }

    setStep("processing")

    try {
      // Catalog lines (price re-fetched from the DB server-side, GAP-034).
      const payableItems = items
        .filter((item): item is CartItem & { type: "service" | "product" } => item.type !== "custom")
        .map((item) => ({
          type: item.type,
          id: item.catalogId ?? item.id,
          quantity: item.quantity,
          // Service lines carry the staff who performed them so the server records
          // commission for walk-in sales (no appointment). Undefined for products.
          ...(item.type === "service" && item.staffId ? { staffId: item.staffId } : {}),
        }))

      // Ad-hoc "Quick Sale" lines: sent as first-class custom lines (NOT dropped)
      // so the recorded sale includes them. The unitPrice is authoritative for
      // the line only; the server still owns subtotal/tax/total.
      const customItems = items
        .filter((item): item is CartItem & { type: "custom" } => item.type === "custom")
        .map((item) => ({
          type: "custom" as const,
          name: item.name,
          unitPrice: item.price,
          quantity: item.quantity,
        }))

      const result = await processPayment({
        clientId: clientId || undefined,
        items: payableItems,
        customItems,
        discount,
        tax,
        tip,
        method: paymentMethod,
        // Points to redeem as a discount; the server recomputes + caps the value.
        redeemPoints: redeemPoints > 0 ? redeemPoints : undefined,
        // Gift-card tender (server re-reads + verifies the balance before charging).
        giftCardCode: paymentMethod === "gift_card" ? giftCardCode.trim() : undefined,
      })

      if (result.success) {
        setReceiptNumber(result.data.paymentReference)
        if (result.data.loyalty.redeemedPoints > 0) {
          toast.success(
            `Redeemed ${result.data.loyalty.redeemedPoints} pts (${formatCurrency(result.data.loyalty.redeemedAmount)} off)`
          )
        }
        setStep("success")
      } else {
        toast.error(result.error || "Payment failed")
        setStep("method")
      }
    } catch {
      toast.error("An unexpected error occurred")
      setStep("method")
    }
  }, [paymentMethod, tenderedAmount, total, clientId, items, discount, tax, tip, redeemPoints, giftCardCode, giftCardCoversTotal])

  const handleEmailReceipt = async () => {
    if (!clientEmail) {
      toast.error("No client email on file")
      return
    }
    setIsSendingEmail(true)
    try {
      const result = await sendReceiptEmailAction({
        clientEmail,
        clientName: clientName || "Valued Client",
        businessName: businessName || "Our Salon",
        items: items.map((i) => ({
          name: i.name,
          quantity: i.quantity,
          price: i.price,
        })),
        subtotal,
        discount,
        tax,
        tip,
        total,
        paymentMethod:
          paymentMethod === "cash"
            ? "Cash"
            : paymentMethod === "card"
              ? "Card"
              : "Gift Card",
        receiptNumber: receiptNumber || "N/A",
      })
      if (result.success) {
        toast.success("Receipt emailed to " + clientEmail)
      } else {
        toast.error(result.error || "Failed to send receipt email")
      }
    } finally {
      setIsSendingEmail(false)
    }
  }

  const handleComplete = () => {
    toast.success("Payment completed successfully!")
    onComplete()
    onOpenChange(false)
  }

  // Guard dialog dismissal so a sale can't be double-recorded:
  // - while "processing": ignore close requests entirely (the request is in flight).
  // - on the "success" screen: any dismissal (ESC / click-outside / X) must clear
  //   the cart via onComplete, otherwise the same cart stays loaded and could be
  //   processed a second time.
  const handleDialogOpenChange = (next: boolean) => {
    if (next) {
      onOpenChange(true)
      return
    }
    if (step === "processing") return
    if (step === "success") {
      onComplete()
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
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
                    loyaltyDiscount={loyaltyDiscount}
                    loyaltyPoints={redeemPoints}
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
                    {/* Card payments are not yet live (online charging via SAL
                        Payments is not enabled for beta). Disabled + labeled so
                        nothing records a "paid" sale that wasn't really charged. */}
                    <button
                      type="button"
                      disabled
                      title="Card payments are coming soon"
                      className="flex flex-col items-center gap-2 rounded-lg border-2 border-border p-4 opacity-40 cursor-not-allowed"
                    >
                      <CreditCard className="h-6 w-6 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground">
                        Card (soon)
                      </span>
                    </button>
                    {/* Gift card redemption: balance is looked up + decremented
                        server-side (recordCheckout). BETA: the card must cover
                        the full total — no partial/split redemption. */}
                    <button
                      type="button"
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
                        Gift card
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
                          onChange={(e) => {
                            setGiftCardCode(e.target.value.toUpperCase())
                            // Any edit invalidates a prior check.
                            setGiftCardCheck({ checked: false })
                          }}
                          className="font-mono tracking-wider"
                          autoFocus
                        />
                        <Button
                          variant="outline"
                          disabled={giftCardCode.trim().length < 4 || isCheckingGiftCard}
                          onClick={handleCheckGiftCard}
                        >
                          {isCheckingGiftCard ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Check balance"
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Invalid / not-found / expired */}
                    {giftCardCheck.checked && !giftCardCheck.valid && (
                      <div className="flex items-start gap-2 rounded-lg bg-red-500/10 p-3 text-sm dark:text-red-300">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                        <span>{giftCardCheck.error}</span>
                      </div>
                    )}

                    {/* Valid card — show balance + expiry, and whether it covers
                        the full total. BETA: no partial redemption. */}
                    {giftCardCheck.checked && giftCardCheck.valid && (
                      <div
                        className={cn(
                          "rounded-lg p-3 text-sm",
                          giftCardCoversTotal
                            ? "bg-sal-500/10 dark:text-sal-300"
                            : "bg-amber-500/10 dark:text-amber-300"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Balance</span>
                          <span className="font-semibold">
                            {formatCurrency(giftCardCheck.balance)}
                          </span>
                        </div>
                        {giftCardCheck.expiresAt && (
                          <div className="mt-1 flex items-center justify-between">
                            <span className="text-muted-foreground">Expires</span>
                            <span>
                              {new Date(giftCardCheck.expiresAt).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                        {!giftCardCoversTotal && (
                          <p className="mt-2 flex items-start gap-2 font-medium">
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                            <span>
                              This card can&apos;t cover the full {formatCurrency(total)} total
                              (no partial payments yet). Please use cash instead.
                            </span>
                          </p>
                        )}
                      </div>
                    )}
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
                    // Gift card must be verified AND cover the full total (beta).
                    (paymentMethod === "gift_card" && !giftCardCoversTotal)
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
                      if (!receiptEl) { toast.error("Could not prepare the receipt to print"); return }
                      const printWindow = window.open("", "_blank", "width=400,height=600")
                      if (!printWindow) { toast.error("Pop-up blocked"); return }
                      printWindow.document.write(
                        `<html><head><title>Receipt</title>
                        <style>
                          body { font-family: 'Courier New', monospace; font-size: 12px; padding: 20px; margin: 0; }
                          * { box-sizing: border-box; }
                          @media print { body { padding: 0; } }
                        </style></head>
                        <body>${receiptEl.innerHTML}</body></html>`
                      )
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
                    disabled={isSendingEmail || !clientEmail}
                    title={!clientEmail ? "No client email on file" : undefined}
                    onClick={handleEmailReceipt}
                  >
                    <Mail className="h-5 w-5" />
                    <span className="text-xs">
                      {isSendingEmail ? "Sending…" : "Email"}
                    </span>
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

              {/* Always-mounted hidden receipt so the Print button has a DOM node
                  to read on the success screen (the visible ReceiptView only
                  renders in the mutually-exclusive showReceipt branch). */}
              <div id="receipt-print-area" className="sr-only" aria-hidden>
                <ReceiptView
                  items={items.map((i) => ({ name: i.name, quantity: i.quantity, price: i.price }))}
                  clientName={clientName}
                  subtotal={subtotal}
                  discount={discount}
                  discountType={discountType}
                  discountValue={discountValue}
                  tax={tax}
                  tip={tip}
                  total={total}
                  paymentMethod={paymentMethod}
                  businessName={businessName}
                  businessAddress={businessAddress}
                  businessPhone={businessPhone}
                />
              </div>
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
                  businessName={businessName}
                  businessAddress={businessAddress}
                  businessPhone={businessPhone}
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
