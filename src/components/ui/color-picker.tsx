"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"

const presetColors = [
  "#f97316", "#8b5cf6", "#10b981", "#ec4899", "#06b6d4", "#f59e0b",
  "#ef4444", "#3b82f6", "#14b8a6", "#f43f5e", "#8b5cf6", "#84cc16",
]

interface ColorPickerProps {
  value?: string
  onChange?: (color: string) => void
  className?: string
}

export function ColorPicker({ value = "#059669", onChange, className }: ColorPickerProps) {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap gap-2">
        {presetColors.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange?.(color)}
            className={cn(
              "h-8 w-8 rounded-full border-2 transition-transform hover:scale-110",
              value === color ? "border-foreground scale-110" : "border-transparent"
            )}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-md border" style={{ backgroundColor: value }} />
        <Input
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder="#000000"
          className="flex-1"
        />
      </div>
    </div>
  )
}
