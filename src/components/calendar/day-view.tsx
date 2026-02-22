"use client"

import React, { useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import { TimeColumn } from "./time-column"
import { StaffColumn } from "./staff-column"
import { TimeIndicator } from "./time-indicator"
import type { ColorByMode } from "./appointment-block"
import type { Appointment, Staff, Service } from "@/data/mock-data"

interface DayViewProps {
  date: Date
  staff: Staff[]
  appointments: Appointment[]
  services: Service[]
  colorBy: ColorByMode
  zoom: number
  onAppointmentClick: (appointment: Appointment) => void
  onEmptySlotClick: (staffId: string, date: Date, hour: number, minute: number) => void
  startHour?: number
  endHour?: number
  showWorkingHours?: boolean
}

export function DayView({
  date,
  staff,
  appointments,
  services,
  colorBy,
  zoom,
  onAppointmentClick,
  onEmptySlotClick,
  startHour = 8,
  endHour = 20,
  showWorkingHours = false,
}: DayViewProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Scroll to ~9 AM on mount
  useEffect(() => {
    if (scrollContainerRef.current) {
      const pixelsPerMinute = (60 * zoom) / 30
      const scrollTo = (9 - startHour) * 60 * pixelsPerMinute - 60
      scrollContainerRef.current.scrollTop = Math.max(0, scrollTo)
    }
  }, [zoom, startHour])

  return (
    <div className="flex flex-col h-full">
      {/* Staff headers - sticky row above the scrollable area */}
      <div className="flex border-b border-cream-200 bg-card shrink-0">
        {/* Empty cell above time column */}
        <div className="w-[72px] shrink-0 border-r border-cream-200" />
        {/* Staff header cells */}
        <div className="flex flex-1 overflow-x-auto">
          {staff.map((s) => {
            const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
            const dayName = dayNames[date.getDay()]
            const todayHours = s.workingHours[dayName]
            const isDayOff = showWorkingHours && (todayHours === null || todayHours === undefined)
            const apptCount = appointments.filter(
              (a) => a.staffId === s.id && a.startTime.toDateString() === date.toDateString()
            ).length

            return (
              <div
                key={s.id}
                className="flex items-center gap-2 px-3 py-2 border-r border-cream-200 last:border-r-0 min-w-[180px] flex-1"
                style={{ backgroundColor: isDayOff ? "rgba(0,0,0,0.03)" : `${s.color}08` }}
              >
                <div
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold text-white shrink-0",
                    isDayOff && "opacity-50"
                  )}
                  style={{ backgroundColor: s.color }}
                >
                  {s.name.split(" ").map((n) => n[0]).join("").toUpperCase()}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className={cn(
                    "text-xs font-semibold truncate",
                    isDayOff ? "text-muted-foreground" : "text-foreground"
                  )}>
                    {s.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground/70 truncate">
                    {isDayOff ? "Day off" : `${apptCount} appts`}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Scrollable grid body */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-auto relative"
      >
        <div className="flex min-h-0">
          {/* Time column */}
          <TimeColumn zoom={zoom} startHour={startHour} endHour={endHour} />

          {/* Staff columns */}
          <div className="flex flex-1 relative">
            {/* Time indicator spans all columns */}
            <TimeIndicator zoom={zoom} startHour={startHour} />

            {staff.map((s) => (
              <StaffColumn
                key={s.id}
                staff={s}
                date={date}
                appointments={appointments}
                colorBy={colorBy}
                zoom={zoom}
                staffList={staff}
                serviceList={services}
                onAppointmentClick={onAppointmentClick}
                onEmptySlotClick={onEmptySlotClick}
                startHour={startHour}
                endHour={endHour}
                showHeader={false}
                compact={false}
                showWorkingHours={showWorkingHours}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
