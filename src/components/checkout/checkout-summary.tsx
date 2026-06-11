"use client"

import React from "react"
import { Separator } from "@/components/ui/separator"
import { formatCurrency, TAX_RATE } from "@/lib/utils"

interface CheckoutSummaryProps {
  subtotal: number
  discount: number
  discountType: "percentage" | "fixed"
  discountValue: number
  tax: number
  tip: number
  total: number
  // Optional loyalty-redemption discount line (separate from the manual
  // discount so the operator can see exactly what points covered).
  loyaltyDiscount?: number
  loyaltyPoints?: number
}

export function CheckoutSummary({
  subtotal,
  discount,
  discountType,
  discountValue,
  tax,
  tip,
  total,
  loyaltyDiscount = 0,
  loyaltyPoints = 0,
}: CheckoutSummaryProps) {
  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-ink-soft">Subtotal</span>
        <span className="font-medium tabular-nums text-ink">{formatCurrency(subtotal)}</span>
      </div>

      {discount > 0 && (
        <div className="flex items-center justify-between text-mint">
          <span>
            Discount{" "}
            {discountType === "percentage"
              ? `(${discountValue}%)`
              : ""}
          </span>
          <span>-{formatCurrency(discount)}</span>
        </div>
      )}

      {loyaltyDiscount > 0 && (
        <div className="flex items-center justify-between text-mint">
          <span>Loyalty{loyaltyPoints > 0 ? ` (${loyaltyPoints.toLocaleString()} pts)` : ""}</span>
          <span>-{formatCurrency(loyaltyDiscount)}</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-ink-soft">Tax ({(TAX_RATE * 100).toFixed(TAX_RATE * 100 % 1 === 0 ? 0 : 3)}%)</span>
        <span className="font-medium tabular-nums text-ink">{formatCurrency(tax)}</span>
      </div>

      {tip > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-ink-soft">Tip</span>
          <span className="font-medium tabular-nums text-ink">{formatCurrency(tip)}</span>
        </div>
      )}

      <Separator className="my-2" />

      <div className="flex items-center justify-between">
        <span className="text-base font-bold text-ink">Total</span>
        <span className="text-lg font-bold tabular-nums text-ink">
          {formatCurrency(total)}
        </span>
      </div>
    </div>
  )
}
