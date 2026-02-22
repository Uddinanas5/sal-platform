"use client"

import * as React from "react"
import { CalendarDays } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { DatePicker } from "@/components/ui/date-picker"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

const presets = [
  { label: "Today", value: "today" },
  { label: "This Week", value: "this-week" },
  { label: "This Month", value: "this-month" },
  { label: "Last Month", value: "last-month" },
  { label: "Custom", value: "custom" },
] as const

type PresetValue = (typeof presets)[number]["value"]

interface DateRangePickerProps {
  className?: string
}

export function DateRangePicker({ className }: DateRangePickerProps) {
  const [activePreset, setActivePreset] = React.useState<PresetValue>("this-month")
  const [customStart, setCustomStart] = React.useState<Date | undefined>(undefined)
  const [customEnd, setCustomEnd] = React.useState<Date | undefined>(undefined)
  const [showCustom, setShowCustom] = React.useState(false)

  const handlePresetClick = (value: PresetValue) => {
    setActivePreset(value)
    if (value === "custom") {
      setShowCustom(true)
    } else {
      setShowCustom(false)
    }
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex items-center rounded-lg border border-cream-200 bg-card p-1 overflow-x-auto">
        {presets.map((preset) => (
          <Button
            key={preset.value}
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 sm:h-8 px-2 sm:px-3 text-xs sm:text-sm font-medium rounded-md transition-all shrink-0",
              activePreset === preset.value
                ? "bg-sal-500 text-white hover:bg-sal-600 hover:text-white"
                : "text-muted-foreground hover:text-foreground hover:bg-cream-100"
            )}
            onClick={() => handlePresetClick(preset.value)}
          >
            {preset.label}
          </Button>
        ))}
      </div>

      {showCustom && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-2 border-cream-200">
              <CalendarDays className="h-4 w-4" />
              {customStart && customEnd
                ? `${customStart.toLocaleDateString()} - ${customEnd.toLocaleDateString()}`
                : "Select range"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-4" align="end">
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-foreground mb-1">Start Date</p>
                <DatePicker
                  date={customStart}
                  onSelect={setCustomStart}
                  placeholder="Start date"
                />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground mb-1">End Date</p>
                <DatePicker
                  date={customEnd}
                  onSelect={setCustomEnd}
                  placeholder="End date"
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}
