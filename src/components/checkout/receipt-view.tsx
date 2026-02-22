"use client"

import React from "react"
import { format } from "date-fns"
import { formatCurrency, TAX_RATE } from "@/lib/utils"

interface ReceiptItem {
  name: string
  quantity: number
  price: number
}

interface ReceiptViewProps {
  items: ReceiptItem[]
  clientName: string | null
  subtotal: number
  discount: number
  discountType: "percentage" | "fixed"
  discountValue: number
  tax: number
  tip: number
  total: number
  paymentMethod: "cash" | "card" | "gift_card" | null
  transactionDate?: Date
}

export function ReceiptView({
  items,
  clientName,
  subtotal,
  discount,
  discountType,
  discountValue,
  tax,
  tip,
  total,
  paymentMethod,
  transactionDate = new Date(),
}: ReceiptViewProps) {
  const dashedLine = "- - - - - - - - - - - - - - - - - - - -"

  const paymentLabel =
    paymentMethod === "cash"
      ? "Cash"
      : paymentMethod === "card"
        ? "Credit/Debit Card"
        : paymentMethod === "gift_card"
          ? "Gift Card"
          : "N/A"

  return (
    <div className="mx-auto max-w-[320px] rounded-lg bg-white p-6 font-mono text-xs shadow-inner">
      {/* Header */}
      <div className="text-center">
        <h3 className="text-base font-bold tracking-wider">SAL Salon</h3>
        <p className="mt-1 text-[10px] text-muted-foreground">
          123 Beauty Lane, Suite 100
        </p>
        <p className="text-[10px] text-muted-foreground">
          Tel: (555) 000-1234
        </p>
      </div>

      <p className="my-3 text-center text-[10px] text-muted-foreground">
        {dashedLine}
      </p>

      {/* Date / Time / Client */}
      <div className="space-y-1 text-[11px]">
        <div className="flex justify-between">
          <span>Date:</span>
          <span>{format(transactionDate, "MM/dd/yyyy")}</span>
        </div>
        <div className="flex justify-between">
          <span>Time:</span>
          <span>{format(transactionDate, "hh:mm a")}</span>
        </div>
        {clientName && (
          <div className="flex justify-between">
            <span>Client:</span>
            <span>{clientName}</span>
          </div>
        )}
      </div>

      <p className="my-3 text-center text-[10px] text-muted-foreground">
        {dashedLine}
      </p>

      {/* Items */}
      <div className="space-y-1.5">
        {items.map((item, idx) => (
          <div key={idx} className="flex justify-between text-[11px]">
            <span className="flex-1 truncate pr-2">
              {item.quantity > 1 ? `${item.quantity}x ` : ""}
              {item.name}
            </span>
            <span className="shrink-0 font-medium">
              {formatCurrency(item.price * item.quantity)}
            </span>
          </div>
        ))}
      </div>

      <p className="my-3 text-center text-[10px] text-muted-foreground">
        {dashedLine}
      </p>

      {/* Totals */}
      <div className="space-y-1 text-[11px]">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between text-sal-600">
            <span>
              Discount
              {discountType === "percentage" ? ` (${discountValue}%)` : ""}
            </span>
            <span>-{formatCurrency(discount)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>Tax ({(TAX_RATE * 100).toFixed(TAX_RATE * 100 % 1 === 0 ? 0 : 3)}%)</span>
          <span>{formatCurrency(tax)}</span>
        </div>
        {tip > 0 && (
          <div className="flex justify-between">
            <span>Tip</span>
            <span>{formatCurrency(tip)}</span>
          </div>
        )}
      </div>

      <p className="my-2 text-center text-[10px] text-muted-foreground">
        {dashedLine}
      </p>

      <div className="flex justify-between text-sm font-bold">
        <span>TOTAL</span>
        <span>{formatCurrency(total)}</span>
      </div>

      <p className="my-2 text-center text-[10px] text-muted-foreground">
        {dashedLine}
      </p>

      {/* Payment method */}
      <div className="flex justify-between text-[11px]">
        <span>Payment:</span>
        <span className="font-medium">{paymentLabel}</span>
      </div>

      {/* Footer */}
      <div className="mt-4 text-center">
        <p className="text-[10px] text-muted-foreground">
          Thank you for visiting!
        </p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          www.meetsal.ai
        </p>
      </div>
    </div>
  )
}
