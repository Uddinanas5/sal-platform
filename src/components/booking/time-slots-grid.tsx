"use client"

import React, { useState } from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface TimeSlotsGridProps {
  selectedDate: Date
  onSelectTime?: (time: string) => void
  selectedTime?: string | null
}

const allSlots = [
  "9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM",
  "12:00 PM", "12:30 PM", "1:00 PM", "1:30 PM", "2:00 PM", "2:30 PM",
  "3:00 PM", "3:30 PM", "4:00 PM", "4:30 PM", "5:00 PM", "5:30 PM",
]

// Simulate some slots being unavailable
const unavailableSlots = ["10:30 AM", "12:00 PM", "2:00 PM", "3:30 PM", "5:30 PM"]

export function TimeSlotsGrid({ onSelectTime, selectedTime }: TimeSlotsGridProps) {
  const [localSelected, setLocalSelected] = useState<string | null>(selectedTime || null)

  const handleSelect = (time: string) => {
    if (unavailableSlots.includes(time)) return
    setLocalSelected(time)
    onSelectTime?.(time)
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {allSlots.map((time, index) => {
        const isUnavailable = unavailableSlots.includes(time)
        const isSelected = (selectedTime ?? localSelected) === time

        return (
          <motion.button
            key={time}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.02 }}
            onClick={() => handleSelect(time)}
            disabled={isUnavailable}
            className={cn(
              "px-2 py-2 text-xs rounded-tile font-medium transition-all duration-200",
              isUnavailable &&
                "border border-white/10 bg-white/[0.04] text-white/30 cursor-not-allowed line-through",
              !isUnavailable &&
                !isSelected &&
                "glass-tile text-ink-soft hover:brightness-110 cursor-pointer",
              isSelected &&
                "border border-mint/60 bg-mint/15 text-white shadow-glow-sm"
            )}
          >
            {time}
          </motion.button>
        )
      })}
    </div>
  )
}
