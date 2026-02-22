"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface TimePickerProps {
  value?: string
  onChange?: (time: string) => void
  className?: string
  minuteStep?: number
  startHour?: number
  endHour?: number
}

export function TimePicker({
  value,
  onChange,
  className,
  minuteStep = 15,
  startHour = 8,
  endHour = 20,
}: TimePickerProps) {
  const timeSlots = React.useMemo(() => {
    const slots: string[] = []
    for (let h = startHour; h <= endHour; h++) {
      for (let m = 0; m < 60; m += minuteStep) {
        if (h === endHour && m > 0) break
        const hour = h.toString().padStart(2, "0")
        const minute = m.toString().padStart(2, "0")
        slots.push(`${hour}:${minute}`)
      }
    }
    return slots
  }, [startHour, endHour, minuteStep])

  const formatDisplay = (time: string) => {
    const [h, m] = time.split(":").map(Number)
    const period = h >= 12 ? "PM" : "AM"
    const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
    return `${hour12}:${m.toString().padStart(2, "0")} ${period}`
  }

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={cn("w-full", className)}>
        <SelectValue placeholder="Select time">
          {value ? formatDisplay(value) : "Select time"}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {timeSlots.map((slot) => (
          <SelectItem key={slot} value={slot}>
            {formatDisplay(slot)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
