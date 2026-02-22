"use client"

import React, { useState, useEffect } from "react"
import { DoorOpen, Wrench, Save } from "lucide-react"
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
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { createResource, updateResource } from "@/lib/actions/resources"

export interface ResourceFormData {
  id?: string
  name: string
  type: string
  description: string
  capacity: number
  isActive: boolean
  serviceIds: string[]
}

interface ServiceOption {
  id: string
  name: string
  category: string
}

interface ResourceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  resource?: ResourceFormData | null
  services: ServiceOption[]
  onSaved?: () => void
}

const defaultForm: ResourceFormData = {
  name: "",
  type: "room",
  description: "",
  capacity: 1,
  isActive: true,
  serviceIds: [],
}

export function ResourceDialog({
  open,
  onOpenChange,
  resource,
  services,
  onSaved,
}: ResourceDialogProps) {
  const [form, setForm] = useState<ResourceFormData>(defaultForm)
  const [isSaving, setIsSaving] = useState(false)
  const isEditing = !!resource?.id

  useEffect(() => {
    if (open) {
      setForm(resource ? { ...resource } : { ...defaultForm })
    }
  }, [open, resource])

  function updateField<K extends keyof ResourceFormData>(
    key: K,
    value: ResourceFormData[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function toggleService(serviceId: string) {
    setForm((prev) => ({
      ...prev,
      serviceIds: prev.serviceIds.includes(serviceId)
        ? prev.serviceIds.filter((id) => id !== serviceId)
        : [...prev.serviceIds, serviceId],
    }))
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("Resource name is required")
      return
    }

    setIsSaving(true)
    try {
      if (isEditing && resource?.id) {
        const result = await updateResource(resource.id, {
          name: form.name.trim(),
          type: form.type,
          description: form.description.trim() || undefined,
          capacity: form.capacity,
          isActive: form.isActive,
          serviceIds: form.serviceIds,
        })
        if (result.success) {
          toast.success("Resource updated", {
            description: `${form.name} has been updated.`,
          })
        } else {
          toast.error(`Failed to update: ${result.error}`)
          setIsSaving(false)
          return
        }
      } else {
        const result = await createResource({
          name: form.name.trim(),
          type: form.type,
          description: form.description.trim() || undefined,
          capacity: form.capacity,
          serviceIds: form.serviceIds,
        })
        if (result.success) {
          toast.success("Resource created", {
            description: `${form.name} has been added.`,
          })
        } else {
          toast.error(`Failed to create: ${result.error}`)
          setIsSaving(false)
          return
        }
      }
      onSaved?.()
      onOpenChange(false)
    } catch {
      toast.error("An unexpected error occurred")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {form.type === "room" ? (
              <DoorOpen className="w-5 h-5 text-sal-500" />
            ) : (
              <Wrench className="w-5 h-5 text-sal-500" />
            )}
            {isEditing ? "Edit Resource" : "Add Resource"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the resource details below."
              : "Add a new room or piece of equipment to your business."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="resource-name">Name *</Label>
            <Input
              id="resource-name"
              placeholder="e.g., Treatment Room 1, Hair Dryer"
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              autoFocus
            />
          </div>

          {/* Type Selector */}
          <div className="space-y-2">
            <Label>Type</Label>
            <div className="flex gap-3">
              {[
                { value: "room", label: "Room", icon: DoorOpen },
                { value: "equipment", label: "Equipment", icon: Wrench },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => updateField("type", option.value)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border text-sm font-medium transition-all duration-200",
                    form.type === option.value
                      ? "bg-sal-500 text-white border-sal-500 shadow-md shadow-sal-500/20"
                      : "bg-card text-muted-foreground border-cream-200 dark:border-cream-800 hover:border-sal-300"
                  )}
                >
                  <option.icon className="w-4 h-4" />
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="resource-desc">Description</Label>
            <Textarea
              id="resource-desc"
              placeholder="Optional details about this resource..."
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              rows={3}
            />
          </div>

          {/* Capacity */}
          <div className="space-y-2">
            <Label htmlFor="resource-capacity">
              Capacity
              <span className="text-muted-foreground font-normal ml-1">
                ({form.type === "room" ? "max people" : "units available"})
              </span>
            </Label>
            <Input
              id="resource-capacity"
              type="number"
              min={1}
              max={100}
              value={form.capacity}
              onChange={(e) =>
                updateField("capacity", Math.max(1, parseInt(e.target.value) || 1))
              }
              className="w-32"
            />
          </div>

          {/* Service Assignment */}
          {services.length > 0 && (
            <div className="space-y-2">
              <Label>Assigned Services</Label>
              <p className="text-xs text-muted-foreground">
                Select which services use this resource.
              </p>
              <ScrollArea className="h-40 rounded-lg border border-cream-200 dark:border-cream-800 p-3">
                <div className="space-y-2">
                  {services.map((service) => (
                    <label
                      key={service.id}
                      className="flex items-center gap-3 py-1.5 px-2 rounded-md hover:bg-cream-100 dark:hover:bg-cream-900 cursor-pointer transition-colors"
                    >
                      <Checkbox
                        checked={form.serviceIds.includes(service.id)}
                        onCheckedChange={() => toggleService(service.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {service.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {service.category}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </ScrollArea>
              {form.serviceIds.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {form.serviceIds.length} service
                  {form.serviceIds.length !== 1 ? "s" : ""} selected
                </p>
              )}
            </div>
          )}

          {/* Active Toggle (editing only) */}
          {isEditing && (
            <div className="flex items-center justify-between py-2">
              <div className="space-y-0.5">
                <Label>Active</Label>
                <p className="text-xs text-muted-foreground">
                  Inactive resources won&apos;t be available for booking.
                </p>
              </div>
              <Switch
                checked={form.isActive}
                onCheckedChange={(checked) => updateField("isActive", checked)}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? "Saving..." : isEditing ? "Update Resource" : "Add Resource"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
