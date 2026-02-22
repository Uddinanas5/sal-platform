"use client"

import React, { useState } from "react"
import { motion } from "framer-motion"
import { useRouter } from "next/navigation"
import {
  Plus,
  Search,
  MoreVertical,
  Clock,
  DollarSign,
  Eye,
  EyeOff,
  GripVertical,
  Scissors,
  Pencil,
  Copy,
  ToggleLeft,
  Trash2,
} from "lucide-react"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { EmptyState } from "@/components/shared/empty-state"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { cn, formatCurrency } from "@/lib/utils"
import type { Service, Staff } from "@/data/mock-data"
import { ServiceDetailSheet } from "@/components/services/service-detail-sheet"
import { ServiceBundles } from "@/components/services/service-bundles"
import { CategoryOverview } from "@/components/services/category-overview"
import { ServiceForm } from "@/components/services/service-form"
import type { ServiceFormData } from "@/components/services/service-form"
import { toast } from "sonner"
import { createService, toggleServiceActive, deleteService } from "@/lib/actions/services"

const categories = ["All", "Hair", "Wellness", "Nails", "Skincare"] as const

interface ServicesClientProps {
  initialServices: Service[]
  staff: Staff[]
}

function getCategoryCount(cat: string, services: Service[]): number {
  if (cat === "All") return services.length
  return services.filter((s) => s.category === cat).length
}

function ServiceCard({
  service,
  index,
  onClick,
  onDelete,
  onToggleActive,
}: {
  service: Service
  index: number
  onClick: () => void
  onDelete: (service: Service) => void
  onToggleActive: (serviceId: string, currentActive: boolean) => void
}) {
  const [isActive, setIsActive] = useState(service.isActive)

  const handleToggle = async () => {
    const newActive = !isActive
    setIsActive(newActive)
    onToggleActive(service.id, isActive)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      layout
      className={cn(
        "bg-card rounded-2xl border border-cream-200 shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden card-warm",
        !isActive && "opacity-60"
      )}
      onClick={onClick}
    >
      {/* Color Bar */}
      <div
        className="h-2"
        style={{ backgroundColor: service.color }}
      />

      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-3">
            <button
              className="mt-1 cursor-grab active:cursor-grabbing text-muted-foreground/70 hover:text-muted-foreground"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-foreground">{service.name}</h3>
                <Badge variant="secondary" className="text-xs">
                  {service.category}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {service.description}
              </p>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => e.stopPropagation()}
                aria-label="More options"
              >
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={() => toast.info(`Editing ${service.name}`)}>
                <Pencil className="w-4 h-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast.success(`"${service.name}" duplicated`)}>
                <Copy className="w-4 h-4 mr-2" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleToggle}>
                <ToggleLeft className="w-4 h-4 mr-2" />
                {isActive ? "Deactivate" : "Activate"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600 focus:text-red-600"
                onClick={() => onDelete(service)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span className="text-sm font-medium">{service.duration} min</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <DollarSign className="w-4 h-4" />
              <span className="text-sm font-semibold text-foreground">
                {formatCurrency(service.price)}
              </span>
            </div>
          </div>
          <div
            className="flex items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            {isActive ? (
              <Eye className="w-4 h-4 text-sal-500" />
            ) : (
              <EyeOff className="w-4 h-4 text-muted-foreground/70" />
            )}
            <Switch
              checked={isActive}
              onCheckedChange={handleToggle}
            />
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export function ServicesClient(props: ServicesClientProps) {
  const router = useRouter()
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [searchQuery, setSearchQuery] = useState("")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null)

  const filteredServices = props.initialServices.filter((service) => {
    const q = searchQuery.toLowerCase()
    const matchesSearch = !q ||
      service.name.toLowerCase().includes(q) ||
      service.description.toLowerCase().includes(q) ||
      service.category.toLowerCase().includes(q)
    const matchesCategory =
      selectedCategory === "All" || service.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const totalServices = props.initialServices.length
  const activeServices = props.initialServices.filter((s) => s.isActive).length
  const avgPrice =
    props.initialServices.reduce((sum, s) => sum + s.price, 0) / totalServices
  const avgDuration =
    props.initialServices.reduce((sum, s) => sum + s.duration, 0) / totalServices

  const handleServiceClick = (service: Service) => {
    setSelectedService(service)
    setSheetOpen(true)
  }

  const handleToggleActive = async (serviceId: string, currentActive: boolean) => {
    const result = await toggleServiceActive(serviceId)
    if (result.success) {
      toast.success(`Service ${currentActive ? "deactivated" : "activated"}`)
      router.refresh()
    } else {
      toast.error(result.error)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    const result = await deleteService(deleteTarget.id)
    if (result.success) {
      toast.success(`Service "${deleteTarget.name}" deleted`)
      router.refresh()
    } else {
      toast.error(result.error)
    }
    setDeleteTarget(null)
  }

  const handleAddService = async (formData: ServiceFormData) => {
    const result = await createService({
      name: formData.name,
      description: formData.description,
      duration: formData.duration,
      price: formData.price,
      categoryId: formData.category,
      color: formData.color,
    })
    if (result.success) {
      toast.success("Service created successfully")
      setIsAddDialogOpen(false)
      router.refresh()
    } else {
      toast.error(result.error)
    }
  }

  return (
    <div className="min-h-screen bg-cream">
      <Header
        title="Services"
        subtitle="Manage your service offerings"
      />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Services", value: totalServices },
            { label: "Active Services", value: activeServices },
            { label: "Avg. Price", value: formatCurrency(avgPrice) },
            { label: "Avg. Duration", value: `${Math.round(avgDuration)} min` },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-heading font-bold text-foreground mt-1">{stat.value}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70" />
              <Input
                placeholder="Search services..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
              <TabsList>
                {categories.map((cat) => (
                  <TabsTrigger key={cat} value={cat}>
                    {cat}
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      {getCategoryCount(cat, props.initialServices)}
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Service
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Service</DialogTitle>
                <DialogDescription>
                  Create a new service for your business.
                </DialogDescription>
              </DialogHeader>
              <ServiceForm
                mode="create"
                staff={props.staff}
                onSave={handleAddService}
                onCancel={() => setIsAddDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>

        {/* Services List */}
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {filteredServices.length} services
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredServices.map((service, index) => (
              <ServiceCard
                key={service.id}
                service={service}
                index={index}
                onClick={() => handleServiceClick(service)}
                onDelete={setDeleteTarget}
                onToggleActive={handleToggleActive}
              />
            ))}
          </div>
        </div>

        {filteredServices.length === 0 && (
          <EmptyState
            icon={<Scissors className="w-8 h-8 text-sal-600" />}
            title="No services found"
            description="No services match your current search or category. Try adjusting your filters or create a new service."
            action={{
              label: "Add Service",
              onClick: () => setIsAddDialogOpen(true),
            }}
          />
        )}

        {/* Categories Overview */}
        <CategoryOverview services={props.initialServices} />

        {/* Service Bundles */}
        <ServiceBundles />
      </div>

      {/* Service Detail Sheet */}
      <ServiceDetailSheet
        service={selectedService}
        staff={props.staff}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title="Delete Service"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
      />
    </div>
  )
}
