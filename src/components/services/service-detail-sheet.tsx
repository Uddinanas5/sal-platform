"use client"

import React, { useState } from "react"
import {
  Clock,
  DollarSign,
  Edit,
  Trash2,
  Users,
  Globe,
  Timer,
} from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn, formatCurrency, formatDuration, getInitials } from "@/lib/utils"
import type { Service, Staff } from "@/data/mock-data"
import { ServiceForm } from "./service-form"
import type { ServiceFormData } from "./service-form"
import { updateService, deleteService } from "@/lib/actions/services"
import { useRouter } from "next/navigation"
import { toast } from "sonner"


interface ServiceDetailSheetProps {
  service: Service | null
  staff?: Staff[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ServiceDetailSheet({
  service,
  staff = [],
  open,
  onOpenChange,
}: ServiceDetailSheetProps) {
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [onlineBooking, setOnlineBooking] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  if (!service) return null

  const qualifiedStaff = staff.filter((s) =>
    s.services.includes(service.id)
  )

  const handleDelete = async () => {
    setIsDeleting(true)
    const result = await deleteService(service.id)
    setIsDeleting(false)
    if (result.success) {
      toast.success(`"${service.name}" deleted`)
      onOpenChange(false)
      router.refresh()
    } else {
      toast.error(result.error)
    }
  }

  const handleSaveEdit = async (data: ServiceFormData) => {
    setIsSaving(true)
    const result = await updateService(service.id, {
      name: data.name,
      description: data.description,
      duration: data.duration,
      price: data.price,
      color: data.color,
      isActive: data.isActive,
    })
    setIsSaving(false)
    if (result.success) {
      toast.success(`"${data.name}" updated`)
      setIsEditing(false)
      router.refresh()
    } else {
      toast.error(result.error)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0">
        <ScrollArea className="h-full">
          <div className="p-6">
            <SheetHeader className="mb-6">
              <SheetTitle className="sr-only">
                {isEditing ? `Edit ${service.name}` : service.name}
              </SheetTitle>
              <SheetDescription className="sr-only">
                {isEditing
                  ? `Edit details for ${service.name}`
                  : `View details for ${service.name}`}
              </SheetDescription>
            </SheetHeader>

            {isEditing ? (
              <div>
                <h2 className="text-lg font-heading font-semibold text-foreground mb-4">
                  Edit Service
                </h2>
                <ServiceForm
                  service={service}
                  staff={staff}
                  mode="edit"
                  onSave={handleSaveEdit}
                  onCancel={() => setIsEditing(false)}
                />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Header */}
                <div>
                  <div
                    className="h-3 rounded-full w-20 mb-4"
                    style={{ backgroundColor: service.color }}
                  />
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-xl font-heading font-semibold text-foreground">
                        {service.name}
                      </h2>
                      <Badge
                        variant="secondary"
                        className="mt-1.5 text-xs"
                      >
                        {service.category}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-3">
                    {service.description}
                  </p>
                </div>

                {/* Price & Duration */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-cream-100">
                    <DollarSign className="w-5 h-5 text-mint" />
                    <div>
                      <p className="text-xs text-muted-foreground">Price</p>
                      <p className="font-semibold text-foreground">
                        {formatCurrency(service.price)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-cream-100">
                    <Clock className="w-5 h-5 text-mint" />
                    <div>
                      <p className="text-xs text-muted-foreground">Duration</p>
                      <p className="font-semibold text-foreground">
                        {formatDuration(service.duration)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Processing Time */}
                {service.processingTime && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-400/10 border border-amber-400/30">
                    <Timer className="w-5 h-5 text-amber-400" />
                    <div>
                      <p className="text-xs text-amber-300">Processing Time</p>
                      <p className="font-medium text-amber-200">
                        {formatDuration(service.processingTime)} additional wait
                      </p>
                    </div>
                  </div>
                )}

                {/* Online Booking Toggle */}
                <div className="flex items-center justify-between p-3 rounded-xl border">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Online Booking</p>
                      <p className="text-xs text-muted-foreground">
                        Clients can book online
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={onlineBooking}
                    onCheckedChange={setOnlineBooking}
                  />
                </div>

                <Separator />

                {/* Qualified Staff */}
                <div>
                  <h3 className="font-semibold text-foreground flex items-center gap-2 mb-3">
                    <Users className="w-4 h-4" />
                    Qualified Staff ({qualifiedStaff.length})
                  </h3>
                  <div className="space-y-2">
                    {qualifiedStaff.map((staff) => (
                      <div
                        key={staff.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-cream-100 transition-colors"
                      >
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={staff.avatar} />
                          <AvatarFallback
                            className="text-xs font-medium"
                            style={{
                              backgroundColor: staff.color,
                              color: "white",
                            }}
                          >
                            {getInitials(staff.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">
                            {staff.name}
                          </p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {staff.role}
                          </p>
                        </div>
                        <div
                          className={cn(
                            "w-2 h-2 rounded-full",
                            staff.isActive ? "bg-green-500" : "bg-cream-300"
                          )}
                        />
                      </div>
                    ))}
                    {qualifiedStaff.length === 0 && (
                      <p className="text-sm text-muted-foreground/70 text-center py-4">
                        No staff assigned to this service
                      </p>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={() => setIsEditing(true)}
                    disabled={isSaving || isDeleting}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Service
                  </Button>
                  <Button
                    variant="outline"
                    className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
                    onClick={handleDelete}
                    disabled={isDeleting}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
