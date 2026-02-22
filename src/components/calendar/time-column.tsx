"use client"

import React from "react"
import { cn } from "@/lib/utils"

interface TimeColumnProps {
  zoom: number
  startHour?: number
  endHour?: number
}

export function TimeColumn({
  zoom = 1,
  startHour = 8,
  endHour = 20,
}: TimeColumnProps) {
  const slotHeight = 60 * zoom
  const slots: { hour: number; minute: number }[] = []

  for (let h = startHour; h < endHour; h++) {
    slots.push({ hour: h, minute: 0 })
    slots.push({ hour: h, minute: 30 })
  }

  function formatTimeLabel(hour: number, minute: number): string {
    const h = hour % 12 === 0 ? 12 : hour % 12
    const ampm = hour >= 12 ? "PM" : "AM"
    if (minute === 0) {
      return `${h} ${ampm}`
    }
    return `${h}:${minute.toString().padStart(2, "0")}`
  }

  return (
    <div className="flex flex-col shrink-0 w-[72px] border-r border-cream-200 bg-cream-50/50">
      {slots.map((slot) => (
        <div
          key={`${slot.hour}-${slot.minute}`}
          className={cn(
            "relative flex items-start justify-end pr-3 text-right border-b border-cream-100",
            slot.minute === 0 && "border-cream-200"
          )}
          style={{ height: `${slotHeight}px` }}
        >
          {slot.minute === 0 && (
            <span className="text-[11px] font-medium text-muted-foreground/70 -translate-y-[7px] select-none">
              {formatTimeLabel(slot.hour, slot.minute)}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
