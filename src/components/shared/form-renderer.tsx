"use client"

import React, { useState, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Upload, PenLine } from "lucide-react"

export interface FormField {
  id: string
  label: string
  type: "text" | "textarea" | "number" | "date" | "select" | "checkbox" | "radio" | "file" | "signature"
  required: boolean
  options?: string[]
  placeholder?: string
}

interface FormRendererProps {
  fields: FormField[]
  values?: Record<string, unknown>
  onChange?: (data: Record<string, unknown>) => void
  readOnly?: boolean
  preview?: boolean
}

export function FormRenderer({
  fields,
  values: externalValues,
  onChange,
  readOnly = false,
  preview = false,
}: FormRendererProps) {
  const [internalValues, setInternalValues] = useState<Record<string, unknown>>({})
  const values = externalValues ?? internalValues

  const handleChange = useCallback(
    (fieldId: string, value: unknown) => {
      const next = { ...values, [fieldId]: value }
      if (!externalValues) {
        setInternalValues(next)
      }
      onChange?.(next)
    },
    [values, externalValues, onChange]
  )

  if (fields.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        No fields added yet. Add fields to see a preview.
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {fields.map((field) => (
        <div key={field.id} className="space-y-2">
          <Label className="flex items-center gap-1">
            {field.label || "Untitled Field"}
            {field.required && (
              <span className="text-red-500 text-xs">*</span>
            )}
          </Label>

          {field.type === "text" && (
            <Input
              placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
              value={(values[field.id] as string) || ""}
              onChange={(e) => handleChange(field.id, e.target.value)}
              disabled={readOnly}
            />
          )}

          {field.type === "textarea" && (
            <Textarea
              placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
              value={(values[field.id] as string) || ""}
              onChange={(e) => handleChange(field.id, e.target.value)}
              disabled={readOnly}
              rows={3}
            />
          )}

          {field.type === "number" && (
            <Input
              type="number"
              placeholder={field.placeholder || "0"}
              value={(values[field.id] as string) || ""}
              onChange={(e) => handleChange(field.id, e.target.value)}
              disabled={readOnly}
            />
          )}

          {field.type === "date" && (
            <Input
              type="date"
              value={(values[field.id] as string) || ""}
              onChange={(e) => handleChange(field.id, e.target.value)}
              disabled={readOnly}
            />
          )}

          {field.type === "select" && (
            <Select
              value={(values[field.id] as string) || ""}
              onValueChange={(v) => handleChange(field.id, v)}
              disabled={readOnly}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select an option" />
              </SelectTrigger>
              <SelectContent>
                {(field.options || []).map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {field.type === "checkbox" && (
            <div className="space-y-2">
              {(field.options && field.options.length > 0) ? (
                field.options.map((opt) => {
                  const checked = Array.isArray(values[field.id])
                    ? (values[field.id] as string[]).includes(opt)
                    : false
                  return (
                    <div key={opt} className="flex items-center gap-2">
                      <Checkbox
                        id={`${field.id}-${opt}`}
                        checked={checked}
                        onCheckedChange={(c) => {
                          const current = Array.isArray(values[field.id])
                            ? (values[field.id] as string[])
                            : []
                          const next = c
                            ? [...current, opt]
                            : current.filter((v) => v !== opt)
                          handleChange(field.id, next)
                        }}
                        disabled={readOnly}
                      />
                      <Label
                        htmlFor={`${field.id}-${opt}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {opt}
                      </Label>
                    </div>
                  )
                })
              ) : (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={field.id}
                    checked={!!values[field.id]}
                    onCheckedChange={(c) => handleChange(field.id, !!c)}
                    disabled={readOnly}
                  />
                  <Label
                    htmlFor={field.id}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {field.label}
                  </Label>
                </div>
              )}
            </div>
          )}

          {field.type === "radio" && (
            <RadioGroup
              value={(values[field.id] as string) || ""}
              onValueChange={(v) => handleChange(field.id, v)}
              disabled={readOnly}
            >
              {(field.options || []).map((opt) => (
                <div key={opt} className="flex items-center gap-2">
                  <RadioGroupItem value={opt} id={`${field.id}-${opt}`} />
                  <Label
                    htmlFor={`${field.id}-${opt}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {opt}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          )}

          {field.type === "file" && (
            <div className="border-2 border-dashed rounded-lg p-6 text-center text-muted-foreground hover:border-sal-500/50 transition-colors">
              <Upload className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">
                {preview ? "File upload area" : "Click or drag to upload a file"}
              </p>
              {!preview && !readOnly && (
                <Button variant="outline" size="sm" className="mt-2" type="button">
                  Choose File
                </Button>
              )}
            </div>
          )}

          {field.type === "signature" && (
            <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground hover:border-sal-500/50 transition-colors bg-muted/20">
              <PenLine className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">
                {preview ? "Signature capture area" : "Click to sign"}
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
