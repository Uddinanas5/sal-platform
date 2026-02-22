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
              "px-2 py-2 text-xs rounded-lg border font-medium transition-all duration-200",
              isUnavailable &&
                "bg-cream-50 text-muted-foreground/70 border-cream-100 cursor-not-allowed line-through",
              !isUnavailable &&
                !isSelected &&
                "bg-card text-sal-700 border-sal-200 hover:bg-sal-50 hover:border-sal-400 cursor-pointer",
              isSelected &&
                "bg-sal-500 text-white border-sal-500 shadow-md shadow-sal-500/20"
            )}
          >
            {time}
          </motion.button>
        )
      })}
    </div>
  )
}
