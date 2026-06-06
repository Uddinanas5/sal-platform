"use client"

import React, { useState, useEffect } from "react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { createMembershipPlan, updateMembershipPlan } from "@/lib/actions/memberships"

type BillingCycle = "monthly" | "quarterly" | "yearly" | "one_time"

export interface EditablePlan {
  id: string
  name: string
  description: string | null
  price: number
  billingCycle: string
  benefits: string[]
  discountPercent?: number | null
}

interface CreatePlanDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When provided, the dialog operates in edit mode and updates this plan. */
  plan?: EditablePlan | null
  /** Called after a successful create/update so the parent can refresh data. */
  onSaved?: () => void
}

const billingOptions: { value: BillingCycle; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
  { value: "one_time", label: "One-time" },
]

export function CreatePlanDialog({ open, onOpenChange, plan, onSaved }: CreatePlanDialogProps) {
  const isEdit = Boolean(plan)

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [price, setPrice] = useState("")
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly")
  const [discount, setDiscount] = useState("")
  const [features, setFeatures] = useState<string[]>([])
  const [newFeature, setNewFeature] = useState("")
  const [saving, setSaving] = useState(false)

  // Hydrate from the plan being edited (or reset) whenever the dialog opens.
  useEffect(() => {
    if (!open) return
    if (plan) {
      setName(plan.name)
      setDescription(plan.description ?? "")
      setPrice(String(plan.price))
      setBillingCycle((plan.billingCycle as BillingCycle) || "monthly")
      setDiscount(plan.discountPercent != null ? String(plan.discountPercent) : "")
      setFeatures(plan.benefits ?? [])
    } else {
      setName("")
      setDescription("")
      setPrice("")
      setBillingCycle("monthly")
      setDiscount("")
      setFeatures([])
    }
    setNewFeature("")
  }, [open, plan])

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

  const handleSave = async () => {
    const priceNum = Number(price)
    if (!name.trim() || price === "" || Number.isNaN(priceNum) || priceNum < 0) {
      toast.error("Please enter a name and a valid price")
      return
    }
    const discountNum = discount === "" ? undefined : Number(discount)
    if (discountNum !== undefined && (Number.isNaN(discountNum) || discountNum < 0 || discountNum > 100)) {
      toast.error("Discount must be between 0 and 100")
      return
    }

    setSaving(true)
    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      price: priceNum,
      billingCycle,
      discountPercent: discountNum,
      benefits: features,
    }

    const result = isEdit && plan
      ? await updateMembershipPlan(plan.id, payload)
      : await createMembershipPlan(payload)
    setSaving(false)

    if (!result.success) {
      toast.error(result.error)
      return
    }

    toast.success(isEdit ? "Membership plan updated" : "Membership plan created", {
      description: `"${name.trim()}" has been saved.`,
    })
    onSaved?.()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Membership Plan" : "Create Membership Plan"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update this membership tier."
              : "Set up a new membership tier for your clients."}
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

          {/* Price & Billing Cycle */}
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
              <Label>Billing Cycle</Label>
              <Select
                value={billingCycle}
                onValueChange={(v) => setBillingCycle(v as BillingCycle)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {billingOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
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

          {/* Benefits */}
          <div className="space-y-2">
            <Label>Benefits</Label>
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
                      aria-label={`Remove ${feature}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Create Plan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
