"use client"

import React, { useEffect, useState } from "react"

interface TimeIndicatorProps {
  zoom: number
  startHour?: number
}

export function TimeIndicator({ zoom, startHour = 8 }: TimeIndicatorProps) {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const interval = setInterval(() => {
      setNow(new Date())
    }, 60_000) // Update every minute

    return () => clearInterval(interval)
  }, [])

  if (!now) return null

  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const startMinutes = startHour * 60
  const pixelsPerMinute = (60 * zoom) / 30

  // Only show if within visible range
  if (currentMinutes < startMinutes || currentMinutes > startMinutes + 12 * 60) {
    return null
  }

  const top = (currentMinutes - startMinutes) * pixelsPerMinute

  return (
    <div
      className="absolute left-0 right-0 z-30 pointer-events-none"
      style={{ top: `${top}px` }}
    >
      <div className="relative flex items-center">
        {/* Time label at the left edge */}
        <span className="absolute -top-[18px] left-0 text-[10px] font-semibold text-mint leading-none whitespace-nowrap select-none">
          {now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
        </span>
        {/* Circle on the left edge */}
        <div className="absolute -left-[4px] w-2 h-2 rounded-full bg-mint shadow-led-mint" />
        {/* Horizontal line */}
        <div className="w-full h-[2px] bg-mint opacity-80" />
      </div>
    </div>
  )
}
