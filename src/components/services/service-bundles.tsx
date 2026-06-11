"use client"

import React, { useState } from "react"
import { motion } from "framer-motion"
import { Package, Check, Sparkles, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatCurrency } from "@/lib/utils"
import { toast } from "sonner"
import { createBundle, deleteBundle } from "@/lib/actions/bundles"

interface BundleData {
  id: string
  name: string
  description: string | null
  serviceIds: string[]
  originalPrice: number
  bundlePrice: number
  discountPercent: number
}

interface ServiceOption {
  id: string
  name: string
  price: number
}

interface ServiceBundlesProps {
  bundles?: BundleData[]
  services?: ServiceOption[]
}

const bundleColors = ["#059669", "#8b5cf6", "#ec4899", "#f97316", "#06b6d4"]

export function ServiceBundles({ bundles = [], services = [] }: ServiceBundlesProps) {
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([])
  const [bundlePrice, setBundlePrice] = useState("")
  const [saving, setSaving] = useState(false)

  const originalTotal = selectedServiceIds.reduce((sum, id) => {
    const svc = services.find((s) => s.id === id)
    return sum + (svc?.price || 0)
  }, 0)

  const handleCreate = async () => {
    if (!name.trim() || selectedServiceIds.length < 2 || !bundlePrice) {
      toast.error("Please fill all fields and select at least 2 services")
      return
    }
    setSaving(true)
    const result = await createBundle({
      name: name.trim(),
      description: description.trim() || undefined,
      serviceIds: selectedServiceIds,
      bundlePrice: parseFloat(bundlePrice),
    })
    setSaving(false)
    if (result.success) {
      toast.success("Bundle created")
      setCreateOpen(false)
      setName("")
      setDescription("")
      setSelectedServiceIds([])
      setBundlePrice("")
    } else {
      toast.error(result.error)
    }
  }

  const handleDelete = async (id: string) => {
    const result = await deleteBundle(id)
    if (result.success) {
      toast.success("Bundle deleted")
    } else {
      toast.error(result.error)
    }
  }

  const toggleService = (id: string) => {
    setSelectedServiceIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-mint" />
            <CardTitle className="text-lg font-heading">
              Service Bundles
            </CardTitle>
          </div>
          <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-1" />
            Create Bundle
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Bundled packages at special prices
        </p>
      </CardHeader>
      <CardContent>
        {bundles.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No bundles yet</p>
            <p className="text-sm mt-1">Create your first service bundle to offer package deals.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {bundles.map((bundle, index) => {
              const savings = bundle.originalPrice - bundle.bundlePrice
              const savingsPercent = bundle.originalPrice > 0
                ? Math.round((savings / bundle.originalPrice) * 100)
                : 0
              const bundleServices = bundle.serviceIds
                .map((id) => services.find((s) => s.id === id))
                .filter(Boolean) as ServiceOption[]
              const color = bundleColors[index % bundleColors.length]

              return (
                <motion.div
                  key={bundle.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="relative rounded-xl border border-cream-200 bg-card overflow-hidden hover:shadow-md transition-shadow group"
                >
                  <div className="h-1.5" style={{ backgroundColor: color }} />

                  {index === 0 && (
                    <div className="absolute top-4 right-3">
                      <Badge className="bg-sal-500 text-white text-xs">
                        <Sparkles className="w-3 h-3 mr-1" />
                        Popular
                      </Badge>
                    </div>
                  )}

                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <h4 className="font-semibold text-foreground">{bundle.name}</h4>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-red-500"
                        onClick={() => handleDelete(bundle.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    {bundle.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{bundle.description}</p>
                    )}

                    <Separator className="my-3" />

                    <div className="space-y-1.5 mb-4">
                      {bundleServices.map((svc, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5 text-mint-strong" />
                            <span className="text-foreground">{svc.name}</span>
                          </div>
                          <span className="text-muted-foreground/70 line-through text-xs">
                            {formatCurrency(svc.price)}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="bg-cream-100 rounded-lg p-3">
                      <div className="flex items-baseline justify-between">
                        <div>
                          <span className="text-xs text-muted-foreground line-through mr-2">
                            {formatCurrency(bundle.originalPrice)}
                          </span>
                          <span className="text-lg font-bold text-foreground">
                            {formatCurrency(bundle.bundlePrice)}
                          </span>
                        </div>
                        {savingsPercent > 0 && (
                          <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">
                            Save {savingsPercent}%
                          </Badge>
                        )}
                      </div>
                      {savings > 0 && (
                        <p className="text-xs text-mint font-medium mt-1">
                          You save {formatCurrency(savings)}
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </CardContent>

      {/* Create Bundle Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Service Bundle</DialogTitle>
            <DialogDescription>
              Select services and set a discounted bundle price.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Bundle Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Hair & Facial Package" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the bundle..." />
            </div>
            <div className="space-y-2">
              <Label>Select Services ({selectedServiceIds.length} selected)</Label>
              <div className="max-h-48 overflow-y-auto space-y-1 border border-cream-200 rounded-lg p-2">
                {services.map((svc) => (
                  <button
                    key={svc.id}
                    type="button"
                    onClick={() => toggleService(svc.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                      selectedServiceIds.includes(svc.id)
                        ? "bg-sal-50 border border-sal-200 text-mint-soft"
                        : "hover:bg-cream-100 text-foreground"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {selectedServiceIds.includes(svc.id) && <Check className="w-3.5 h-3.5 text-mint-strong" />}
                      {svc.name}
                    </span>
                    <span className="text-muted-foreground">{formatCurrency(svc.price)}</span>
                  </button>
                ))}
              </div>
              {selectedServiceIds.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Original total: {formatCurrency(originalTotal)}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Bundle Price</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  type="number"
                  value={bundlePrice}
                  onChange={(e) => setBundlePrice(e.target.value)}
                  className="pl-7"
                  placeholder="0.00"
                />
              </div>
              {bundlePrice && originalTotal > 0 && (
                <p className="text-xs text-mint font-medium">
                  {Math.round((1 - parseFloat(bundlePrice) / originalTotal) * 100)}% discount
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving || selectedServiceIds.length < 2 || !name.trim()}>
              {saving ? "Creating..." : "Create Bundle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
