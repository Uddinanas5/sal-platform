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
}

export function CheckoutSummary({
  subtotal,
  discount,
  discountType,
  discountValue,
  tax,
  tip,
  total,
}: CheckoutSummaryProps) {
  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Subtotal</span>
        <span className="font-medium">{formatCurrency(subtotal)}</span>
      </div>

      {discount > 0 && (
        <div className="flex items-center justify-between text-sal-600">
          <span>
            Discount{" "}
            {discountType === "percentage"
              ? `(${discountValue}%)`
              : ""}
          </span>
          <span>-{formatCurrency(discount)}</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Tax ({(TAX_RATE * 100).toFixed(TAX_RATE * 100 % 1 === 0 ? 0 : 3)}%)</span>
        <span className="font-medium">{formatCurrency(tax)}</span>
      </div>

      {tip > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Tip</span>
          <span className="font-medium">{formatCurrency(tip)}</span>
        </div>
      )}

      <Separator className="my-2" />

      <div className="flex items-center justify-between">
        <span className="text-base font-bold">Total</span>
        <span className="text-lg font-bold text-sal-600">
          {formatCurrency(total)}
        </span>
      </div>
    </div>
  )
}
