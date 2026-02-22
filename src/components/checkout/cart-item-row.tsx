"use client"

import React from "react"
import { motion } from "framer-motion"
import { Minus, Plus, X, Scissors, ShoppingBag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn, formatCurrency } from "@/lib/utils"

interface CartItemRowProps {
  id: string
  type: "service" | "product"
  name: string
  price: number
  quantity: number
  staffName?: string
  onUpdateQuantity: (id: string, quantity: number) => void
  onRemove: (id: string) => void
}

export function CartItemRow({
  id,
  type,
  name,
  price,
  quantity,
  staffName,
  onUpdateQuantity,
  onRemove,
}: CartItemRowProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="group flex items-start gap-3 rounded-lg border border-transparent p-2 transition-colors hover:border-border hover:bg-cream-50"
    >
      {/* Type indicator icon */}
      <div
        className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          type === "service"
            ? "bg-sal-50 text-sal-600"
            : "bg-amber-500/10 text-amber-600"
        )}
      >
        {type === "service" ? (
          <Scissors className="h-4 w-4" />
        ) : (
          <ShoppingBag className="h-4 w-4" />
        )}
      </div>

      {/* Name and optional staff */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{name}</p>
        {staffName && (
          <p className="text-xs text-muted-foreground">with {staffName}</p>
        )}
      </div>

      {/* Price */}
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold">
          {formatCurrency(price * quantity)}
        </p>
        {quantity > 1 && (
          <p className="text-xs text-muted-foreground">
            {formatCurrency(price)} each
          </p>
        )}
      </div>

      {/* Quantity controls */}
      <div className="flex shrink-0 items-center gap-1">
        {type === "product" ? (
          <>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => onUpdateQuantity(id, quantity - 1)}
              disabled={quantity <= 1}
              aria-label="Decrease quantity"
            >
              <Minus className="h-3 w-3" />
            </Button>
            <span className="w-6 text-center text-sm font-medium">
              {quantity}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => onUpdateQuantity(id, quantity + 1)}
              aria-label="Increase quantity"
            >
              <Plus className="h-3 w-3" />
            </Button>
          </>
        ) : (
          <span className="px-2 text-xs text-muted-foreground">x1</span>
        )}
      </div>

      {/* Remove button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 text-muted-foreground hover:text-destructive"
        onClick={() => onRemove(id)}
        aria-label="Remove item"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </motion.div>
  )
}
