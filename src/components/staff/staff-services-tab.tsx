"use client"

import React, { useState, useTransition } from "react"
import { motion } from "framer-motion"
import { Save, Check, Scissors } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn, formatCurrency } from "@/lib/utils"
import { updateStaffServices } from "@/lib/actions/staff"
import { toast } from "sonner"

interface ServiceItem {
  id: string
  name: string
  description: string
  duration: number
  price: number
  category: string
  color: string
}

interface StaffServicesTabProps {
  staffId: string
  services: ServiceItem[]
  assignedServiceIds: string[]
}

export function StaffServicesTab({
  staffId,
  services,
  assignedServiceIds,
}: StaffServicesTabProps) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(assignedServiceIds)
  )
  const [isPending, startTransition] = useTransition()

  const toggleService = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleSave = () => {
    startTransition(async () => {
      const result = await updateStaffServices({
        staffId,
        serviceIds: Array.from(selected),
      })
      if (result.success) {
        toast.success("Services updated successfully")
      } else {
        toast.error(result.error ?? "Failed to update services")
      }
    })
  }

  // Group services by category
  const grouped = services.reduce<Record<string, ServiceItem[]>>((acc, svc) => {
    const cat = svc.category || "Uncategorized"
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(svc)
    return acc
  }, {})

  const categories = Object.keys(grouped).sort()
  const selectedCount = selected.size

  return (
    <div className="space-y-6">
      {/* Header summary */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {selectedCount} of {services.length} service{services.length !== 1 ? "s" : ""} assigned
          </p>
        </div>
        <Button onClick={handleSave} disabled={isPending}>
          <Save className="w-4 h-4 mr-2" />
          {isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      {services.length === 0 ? (
        <Card>
          <CardContent className="p-8 flex flex-col items-center justify-center text-center">
            <Scissors className="w-10 h-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No services found</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Add services to your business first, then assign them to staff members.
            </p>
          </CardContent>
        </Card>
      ) : (
        categories.map((category, catIndex) => (
          <motion.div
            key={category}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: catIndex * 0.05 }}
          >
            <Card>
              <CardContent className="p-4">
                <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-faint">
                  {category}
                </h3>
                <div className="space-y-2">
                  {grouped[category].map((service, index) => {
                    const isSelected = selected.has(service.id)
                    return (
                      <motion.button
                        key={service.id}
                        type="button"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: catIndex * 0.05 + index * 0.03 }}
                        onClick={() => toggleService(service.id)}
                        className={cn(
                          "w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left",
                          isSelected
                            ? "border-mint/30 bg-sal-50"
                            : "border-cream-200 bg-white/[0.04] hover:border-cream-300 hover:bg-white/[0.07]"
                        )}
                      >
                        {/* Checkbox indicator */}
                        <div
                          className={cn(
                            "w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all",
                            isSelected
                              ? "border-sal-500 bg-sal-500"
                              : "border-cream-300 bg-transparent"
                          )}
                        >
                          {isSelected && (
                            <Check className="w-3 h-3 text-white" strokeWidth={3} />
                          )}
                        </div>

                        {/* Color dot */}
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: service.color }}
                        />

                        {/* Service info */}
                        <div className="flex-1 min-w-0">
                          <p
                            className={cn(
                              "text-sm font-medium truncate",
                              isSelected ? "text-foreground" : "text-foreground"
                            )}
                          >
                            {service.name}
                          </p>
                          {service.description && (
                            <p className="text-xs text-muted-foreground truncate">
                              {service.description}
                            </p>
                          )}
                        </div>

                        {/* Duration and price badges */}
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="outline" className="text-xs font-normal">
                            {service.duration} min
                          </Badge>
                          <Badge
                            variant="secondary"
                            className={cn(
                              "text-xs font-medium",
                              isSelected
                                ? "bg-none bg-sal-100 text-mint-soft"
                                : ""
                            )}
                          >
                            {formatCurrency(service.price)}
                          </Badge>
                        </div>
                      </motion.button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))
      )}

      {services.length > 0 && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isPending}>
            <Save className="w-4 h-4 mr-2" />
            {isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      )}
    </div>
  )
}
