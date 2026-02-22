"use client"

import React, { useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import {
  Plus,
  Trash2,
  GripVertical,
  Eye,
  Settings2,
  Type,
  AlignLeft,
  Hash,
  CalendarDays,
  ChevronDown,
  CheckSquare,
  CircleDot,
  Upload,
  PenLine,
  Loader2,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FormRenderer, type FormField } from "@/components/shared/form-renderer"
import { createFormTemplate, updateFormTemplate } from "@/lib/actions/forms"

const FIELD_TYPES: { value: FormField["type"]; label: string; icon: React.ElementType }[] = [
  { value: "text", label: "Text", icon: Type },
  { value: "textarea", label: "Long Text", icon: AlignLeft },
  { value: "number", label: "Number", icon: Hash },
  { value: "date", label: "Date", icon: CalendarDays },
  { value: "select", label: "Dropdown", icon: ChevronDown },
  { value: "checkbox", label: "Checkbox", icon: CheckSquare },
  { value: "radio", label: "Radio", icon: CircleDot },
  { value: "file", label: "File Upload", icon: Upload },
  { value: "signature", label: "Signature", icon: PenLine },
]

interface FormTemplateData {
  id?: string
  name: string
  description: string
  fields: FormField[]
  serviceIds: string[]
  isAutoSend: boolean
  isRequired: boolean
}

interface FormBuilderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  template?: FormTemplateData | null
  onSaved?: () => void
}

function generateFieldId() {
  return `field_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

export function FormBuilderDialog({
  open,
  onOpenChange,
  template,
  onSaved,
}: FormBuilderDialogProps) {
  const isEditing = !!template?.id
  const [name, setName] = useState(template?.name || "")
  const [description, setDescription] = useState(template?.description || "")
  const [fields, setFields] = useState<FormField[]>(template?.fields || [])
  const [isAutoSend, setIsAutoSend] = useState(template?.isAutoSend || false)
  const [isRequired, setIsRequired] = useState(template?.isRequired || false)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState("builder")

  // Reset state when dialog opens with new template
  React.useEffect(() => {
    if (open) {
      setName(template?.name || "")
      setDescription(template?.description || "")
      setFields(template?.fields || [])
      setIsAutoSend(template?.isAutoSend || false)
      setIsRequired(template?.isRequired || false)
      setActiveTab("builder")
    }
  }, [open, template])

  const addField = useCallback(() => {
    setFields((prev) => [
      ...prev,
      {
        id: generateFieldId(),
        label: "",
        type: "text",
        required: false,
        options: [],
        placeholder: "",
      },
    ])
  }, [])

  const updateField = useCallback(
    (id: string, updates: Partial<FormField>) => {
      setFields((prev) =>
        prev.map((f) => (f.id === id ? { ...f, ...updates } : f))
      )
    },
    []
  )

  const removeField = useCallback((id: string) => {
    setFields((prev) => prev.filter((f) => f.id !== id))
  }, [])

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Form name is required")
      return
    }
    if (fields.length === 0) {
      toast.error("Add at least one field")
      return
    }
    const unlabeled = fields.find((f) => !f.label.trim())
    if (unlabeled) {
      toast.error("All fields must have a label")
      return
    }

    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        fields: fields as unknown as Record<string, unknown>[],
        serviceIds: [] as string[],
        isAutoSend,
        isRequired,
      }

      if (isEditing && template?.id) {
        await updateFormTemplate(template.id, payload)
        toast.success("Form template updated")
      } else {
        await createFormTemplate(payload)
        toast.success("Form template created")
      }
      onSaved?.()
      onOpenChange(false)
    } catch {
      toast.error("Failed to save form template")
    } finally {
      setSaving(false)
    }
  }

  const needsOptions = (type: FormField["type"]) =>
    type === "select" || type === "radio" || type === "checkbox"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="font-heading text-xl">
            {isEditing ? "Edit Form Template" : "Create Form Template"}
          </DialogTitle>
          <DialogDescription>
            Build an intake form with custom fields for your clients
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex-1 flex flex-col min-h-0"
        >
          <div className="px-6">
            <TabsList className="w-full">
              <TabsTrigger value="builder" className="flex-1 gap-2">
                <Settings2 className="w-4 h-4" />
                Builder
              </TabsTrigger>
              <TabsTrigger value="preview" className="flex-1 gap-2">
                <Eye className="w-4 h-4" />
                Preview
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent
            value="builder"
            className="flex-1 min-h-0 mt-0 px-6"
          >
            <ScrollArea className="h-[55vh] pr-3">
              <div className="space-y-6 py-4">
                {/* Form meta */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="form-name">Form Name</Label>
                    <Input
                      id="form-name"
                      placeholder="e.g. New Client Intake Form"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="form-desc">Description (optional)</Label>
                    <Textarea
                      id="form-desc"
                      placeholder="Describe the purpose of this form"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={2}
                    />
                  </div>
                </div>

                <Separator />

                {/* Fields */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-heading">
                      Fields{" "}
                      <span className="text-muted-foreground font-normal text-sm">
                        ({fields.length})
                      </span>
                    </Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addField}
                      className="gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      Add Field
                    </Button>
                  </div>

                  <AnimatePresence mode="popLayout">
                    {fields.map((field, index) => (
                      <motion.div
                        key={field.id}
                        layout
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -20, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="border rounded-lg p-4 space-y-3 bg-muted/30"
                      >
                        <div className="flex items-start gap-2">
                          <div className="mt-2.5 text-muted-foreground/40 cursor-grab" aria-label="Drag handle">
                            <GripVertical className="w-4 h-4" />
                          </div>
                          <div className="flex-1 space-y-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground font-medium min-w-[20px]">
                                {index + 1}.
                              </span>
                              <Input
                                placeholder="Field label"
                                value={field.label}
                                onChange={(e) =>
                                  updateField(field.id, { label: e.target.value })
                                }
                                className="flex-1"
                              />
                              <Select
                                value={field.type}
                                onValueChange={(v) =>
                                  updateField(field.id, {
                                    type: v as FormField["type"],
                                    options: needsOptions(v as FormField["type"])
                                      ? field.options || []
                                      : undefined,
                                  })
                                }
                              >
                                <SelectTrigger className="w-[140px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {FIELD_TYPES.map((ft) => (
                                    <SelectItem key={ft.value} value={ft.value}>
                                      <span className="flex items-center gap-2">
                                        <ft.icon className="w-3.5 h-3.5" />
                                        {ft.label}
                                      </span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {needsOptions(field.type) && (
                              <div className="pl-7 space-y-1.5">
                                <Label className="text-xs text-muted-foreground">
                                  Options (comma-separated)
                                </Label>
                                <Input
                                  placeholder="Option 1, Option 2, Option 3"
                                  value={(field.options || []).join(", ")}
                                  onChange={(e) =>
                                    updateField(field.id, {
                                      options: e.target.value
                                        .split(",")
                                        .map((s) => s.trim())
                                        .filter(Boolean),
                                    })
                                  }
                                  className="text-sm"
                                />
                              </div>
                            )}

                            <div className="flex items-center gap-4 pl-7">
                              <div className="flex items-center gap-2">
                                <Switch
                                  id={`req-${field.id}`}
                                  checked={field.required}
                                  onCheckedChange={(c) =>
                                    updateField(field.id, { required: c })
                                  }
                                  className="scale-75"
                                />
                                <Label
                                  htmlFor={`req-${field.id}`}
                                  className="text-xs text-muted-foreground cursor-pointer"
                                >
                                  Required
                                </Label>
                              </div>
                            </div>
                          </div>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-red-500 mt-1 shrink-0"
                            onClick={() => removeField(field.id)}
                            aria-label="Remove field"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {fields.length === 0 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="border-2 border-dashed rounded-lg p-8 text-center"
                    >
                      <p className="text-muted-foreground text-sm mb-3">
                        No fields yet. Start building your form.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={addField}
                        className="gap-1.5"
                      >
                        <Plus className="w-4 h-4" />
                        Add First Field
                      </Button>
                    </motion.div>
                  )}
                </div>

                <Separator />

                {/* Settings */}
                <div className="space-y-4">
                  <Label className="text-base font-heading">
                    Form Settings
                  </Label>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="auto-send" className="cursor-pointer">
                          Auto-send to clients
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Automatically send this form when an appointment is booked
                        </p>
                      </div>
                      <Switch
                        id="auto-send"
                        checked={isAutoSend}
                        onCheckedChange={setIsAutoSend}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="required-form" className="cursor-pointer">
                          Required before appointment
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Client must complete this form before their appointment
                        </p>
                      </div>
                      <Switch
                        id="required-form"
                        checked={isRequired}
                        onCheckedChange={setIsRequired}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent
            value="preview"
            className="flex-1 min-h-0 mt-0 px-6"
          >
            <ScrollArea className="h-[55vh] pr-3">
              <div className="py-4">
                <div className="border rounded-lg p-6 bg-background">
                  {name && (
                    <div className="mb-6">
                      <h3 className="text-lg font-heading font-semibold">
                        {name}
                      </h3>
                      {description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {description}
                        </p>
                      )}
                    </div>
                  )}
                  <FormRenderer fields={fields} preview />
                  {fields.length > 0 && (
                    <div className="mt-6 pt-4 border-t">
                      <Button className="w-full" disabled>
                        Submit Form
                      </Button>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 mt-3 flex-wrap">
                  {isAutoSend && (
                    <Badge variant="info">Auto-send enabled</Badge>
                  )}
                  {isRequired && (
                    <Badge variant="warning">Required</Badge>
                  )}
                  <Badge variant="secondary">
                    {fields.length} field{fields.length !== 1 ? "s" : ""}
                  </Badge>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <DialogFooter className="px-6 pb-6 pt-2 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEditing ? "Update Form" : "Create Form"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
