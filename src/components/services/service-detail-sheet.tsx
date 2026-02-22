"use client"

import React, { useState } from "react"
import { motion } from "framer-motion"
import {
  Clock,
  DollarSign,
  Edit,
  Trash2,
  Users,
  Globe,
  Timer,
  Tag,
  Plus,
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
import { toast } from "sonner"

interface ServiceVariant {
  id: string
  name: string
  price: number
  duration: number
}

interface ServiceAddOn {
  id: string
  name: string
  price: number
}

const serviceVariants: Record<string, ServiceVariant[]> = {
  s1: [
    { id: "v1", name: "Short Hair", price: 35, duration: 30 },
    { id: "v2", name: "Medium Hair", price: 45, duration: 45 },
    { id: "v3", name: "Long Hair", price: 55, duration: 60 },
  ],
  s2: [
    { id: "v4", name: "Root Touch-Up", price: 95, duration: 75 },
    { id: "v5", name: "Full Color", price: 150, duration: 120 },
    { id: "v6", name: "Balayage", price: 200, duration: 150 },
  ],
  s3: [
    { id: "v7", name: "30-Minute Session", price: 55, duration: 30 },
    { id: "v8", name: "60-Minute Session", price: 95, duration: 60 },
    { id: "v9", name: "90-Minute Session", price: 130, duration: 90 },
  ],
  s4: [
    { id: "v10", name: "Manicure Only", price: 30, duration: 30 },
    { id: "v11", name: "Pedicure Only", price: 40, duration: 45 },
    { id: "v12", name: "Mani-Pedi Combo", price: 65, duration: 75 },
  ],
  s5: [
    { id: "v13", name: "Express Facial", price: 55, duration: 30 },
    { id: "v14", name: "Classic Facial", price: 85, duration: 60 },
    { id: "v15", name: "Premium Facial", price: 120, duration: 90 },
  ],
}

const serviceAddOns: Record<string, ServiceAddOn[]> = {
  s1: [
    { id: "a1", name: "Deep Conditioning", price: 15 },
    { id: "a2", name: "Scalp Treatment", price: 20 },
    { id: "a3", name: "Hot Towel Service", price: 10 },
  ],
  s2: [
    { id: "a4", name: "Toner Treatment", price: 25 },
    { id: "a5", name: "Olaplex Add-On", price: 35 },
  ],
  s3: [
    { id: "a6", name: "Aromatherapy", price: 15 },
    { id: "a7", name: "Hot Stones Add-On", price: 25 },
    { id: "a8", name: "CBD Oil Upgrade", price: 20 },
  ],
  s4: [
    { id: "a9", name: "Gel Polish Upgrade", price: 15 },
    { id: "a10", name: "Nail Art (per nail)", price: 5 },
  ],
  s5: [
    { id: "a11", name: "LED Light Therapy", price: 20 },
    { id: "a12", name: "Dermaplaning", price: 30 },
    { id: "a13", name: "Eye Mask Treatment", price: 15 },
  ],
}

function getDefaultVariants(service: Service): ServiceVariant[] {
  return serviceVariants[service.id] ?? [
    { id: "dv1", name: "Standard", price: service.price, duration: service.duration },
    { id: "dv2", name: "Premium", price: Math.round(service.price * 1.3), duration: service.duration + 15 },
  ]
}

function getDefaultAddOns(service: Service): ServiceAddOn[] {
  return serviceAddOns[service.id] ?? [
    { id: "da1", name: "Extended Time (+15 min)", price: 20 },
    { id: "da2", name: "Premium Products Upgrade", price: 25 },
  ]
}

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
  const [isEditing, setIsEditing] = useState(false)
  const [onlineBooking, setOnlineBooking] = useState(true)

  if (!service) return null

  const qualifiedStaff = staff.filter((s) =>
    s.services.includes(service.id)
  )
  const variants = getDefaultVariants(service)
  const addOns = getDefaultAddOns(service)

  const handleDelete = () => {
    toast.success(`"${service.name}" deleted successfully`)
    onOpenChange(false)
  }

  const handleSaveEdit = () => {
    toast.success(`"${service.name}" updated successfully`)
    setIsEditing(false)
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
                  onSave={() => handleSaveEdit()}
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
                    <DollarSign className="w-5 h-5 text-sal-600" />
                    <div>
                      <p className="text-xs text-muted-foreground">Price</p>
                      <p className="font-semibold text-foreground">
                        {formatCurrency(service.price)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-cream-100">
                    <Clock className="w-5 h-5 text-sal-600" />
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
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
                    <Timer className="w-5 h-5 text-amber-600" />
                    <div>
                      <p className="text-xs text-amber-700">Processing Time</p>
                      <p className="font-medium text-amber-900">
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

                {/* Variants */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-foreground flex items-center gap-2">
                      <Tag className="w-4 h-4" />
                      Variants
                    </h3>
                    <Button variant="ghost" size="sm">
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Add
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {variants.map((variant) => (
                      <motion.div
                        key={variant.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center justify-between p-3 rounded-lg bg-cream-50 border border-cream-200"
                      >
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {variant.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDuration(variant.duration)}
                          </p>
                        </div>
                        <span className="font-semibold text-foreground">
                          {formatCurrency(variant.price)}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Add-ons */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-foreground flex items-center gap-2">
                      <Plus className="w-4 h-4" />
                      Add-ons
                    </h3>
                    <Button variant="ghost" size="sm">
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Add
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {addOns.map((addon) => (
                      <motion.div
                        key={addon.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center justify-between p-3 rounded-lg bg-cream-50 border border-cream-200"
                      >
                        <p className="text-sm font-medium text-foreground">
                          {addon.name}
                        </p>
                        <span className="font-semibold text-sal-600">
                          +{formatCurrency(addon.price)}
                        </span>
                      </motion.div>
                    ))}
                  </div>
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
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Service
                  </Button>
                  <Button
                    variant="outline"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={handleDelete}
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
