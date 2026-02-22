"use client"

import React, { useState, useMemo } from "react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { Product } from "@/data/mock-products"
import { Package, Plus, Minus, RotateCcw } from "lucide-react"

type AdjustmentType = "add" | "remove" | "set"

interface StockAdjustmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: Product | null
}

export function StockAdjustmentDialog({
  open,
  onOpenChange,
  product,
}: StockAdjustmentDialogProps) {
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>("add")
  const [quantity, setQuantity] = useState("")
  const [reason, setReason] = useState("")

  const newStockLevel = useMemo(() => {
    if (!product) return 0
    const qty = parseInt(quantity) || 0
    switch (adjustmentType) {
      case "add":
        return product.stockLevel + qty
      case "remove":
        return Math.max(0, product.stockLevel - qty)
      case "set":
        return Math.max(0, qty)
    }
  }, [product, adjustmentType, quantity])

  function resetForm() {
    setAdjustmentType("add")
    setQuantity("")
    setReason("")
  }

  function handleSubmit() {
    if (!product) return

    const qty = parseInt(quantity)
    if (isNaN(qty) || qty < 0) {
      toast.error("Please enter a valid quantity")
      return
    }

    if (adjustmentType === "remove" && qty > product.stockLevel) {
      toast.error("Cannot remove more than current stock")
      return
    }

    toast.success(`Stock updated for ${product.name}`)
    resetForm()
    onOpenChange(false)
  }

  function handleCancel() {
    resetForm()
    onOpenChange(false)
  }

  if (!product) return null

  const stockStatus =
    product.stockLevel <= product.reorderLevel / 2
      ? "Critical"
      : product.stockLevel <= product.reorderLevel
        ? "Low"
        : "Good"

  const stockStatusColor =
    product.stockLevel <= product.reorderLevel / 2
      ? "text-red-600"
      : product.stockLevel <= product.reorderLevel
        ? "text-amber-600"
        : "text-emerald-600"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="font-heading">Adjust Stock</DialogTitle>
          <DialogDescription>
            Update the stock level for this product.
          </DialogDescription>
        </DialogHeader>

        <Separator />

        {/* Product Info */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-cream-50 border border-cream-200">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-sal-100">
            <Package className="w-5 h-5 text-sal-600" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-foreground">{product.name}</p>
            <p className="text-sm text-muted-foreground">
              SKU: {product.sku}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Current Stock</p>
            <p className={cn("text-lg font-bold", stockStatusColor)}>
              {product.stockLevel}
            </p>
            <p className={cn("text-xs", stockStatusColor)}>{stockStatus}</p>
          </div>
        </div>

        <div className="grid gap-4 py-2">
          {/* Adjustment Type */}
          <div className="grid gap-2">
            <Label>Adjustment Type</Label>
            <Select
              value={adjustmentType}
              onValueChange={(v) => setAdjustmentType(v as AdjustmentType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="add">
                  <span className="flex items-center gap-2">
                    <Plus className="w-3.5 h-3.5 text-emerald-600" />
                    Add Stock
                  </span>
                </SelectItem>
                <SelectItem value="remove">
                  <span className="flex items-center gap-2">
                    <Minus className="w-3.5 h-3.5 text-red-600" />
                    Remove Stock
                  </span>
                </SelectItem>
                <SelectItem value="set">
                  <span className="flex items-center gap-2">
                    <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
                    Set Level
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Quantity */}
          <div className="grid gap-2">
            <Label htmlFor="adjust-quantity">Quantity</Label>
            <Input
              id="adjust-quantity"
              type="number"
              min="0"
              placeholder="Enter quantity"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>

          {/* Reason */}
          <div className="grid gap-2">
            <Label htmlFor="adjust-reason">Reason</Label>
            <Input
              id="adjust-reason"
              placeholder="e.g. Received shipment, Damaged goods..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          {/* New Stock Level Preview */}
          <div className="rounded-lg border border-dashed border-cream-300 bg-cream-50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                New Stock Level
              </span>
              <span
                className={cn(
                  "text-2xl font-bold",
                  newStockLevel <= (product.reorderLevel / 2)
                    ? "text-red-600"
                    : newStockLevel <= product.reorderLevel
                      ? "text-amber-600"
                      : "text-emerald-600"
                )}
              >
                {quantity ? newStockLevel : "--"}
              </span>
            </div>
            {quantity && newStockLevel <= product.reorderLevel && (
              <p className="text-xs text-amber-600 mt-1">
                Below reorder level ({product.reorderLevel})
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!quantity}>
            Adjust Stock
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
