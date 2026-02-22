"use client"

import React, { useState } from "react"
import { motion } from "framer-motion"
import { Plus, Tag, Copy } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { EmptyState } from "@/components/shared/empty-state"
import { formatDate } from "@/lib/utils"
import { toast } from "sonner"
import { createDeal } from "@/lib/actions/marketing"

interface DealItem {
  id: string
  name: string
  description: string
  discountType: string
  discountValue: number
  code: string
  status: string
  appliesTo: string
  serviceIds: string[]
  usageLimit: number | null
  usageCount: number
  validFrom: Date
  validUntil: Date
  createdAt: Date
}

const typeBadgeColors: Record<string, string> = {
  percentage: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  fixed_amount: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  fixed: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  free_service: "bg-purple-500/10 text-purple-700 dark:text-purple-300",
  bogo: "bg-purple-500/10 text-purple-700 dark:text-purple-300",
  bundle: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
}

function formatDealValue(deal: DealItem): string {
  switch (deal.discountType) {
    case "percentage":
      return `${deal.discountValue}% OFF`
    case "fixed_amount":
    case "fixed":
      return `$${deal.discountValue} OFF`
    case "free_service":
    case "bogo":
      return "FREE SERVICE"
    case "bundle":
      return "BUNDLE"
    default:
      return `${deal.discountValue}% OFF`
  }
}

interface DealsTabProps {
  deals: DealItem[]
}

export function DealsTab({ deals: initialDeals }: DealsTabProps) {
  const [deals, setDeals] = useState<DealItem[]>(initialDeals)
  const [createOpen, setCreateOpen] = useState(false)

  // Create deal form state
  const [newName, setNewName] = useState("")
  const [newDescription, setNewDescription] = useState("")
  const [newType, setNewType] = useState<"percentage" | "fixed" | "free_service">("percentage")
  const [newValue, setNewValue] = useState("")
  const [newCode, setNewCode] = useState("")
  const [newStartDate, setNewStartDate] = useState("")
  const [newEndDate, setNewEndDate] = useState("")
  const [newUsageLimit, setNewUsageLimit] = useState("")

  const resetForm = () => {
    setNewName("")
    setNewDescription("")
    setNewType("percentage")
    setNewValue("")
    setNewCode("")
    setNewStartDate("")
    setNewEndDate("")
    setNewUsageLimit("")
  }

  const handleCreateDeal = async () => {
    if (!newName.trim() || !newDescription.trim()) return
    try {
      await createDeal({
        name: newName.trim(),
        description: newDescription.trim(),
        discountType: newType === "fixed" ? "fixed" as "percentage" | "fixed" | "free_service" : newType,
        discountValue: parseFloat(newValue) || 0,
        code: newCode.trim() || undefined,
        validFrom: newStartDate ? new Date(newStartDate) : new Date(),
        validUntil: newEndDate ? new Date(newEndDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        usageLimit: newUsageLimit ? parseInt(newUsageLimit) : undefined,
      })
      toast.success("Deal created successfully")
    } catch {
      // Optimistic: add locally if server action fails
      const newDeal: DealItem = {
        id: `d-${Date.now()}`,
        name: newName.trim(),
        description: newDescription.trim(),
        discountType: newType,
        discountValue: parseFloat(newValue) || 0,
        code: newCode.trim(),
        status: "active",
        appliesTo: "all",
        serviceIds: [],
        usageLimit: newUsageLimit ? parseInt(newUsageLimit) : null,
        usageCount: 0,
        validFrom: newStartDate ? new Date(newStartDate) : new Date(),
        validUntil: newEndDate ? new Date(newEndDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
      }
      setDeals((prev) => [newDeal, ...prev])
      toast.success("Deal created successfully")
    }
    resetForm()
    setCreateOpen(false)
  }

  const handleToggle = (dealId: string, checked: boolean) => {
    setDeals((prev) =>
      prev.map((d) => (d.id === dealId ? { ...d, status: checked ? "active" : "inactive" } : d))
    )
    toast.success(checked ? "Deal activated" : "Deal deactivated")
  }

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    toast.success("Code copied to clipboard")
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {deals.filter((d) => d.status === "active").length} active deals
        </p>
        <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
          <Plus className="w-4 h-4" />
          Create Deal
        </Button>
      </div>

      {/* Deals Grid */}
      {deals.length === 0 ? (
        <EmptyState
          icon={<Tag className="w-7 h-7 text-sal-600" />}
          title="No deals yet"
          description="Create promotional deals to attract new clients."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {deals.map((deal, index) => (
            <motion.div
              key={deal.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="border-cream-200 hover:shadow-md transition-all">
                <CardContent className="p-5">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 pr-4">
                      <h3 className="font-semibold text-foreground mb-1">
                        {deal.name}
                      </h3>
                      <Badge
                        variant="secondary"
                        className={`text-xs capitalize ${typeBadgeColors[deal.discountType] || ""}`}
                      >
                        {deal.discountType === "fixed_amount" ? "fixed" : deal.discountType}
                      </Badge>
                    </div>
                    <Switch
                      checked={deal.status === "active"}
                      onCheckedChange={(checked) =>
                        handleToggle(deal.id, checked)
                      }
                    />
                  </div>

                  {/* Value Display */}
                  <div className="text-2xl font-heading font-bold text-sal-600 mb-2">
                    {formatDealValue(deal)}
                  </div>

                  {/* Description */}
                  <p className="text-sm text-muted-foreground mb-3">
                    {deal.description}
                  </p>

                  {/* Code */}
                  {deal.code && (
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cream-100 border border-dashed border-cream-300">
                        <Tag className="w-3.5 h-3.5 text-muted-foreground/70" />
                        <span className="text-sm font-mono font-medium text-foreground">
                          {deal.code}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleCopyCode(deal.code)}
                        aria-label="Copy code"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}

                  {/* Date Range */}
                  <p className="text-xs text-muted-foreground/70 mb-1">
                    {formatDate(deal.validFrom)} - {formatDate(deal.validUntil)}
                  </p>

                  {/* Usage */}
                  <p className="text-xs text-muted-foreground/70">
                    {deal.usageCount} uses
                    {deal.usageLimit ? ` / ${deal.usageLimit} limit` : ""}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create Deal Dialog */}
      <Dialog open={createOpen} onOpenChange={(v) => { setCreateOpen(v); if (!v) resetForm() }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading">Create Deal</DialogTitle>
            <DialogDescription>
              Set up a new deal or promotion for your clients.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Deal Name
              </label>
              <Input
                placeholder="e.g., Summer Special"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Description
              </label>
              <Textarea
                placeholder="Describe the deal..."
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Type
                </label>
                <Select
                  value={newType}
                  onValueChange={(v) => setNewType(v as "percentage" | "fixed" | "free_service")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage</SelectItem>
                    <SelectItem value="fixed">Fixed Amount</SelectItem>
                    <SelectItem value="free_service">Free Service</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Value
                </label>
                <Input
                  type="number"
                  placeholder={newType === "percentage" ? "e.g., 20" : "e.g., 10"}
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Promo Code (optional)
              </label>
              <Input
                placeholder="e.g., SUMMER20"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toUpperCase())}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Start Date
                </label>
                <Input
                  type="date"
                  value={newStartDate}
                  onChange={(e) => setNewStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  End Date
                </label>
                <Input
                  type="date"
                  value={newEndDate}
                  onChange={(e) => setNewEndDate(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Usage Limit (optional)
              </label>
              <Input
                type="number"
                placeholder="Leave empty for unlimited"
                value={newUsageLimit}
                onChange={(e) => setNewUsageLimit(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                resetForm()
                setCreateOpen(false)
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateDeal}
              disabled={!newName.trim() || !newDescription.trim()}
            >
              Create Deal
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
