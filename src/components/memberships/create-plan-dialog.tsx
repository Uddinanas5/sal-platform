"use client"

import React, { useState } from "react"
import { Plus, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const colorOptions = [
  "#CD7F32", "#C0C0C0", "#FFD700", "#E5E4E2",
  "#059669", "#8b5cf6", "#ec4899", "#06b6d4",
  "#f97316", "#ef4444", "#3b82f6", "#14b8a6",
]

interface CreatePlanDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreatePlanDialog({ open, onOpenChange }: CreatePlanDialogProps) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [price, setPrice] = useState("")
  const [interval, setInterval] = useState<"monthly" | "yearly">("monthly")
  const [discount, setDiscount] = useState("")
  const [maxServices, setMaxServices] = useState("")
  const [unlimitedServices, setUnlimitedServices] = useState(false)
  const [features, setFeatures] = useState<string[]>([])
  const [newFeature, setNewFeature] = useState("")
  const [selectedColor, setSelectedColor] = useState(colorOptions[0])

  const handleAddFeature = () => {
    if (newFeature.trim()) {
      setFeatures([...features, newFeature.trim()])
      setNewFeature("")
    }
  }

  const handleRemoveFeature = (index: number) => {
    setFeatures(features.filter((_, i) => i !== index))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleAddFeature()
    }
  }

  const handleSave = () => {
    if (!name.trim() || !price) {
      toast.error("Please fill in required fields")
      return
    }

    toast.success("Membership plan created", {
      description: `"${name}" plan has been created successfully.`,
    })

    // Reset form
    setName("")
    setDescription("")
    setPrice("")
    setInterval("monthly")
    setDiscount("")
    setMaxServices("")
    setUnlimitedServices(false)
    setFeatures([])
    setNewFeature("")
    setSelectedColor(colorOptions[0])
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Membership Plan</DialogTitle>
          <DialogDescription>
            Set up a new membership tier for your clients.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Plan Name */}
          <div className="space-y-2">
            <Label>Plan Name *</Label>
            <Input
              placeholder="e.g., Platinum"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              placeholder="Brief description of the membership plan"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          {/* Price & Interval */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Price *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground/70">
                  $
                </span>
                <Input
                  type="number"
                  placeholder="99"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="pl-7"
                  min="0"
                  step="1"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Interval</Label>
              <Select
                value={interval}
                onValueChange={(v) => setInterval(v as "monthly" | "yearly")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Discount */}
          <div className="space-y-2">
            <Label>Discount %</Label>
            <div className="relative">
              <Input
                type="number"
                placeholder="10"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                min="0"
                max="100"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground/70">
                %
              </span>
            </div>
          </div>

          {/* Max Services */}
          <div className="space-y-2">
            <Label>Max Services per Visit</Label>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                placeholder="4"
                value={unlimitedServices ? "" : maxServices}
                onChange={(e) => setMaxServices(e.target.value)}
                disabled={unlimitedServices}
                min="1"
                className="flex-1"
              />
              <div className="flex items-center gap-2">
                <Checkbox
                  id="unlimited"
                  checked={unlimitedServices}
                  onCheckedChange={(checked) =>
                    setUnlimitedServices(checked as boolean)
                  }
                />
                <label
                  htmlFor="unlimited"
                  className="text-sm text-muted-foreground cursor-pointer"
                >
                  Unlimited
                </label>
              </div>
            </div>
          </div>

          {/* Features */}
          <div className="space-y-2">
            <Label>Features</Label>
            <div className="flex items-center gap-2">
              <Input
                placeholder="e.g., Priority booking"
                value={newFeature}
                onChange={(e) => setNewFeature(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleAddFeature}
                disabled={!newFeature.trim()}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {features.length > 0 && (
              <div className="space-y-1.5 mt-2">
                {features.map((feature, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between bg-cream-50 px-3 py-1.5 rounded-lg border border-cream-200"
                  >
                    <span className="text-sm text-foreground">{feature}</span>
                    <button
                      onClick={() => handleRemoveFeature(index)}
                      className="text-muted-foreground/70 hover:text-red-500 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Color Picker */}
          <div className="space-y-2">
            <Label>Plan Color</Label>
            <div className="flex gap-2 flex-wrap">
              {colorOptions.map((color) => (
                <button
                  key={color}
                  onClick={() => setSelectedColor(color)}
                  className={cn(
                    "w-8 h-8 rounded-lg border-2 transition-all duration-200",
                    selectedColor === color
                      ? "border-foreground scale-110 shadow-md"
                      : "border-transparent hover:border-cream-300"
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Create Plan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
