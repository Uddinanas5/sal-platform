"use client"

import React, { useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronDown, Percent, DollarSign, Tag, X, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn, formatCurrency } from "@/lib/utils"

interface DiscountSectionProps {
  discount: number
  discountType: "percentage" | "fixed"
  discountValue: number
  subtotal: number
  onSetDiscount: (value: number, type: "percentage" | "fixed") => void
  onClearDiscount: () => void
}

export function DiscountSection({
  discount,
  discountType,
  discountValue,
  subtotal,
  onSetDiscount,
  onClearDiscount,
}: DiscountSectionProps) {
  const [isExpanded, setIsExpanded] = useState(discount > 0)
  const [localType, setLocalType] = useState<"percentage" | "fixed">(discountType)
  const [localValue, setLocalValue] = useState(discountValue > 0 ? String(discountValue) : "")

  const validationError = useMemo(() => {
    if (!localValue) return null
    const val = parseFloat(localValue)
    if (isNaN(val) || val < 0) return "Enter a valid number"
    if (val === 0) return null
    if (localType === "percentage" && val > 100) return "Cannot exceed 100%"
    if (localType === "fixed" && val > subtotal) return `Cannot exceed ${formatCurrency(subtotal)}`
    return null
  }, [localValue, localType, subtotal])

  const isValid = localValue && parseFloat(localValue) > 0 && !validationError

  const handleApply = () => {
    if (!isValid) return
    const val = parseFloat(localValue)
    onSetDiscount(val, localType)
  }

  const handleClear = () => {
    setLocalValue("")
    onClearDiscount()
  }

  // If there's an active discount, show the applied state
  if (discount > 0) {
    return (
      <div className="rounded-lg border border-sal-200 bg-sal-50/50 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-sal-600" />
            <span className="text-sm font-medium text-sal-700">
              {discountType === "percentage"
                ? `${discountValue}% off`
                : `${formatCurrency(discountValue)} off`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-sal-600">
              -{formatCurrency(discount)}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-destructive"
              onClick={handleClear}
              aria-label="Clear discount"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center gap-2 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <Tag className="h-3.5 w-3.5" />
        <span>Add Discount</span>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Info className="h-3 w-3 text-muted-foreground/50 cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[220px] text-xs">
              Apply a percentage or fixed dollar discount to the subtotal
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <ChevronDown
          className={cn(
            "ml-auto h-3.5 w-3.5 transition-transform",
            isExpanded && "rotate-180"
          )}
        />
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 pt-3">
              {/* Type selector */}
              <div className="flex rounded-lg border bg-muted p-1">
                <button
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                    localType === "percentage"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground"
                  )}
                  onClick={() => setLocalType("percentage")}
                >
                  <Percent className="h-3 w-3" />
                  Percentage
                </button>
                <button
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                    localType === "fixed"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground"
                  )}
                  onClick={() => setLocalType("fixed")}
                >
                  <DollarSign className="h-3 w-3" />
                  Fixed Amount
                </button>
              </div>

              {/* Value input */}
              <div className="space-y-1.5">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type="number"
                      placeholder={localType === "percentage" ? "0" : "0.00"}
                      value={localValue}
                      onChange={(e) => setLocalValue(e.target.value)}
                      className={cn(
                        "pr-8",
                        validationError && "border-destructive focus-visible:ring-destructive"
                      )}
                      min="0"
                      max={localType === "percentage" ? "100" : undefined}
                      step={localType === "percentage" ? "1" : "0.01"}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleApply()
                      }}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      {localType === "percentage" ? "%" : "$"}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleApply}
                    disabled={!isValid}
                    className="shrink-0"
                  >
                    Apply
                  </Button>
                </div>
                {validationError && (
                  <p className="text-[11px] text-destructive font-medium">{validationError}</p>
                )}
                {!validationError && localValue && isValid && (
                  <p className="text-[11px] text-muted-foreground">
                    Saves {localType === "percentage" ? `${formatCurrency(subtotal * parseFloat(localValue) / 100)}` : formatCurrency(parseFloat(localValue))}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
