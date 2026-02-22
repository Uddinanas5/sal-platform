"use client"

import React, { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import {
  FileText,
  Plus,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Send,
  ShieldCheck,
  BarChart3,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { FormBuilderDialog } from "@/components/settings/form-builder-dialog"
import {
  deleteFormTemplate,
  updateFormTemplate,
} from "@/lib/actions/forms"
import type { FormField } from "@/components/shared/form-renderer"

export interface FormTemplateItem {
  id: string
  name: string
  description: string
  fields: FormField[]
  serviceIds: string[]
  isAutoSend: boolean
  isRequired: boolean
  isActive: boolean
  submissionCount: number
  createdAt: Date
}

interface FormsSectionProps {
  templates: FormTemplateItem[]
}

export function FormsSection({ templates: initialTemplates }: FormsSectionProps) {
  const [templates, setTemplates] = useState(initialTemplates)
  const [builderOpen, setBuilderOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<FormTemplateItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<FormTemplateItem | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const handleEdit = (template: FormTemplateItem) => {
    setEditingTemplate(template)
    setBuilderOpen(true)
  }

  const handleCreate = () => {
    setEditingTemplate(null)
    setBuilderOpen(true)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteFormTemplate(deleteTarget.id)
      setTemplates((prev) => prev.filter((t) => t.id !== deleteTarget.id))
      toast.success(`"${deleteTarget.name}" deleted`)
    } catch {
      toast.error("Failed to delete form")
    }
    setDeleteTarget(null)
  }

  const handleToggleActive = async (template: FormTemplateItem) => {
    setTogglingId(template.id)
    try {
      await updateFormTemplate(template.id, { isActive: !template.isActive })
      setTemplates((prev) =>
        prev.map((t) =>
          t.id === template.id ? { ...t, isActive: !t.isActive } : t
        )
      )
      toast.success(
        template.isActive
          ? `"${template.name}" deactivated`
          : `"${template.name}" activated`
      )
    } catch {
      toast.error("Failed to update form status")
    }
    setTogglingId(null)
  }

  const handleSaved = () => {
    // Page will revalidate via server action; for local state,
    // we rely on revalidation. Close dialog triggers re-render.
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 font-heading">
                  <FileText className="w-5 h-5 text-sal-500" />
                  Client Forms
                </CardTitle>
                <CardDescription>
                  Intake forms and questionnaires for your clients
                </CardDescription>
              </div>
              <Button
                onClick={handleCreate}
                size="sm"
                className="gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Create Form
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {templates.length === 0 ? (
              <div className="border-2 border-dashed rounded-lg p-10 text-center">
                <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground mb-1">
                  No form templates yet
                </p>
                <p className="text-xs text-muted-foreground mb-4">
                  Create intake forms to collect information from your clients before appointments
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCreate}
                  className="gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  Create Your First Form
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {templates.map((template) => (
                    <motion.div
                      key={template.id}
                      layout
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className={`border rounded-lg p-4 transition-colors ${
                        template.isActive
                          ? "bg-background hover:bg-muted/30"
                          : "bg-muted/50 opacity-60"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-medium text-sm truncate">
                              {template.name}
                            </h4>
                            {!template.isActive && (
                              <Badge variant="secondary" className="text-[10px]">
                                Inactive
                              </Badge>
                            )}
                          </div>
                          {template.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                              {template.description}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-2 flex-wrap">
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <FileText className="w-3 h-3" />
                              {template.fields.length} field
                              {template.fields.length !== 1 ? "s" : ""}
                            </span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <BarChart3 className="w-3 h-3" />
                              {template.submissionCount} submission
                              {template.submissionCount !== 1 ? "s" : ""}
                            </span>
                            {template.isAutoSend && (
                              <Badge
                                variant="info"
                                className="text-[10px] py-0 px-1.5"
                              >
                                <Send className="w-2.5 h-2.5 mr-0.5" />
                                Auto-send
                              </Badge>
                            )}
                            {template.isRequired && (
                              <Badge
                                variant="warning"
                                className="text-[10px] py-0 px-1.5"
                              >
                                <ShieldCheck className="w-2.5 h-2.5 mr-0.5" />
                                Required
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => handleEdit(template)}
                            aria-label="Edit form"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => handleToggleActive(template)}
                            disabled={togglingId === template.id}
                            aria-label={
                              template.isActive
                                ? "Deactivate form"
                                : "Activate form"
                            }
                          >
                            {template.isActive ? (
                              <ToggleRight className="w-3.5 h-3.5 text-sal-500" />
                            ) : (
                              <ToggleLeft className="w-3.5 h-3.5" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-red-500"
                            onClick={() => setDeleteTarget(template)}
                            aria-label="Delete form"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <FormBuilderDialog
        open={builderOpen}
        onOpenChange={setBuilderOpen}
        template={editingTemplate}
        onSaved={handleSaved}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Form Template"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This will also remove all associated submissions. This action cannot be undone.`}
        confirmLabel="Delete Form"
        onConfirm={handleDelete}
        variant="destructive"
      />
    </>
  )
}
