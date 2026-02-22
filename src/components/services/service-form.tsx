"use client"

import React, { useState } from "react"
import { Palette } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { Service, Staff } from "@/data/mock-data"
import { toast } from "sonner"

const categories = ["Hair", "Wellness", "Nails", "Skincare", "Brows & Lashes", "Body"]

const durationOptions = [15, 20, 30, 45, 60, 75, 90, 120, 150]

const colorOptions = [
  "#059669", "#8b5cf6", "#10b981", "#ec4899", "#06b6d4",
  "#f59e0b", "#ef4444", "#3b82f6", "#84cc16", "#6366f1",
  "#f97316", "#14b8a6", "#a855f7",
]

interface ServiceFormProps {
  service?: Service
  staff?: Staff[]
  onSave: (data: ServiceFormData) => void
  onCancel: () => void
  mode?: "create" | "edit"
}

export interface ServiceFormData {
  name: string
  description: string
  category: string
  duration: number
  price: number
  processingTime?: number
  color: string
  isActive: boolean
  onlineBooking: boolean
  assignedStaff: string[]
}

export function ServiceForm({ service, staff = [], onSave, onCancel, mode = "create" }: ServiceFormProps) {
  const [name, setName] = useState(service?.name ?? "")
  const [description, setDescription] = useState(service?.description ?? "")
  const [category, setCategory] = useState(service?.category ?? "")
  const [duration, setDuration] = useState(service?.duration ?? 45)
  const [price, setPrice] = useState(service?.price ?? 0)
  const [processingTime, setProcessingTime] = useState(service?.processingTime ?? 0)
  const [color, setColor] = useState(service?.color ?? "#059669")
  const [isActive] = useState(service?.isActive ?? true)
  const [onlineBooking, setOnlineBooking] = useState(true)
  const [assignedStaff, setAssignedStaff] = useState<string[]>(
    service
      ? staff.filter((s) => s.services.includes(service.id)).map((s) => s.id)
      : []
  )

  const handleStaffToggle = (staffId: string) => {
    setAssignedStaff((prev) =>
      prev.includes(staffId)
        ? prev.filter((id) => id !== staffId)
        : [...prev, staffId]
    )
  }

  const handleSubmit = () => {
    if (!name.trim()) {
      toast.error("Service name is required")
      return
    }
    if (!category) {
      toast.error("Please select a category")
      return
    }
    if (price <= 0) {
      toast.error("Please enter a valid price")
      return
    }

    onSave({
      name,
      description,
      category,
      duration,
      price,
      processingTime: processingTime > 0 ? processingTime : undefined,
      color,
      isActive,
      onlineBooking,
      assignedStaff,
    })
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label>Service Name</Label>
        <Input
          placeholder="e.g., Classic Haircut"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea
          placeholder="Brief description of the service"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label>Category</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger>
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
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Duration</Label>
          <Select
            value={duration.toString()}
            onValueChange={(v) => setDuration(Number(v))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {durationOptions.map((d) => (
                <SelectItem key={d} value={d.toString()}>
                  {d} min
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Price ($)</Label>
          <Input
            type="number"
            min={0}
            step={5}
            value={price || ""}
            onChange={(e) => setPrice(Number(e.target.value))}
            placeholder="50"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Processing Time (optional, min)</Label>
        <Input
          type="number"
          min={0}
          step={5}
          value={processingTime || ""}
          onChange={(e) => setProcessingTime(Number(e.target.value))}
          placeholder="0"
        />
        <p className="text-xs text-muted-foreground">
          Extra wait time during the service (e.g., color processing)
        </p>
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Palette className="w-4 h-4" />
          Service Color
        </Label>
        <div className="flex gap-2 flex-wrap">
          {colorOptions.map((c) => (
            <button
              key={c}
              type="button"
              className={cn(
                "w-8 h-8 rounded-lg border-2 transition-all",
                color === c
                  ? "border-foreground scale-110 ring-2 ring-cream-300"
                  : "border-transparent hover:border-cream-300"
              )}
              style={{ backgroundColor: c }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <Label>Online Booking</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Allow clients to book this service online
          </p>
        </div>
        <Switch checked={onlineBooking} onCheckedChange={setOnlineBooking} />
      </div>

      <div className="space-y-3">
        <Label>Assign Staff</Label>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {staff.map((member) => (
            <label
              key={member.id}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-cream-100 cursor-pointer transition-colors"
            >
              <Checkbox
                checked={assignedStaff.includes(member.id)}
                onCheckedChange={() => handleStaffToggle(member.id)}
              />
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: member.color }}
              />
              <span className="text-sm font-medium">{member.name}</span>
              <span className="text-xs text-muted-foreground/70 capitalize">
                {member.role}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSubmit}>
          {mode === "create" ? "Add Service" : "Save Changes"}
        </Button>
      </div>
    </div>
  )
}
