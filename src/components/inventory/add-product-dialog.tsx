"use client"

import React, { useState } from "react"
import { Info } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

interface AddProductDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: string[]
}

export function AddProductDialog({ open, onOpenChange, categories }: AddProductDialogProps) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [sku, setSku] = useState("")
  const [category, setCategory] = useState("")
  const [costPrice, setCostPrice] = useState("")
  const [retailPrice, setRetailPrice] = useState("")
  const [stockLevel, setStockLevel] = useState("")
  const [reorderLevel, setReorderLevel] = useState("")
  const [supplier, setSupplier] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Clear a specific field error when user starts typing
  function clearError(field: string) {
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
  }

  function resetForm() {
    setName("")
    setDescription("")
    setSku("")
    setCategory("")
    setCostPrice("")
    setRetailPrice("")
    setStockLevel("")
    setReorderLevel("")
    setSupplier("")
    setErrors({})
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {}

    if (!name.trim()) {
      newErrors.name = "Product name is required"
    }
    if (!sku.trim()) {
      newErrors.sku = "SKU is required"
    }
    if (!category) {
      newErrors.category = "Category is required"
    }
    if (!costPrice || parseFloat(costPrice) <= 0) {
      newErrors.costPrice = "Cost price must be greater than 0"
    }
    if (!retailPrice || parseFloat(retailPrice) <= 0) {
      newErrors.retailPrice = "Retail price must be greater than 0"
    }
    if (!stockLevel || parseInt(stockLevel) < 0) {
      newErrors.stockLevel = "Stock level must be 0 or more"
    }
    if (!reorderLevel || parseInt(reorderLevel) < 0) {
      newErrors.reorderLevel = "Reorder level must be 0 or more"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  function handleSubmit() {
    if (!validate()) return

    toast.success("Product added successfully")
    resetForm()
    onOpenChange(false)
  }

  function handleCancel() {
    resetForm()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">Add New Product</DialogTitle>
          <DialogDescription>
            Add a new product to your inventory. Fill in the details below.
          </DialogDescription>
        </DialogHeader>

        <Separator />

        <div className="grid gap-4 py-2">
          {/* Name */}
          <div className="grid gap-2">
            <Label htmlFor="product-name">
              Product Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="product-name"
              placeholder="e.g. Professional Shampoo"
              value={name}
              onChange={(e) => { setName(e.target.value); clearError("name") }}
              className={cn(errors.name && "border-red-300 focus-visible:ring-red-400")}
            />
            {errors.name && (
              <p className="text-xs text-red-500">{errors.name}</p>
            )}
          </div>

          {/* Description */}
          <div className="grid gap-2">
            <Label htmlFor="product-description">Description</Label>
            <Textarea
              id="product-description"
              placeholder="Brief product description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={300}
              showCounter
            />
          </div>

          {/* SKU + Category */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="product-sku">
                SKU <span className="text-red-500">*</span>
              </Label>
              <Input
                id="product-sku"
                placeholder="e.g. HC-007"
                value={sku}
                onChange={(e) => { setSku(e.target.value); clearError("sku") }}
                className={cn(errors.sku && "border-red-300 focus-visible:ring-red-400")}
              />
              {errors.sku && (
                <p className="text-xs text-red-500">{errors.sku}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label>
                Category <span className="text-red-500">*</span>
              </Label>
              <Select value={category} onValueChange={(v) => { setCategory(v); clearError("category") }}>
                <SelectTrigger className={cn(errors.category && "border-red-300 focus:ring-red-400")}>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category && (
                <p className="text-xs text-red-500">{errors.category}</p>
              )}
            </div>
          </div>

          {/* Cost Price + Retail Price */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="product-cost" className="flex items-center gap-1">
                Cost Price ($) <span className="text-red-500">*</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground/50 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[200px] text-xs">
                      Your wholesale purchase price
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </Label>
              <Input
                id="product-cost"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={costPrice}
                onChange={(e) => { setCostPrice(e.target.value); clearError("costPrice") }}
                className={cn(errors.costPrice && "border-red-300 focus-visible:ring-red-400")}
              />
              {errors.costPrice && (
                <p className="text-xs text-red-500">{errors.costPrice}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="product-retail">
                Retail Price ($) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="product-retail"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={retailPrice}
                onChange={(e) => { setRetailPrice(e.target.value); clearError("retailPrice") }}
                className={cn(errors.retailPrice && "border-red-300 focus-visible:ring-red-400")}
              />
              {errors.retailPrice && (
                <p className="text-xs text-red-500">{errors.retailPrice}</p>
              )}
            </div>
          </div>

          {/* Stock Level + Reorder Level */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="product-stock">
                Stock Level <span className="text-red-500">*</span>
              </Label>
              <Input
                id="product-stock"
                type="number"
                min="0"
                placeholder="0"
                value={stockLevel}
                onChange={(e) => { setStockLevel(e.target.value); clearError("stockLevel") }}
                className={cn(errors.stockLevel && "border-red-300 focus-visible:ring-red-400")}
              />
              {errors.stockLevel && (
                <p className="text-xs text-red-500">{errors.stockLevel}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="product-reorder" className="flex items-center gap-1">
                Reorder Level <span className="text-red-500">*</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground/50 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[200px] text-xs">
                      Alert when stock falls below this level
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </Label>
              <Input
                id="product-reorder"
                type="number"
                min="0"
                placeholder="0"
                value={reorderLevel}
                onChange={(e) => { setReorderLevel(e.target.value); clearError("reorderLevel") }}
                className={cn(errors.reorderLevel && "border-red-300 focus-visible:ring-red-400")}
              />
              {errors.reorderLevel && (
                <p className="text-xs text-red-500">{errors.reorderLevel}</p>
              )}
            </div>
          </div>

          {/* Supplier */}
          <div className="grid gap-2">
            <Label htmlFor="product-supplier">Supplier</Label>
            <Input
              id="product-supplier"
              placeholder="e.g. ProBeauty Supply"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {Object.keys(errors).length > 0 && (
            <p className="text-xs text-red-500 mr-auto">
              Please fix {Object.keys(errors).length} error{Object.keys(errors).length > 1 ? "s" : ""} above
            </p>
          )}
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Add Product</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
