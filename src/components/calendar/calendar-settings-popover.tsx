"use client"

import React from "react"
import { Settings, Palette, ZoomIn, Clock } from "lucide-react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import type { ColorByMode } from "./appointment-block"

interface CalendarSettingsPopoverProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  colorBy: ColorByMode
  onColorByChange: (mode: ColorByMode) => void
  zoom: number
  onZoomChange: (zoom: number) => void
  showWorkingHours: boolean
  onShowWorkingHoursChange: (show: boolean) => void
}

export function CalendarSettingsPopover({
  open,
  onOpenChange,
  colorBy,
  onColorByChange,
  zoom,
  onZoomChange,
  showWorkingHours,
  onShowWorkingHoursChange,
}: CalendarSettingsPopoverProps) {
  const colorOptions: { value: ColorByMode; label: string }[] = [
    { value: "status", label: "Status" },
    { value: "staff", label: "Staff" },
    { value: "service", label: "Service" },
  ]

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9">
          <Settings className="h-4 w-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[280px] p-0">
        <div className="px-4 py-3">
          <h4 className="text-sm font-semibold text-foreground">
            Calendar Settings
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            Customize your calendar view
          </p>
        </div>

        <Separator />

        <div className="p-4 space-y-5">
          {/* Color by */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <Palette className="h-3.5 w-3.5 text-muted-foreground/70" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-faint">
                Color by
              </span>
            </div>
            <div className="flex items-center gap-1 bg-white/[0.05] border border-white/[0.08] rounded-lg p-1">
              {colorOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => onColorByChange(opt.value)}
                  className={cn(
                    "flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                    colorBy === opt.value
                      ? "bg-white/[0.14] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]"
                      : "text-ink-soft hover:text-foreground hover:bg-white/[0.08]"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Status color legend */}
          {colorBy === "status" && (
            <div className="space-y-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-faint">
                Status Colors
              </span>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                {[
                  { label: "Booked", color: "#60a5fa" },
                  { label: "Confirmed", color: "#a78bfa" },
                  { label: "Arrived", color: "#fbbf24" },
                  { label: "Started", color: "#4fe6a6" },
                  { label: "Completed", color: "rgba(255,255,255,0.35)" },
                  { label: "No Show", color: "#f87171" },
                  { label: "Cancelled", color: "rgba(248,113,113,0.40)" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2">
                    <span
                      className="led"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-xs text-ink-soft">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Zoom */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ZoomIn className="h-3.5 w-3.5 text-muted-foreground/70" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-faint">
                  Zoom
                </span>
              </div>
              <span className="text-xs font-mono text-muted-foreground">
                {zoom.toFixed(1)}x
              </span>
            </div>
            <Slider
              value={[zoom * 100]}
              onValueChange={([val]: number[]) => onZoomChange(val / 100)}
              min={50}
              max={150}
              step={10}
              className="w-full"
            />
            <div className="flex items-center justify-between text-[10px] text-muted-foreground/70">
              <span>0.5x</span>
              <span>1.0x</span>
              <span>1.5x</span>
            </div>
          </div>

          {/* Working hours toggle */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-muted-foreground/70" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-faint">
                  Working Hours
                </span>
              </div>
              <Switch
                checked={showWorkingHours}
                onCheckedChange={onShowWorkingHoursChange}
              />
            </div>
            <p className="text-[11px] text-muted-foreground/70">
              Show only staff working hours
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
