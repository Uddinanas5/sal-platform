"use client"

import React, { useState } from "react"
import { motion } from "framer-motion"
import {
  DoorOpen,
  Wrench,
  Plus,
  Pencil,
  Trash2,
  Users,
  Link2,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { EmptyState } from "@/components/shared/empty-state"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { ResourceDialog, type ResourceFormData } from "@/components/settings/resource-dialog"
import { deleteResource, updateResource } from "@/lib/actions/resources"

interface Resource {
  id: string
  name: string
  type: string
  description: string
  capacity: number
  isActive: boolean
  serviceIds: string[]
  createdAt: Date
}

interface ServiceOption {
  id: string
  name: string
  category: string
}

interface ResourcesSectionProps {
  resources: Resource[]
  services: ServiceOption[]
}

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.35, ease: "easeOut" as const },
  }),
}

export function ResourcesSection({ resources, services }: ResourcesSectionProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingResource, setEditingResource] = useState<ResourceFormData | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Resource | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  function handleAdd() {
    setEditingResource(null)
    setDialogOpen(true)
  }

  function handleEdit(resource: Resource) {
    setEditingResource({
      id: resource.id,
      name: resource.name,
      type: resource.type,
      description: resource.description,
      capacity: resource.capacity,
      isActive: resource.isActive,
      serviceIds: resource.serviceIds,
    })
    setDialogOpen(true)
  }

  async function handleToggleActive(resource: Resource) {
    const result = await updateResource(resource.id, {
      isActive: !resource.isActive,
    })
    if (result.success) {
      toast.success(
        resource.isActive ? "Resource deactivated" : "Resource activated",
        { description: resource.name }
      )
    } else {
      toast.error(`Failed to toggle: ${result.error}`)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setIsDeleting(true)
    const result = await deleteResource(deleteTarget.id)
    if (result.success) {
      toast.success("Resource deleted", {
        description: `${deleteTarget.name} has been removed.`,
      })
    } else {
      toast.error(`Failed to delete: ${result.error}`)
    }
    setIsDeleting(false)
    setDeleteTarget(null)
  }

  const activeCount = resources.filter((r) => r.isActive).length
  const roomCount = resources.filter((r) => r.type === "room").length
  const equipmentCount = resources.filter((r) => r.type === "equipment").length

  return (
    <div className="max-w-5xl space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 font-heading">
                  <DoorOpen className="w-5 h-5 text-sal-500" />
                  Rooms &amp; Equipment
                </CardTitle>
                <CardDescription>
                  Manage the physical resources available for appointments.
                  {resources.length > 0 && (
                    <span className="ml-1">
                      {activeCount} active
                      {roomCount > 0 && ` \u00b7 ${roomCount} room${roomCount !== 1 ? "s" : ""}`}
                      {equipmentCount > 0 && ` \u00b7 ${equipmentCount} equipment`}
                    </span>
                  )}
                </CardDescription>
              </div>
              <Button onClick={handleAdd} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Resource
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {resources.length === 0 ? (
              <EmptyState
                icon={<DoorOpen className="w-8 h-8 text-sal-400" />}
                title="No resources yet"
                description="Add rooms and equipment to manage availability for your appointments."
                action={{ label: "Add Resource", onClick: handleAdd }}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {resources.map((resource, i) => (
                  <motion.div
                    key={resource.id}
                    custom={i}
                    initial="hidden"
                    animate="visible"
                    variants={cardVariants}
                  >
                    <div
                      className={`relative rounded-xl border p-4 transition-all duration-200 hover:shadow-md ${
                        resource.isActive
                          ? "border-cream-200 dark:border-cream-800 bg-card"
                          : "border-cream-200/60 dark:border-cream-800/60 bg-muted/40 opacity-70"
                      }`}
                    >
                      {/* Header Row */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`flex items-center justify-center w-10 h-10 rounded-lg ${
                              resource.type === "room"
                                ? "bg-blue-500/10 dark:bg-blue-500/15"
                                : "bg-amber-500/10 dark:bg-amber-500/15"
                            }`}
                          >
                            {resource.type === "room" ? (
                              <DoorOpen
                                className={`w-5 h-5 ${
                                  resource.isActive
                                    ? "text-blue-600 dark:text-blue-400"
                                    : "text-muted-foreground"
                                }`}
                              />
                            ) : (
                              <Wrench
                                className={`w-5 h-5 ${
                                  resource.isActive
                                    ? "text-amber-600 dark:text-amber-400"
                                    : "text-muted-foreground"
                                }`}
                              />
                            )}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-sm font-semibold truncate">
                              {resource.name}
                            </h4>
                            <Badge
                              variant="secondary"
                              className={`text-[10px] px-1.5 py-0 mt-0.5 ${
                                resource.type === "room"
                                  ? "bg-blue-500/10 text-blue-700 dark:text-blue-300"
                                  : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                              }`}
                            >
                              {resource.type === "room" ? "Room" : "Equipment"}
                            </Badge>
                          </div>
                        </div>

                        {/* Active Status Dot */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <div
                            className={`w-2 h-2 rounded-full ${
                              resource.isActive
                                ? "bg-emerald-500"
                                : "bg-gray-300 dark:bg-gray-600"
                            }`}
                          />
                          <span className="text-[10px] text-muted-foreground">
                            {resource.isActive ? "Active" : "Inactive"}
                          </span>
                        </div>
                      </div>

                      {/* Description */}
                      {resource.description && (
                        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                          {resource.description}
                        </p>
                      )}

                      {/* Meta Info */}
                      <div className="flex items-center gap-4 mb-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          Capacity: {resource.capacity}
                        </span>
                        <span className="flex items-center gap-1">
                          <Link2 className="w-3.5 h-3.5" />
                          {resource.serviceIds.length} service
                          {resource.serviceIds.length !== 1 ? "s" : ""}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-between pt-3 border-t border-cream-200 dark:border-cream-800">
                        <Switch
                          checked={resource.isActive}
                          onCheckedChange={() => handleToggleActive(resource)}
                          aria-label={`Toggle ${resource.name} active status`}
                        />
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(resource)}
                            className="h-8 w-8 p-0"
                            aria-label={`Edit ${resource.name}`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteTarget(resource)}
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                            aria-label={`Delete ${resource.name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Add/Edit Dialog */}
      <ResourceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        resource={editingResource}
        services={services}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Resource"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel={isDeleting ? "Deleting..." : "Delete"}
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  )
}
