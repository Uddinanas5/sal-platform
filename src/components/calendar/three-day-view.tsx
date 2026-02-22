"use client"

import React, { useRef, useEffect } from "react"
import { format, addDays } from "date-fns"
import { TimeColumn } from "./time-column"
import { StaffColumn } from "./staff-column"
import { TimeIndicator } from "./time-indicator"
import { cn } from "@/lib/utils"
import type { ColorByMode } from "./appointment-block"
import type { Appointment, Staff, Service } from "@/data/mock-data"

interface ThreeDayViewProps {
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

export function ThreeDayView({
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
}: ThreeDayViewProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const days = [date, addDays(date, 1), addDays(date, 2)]

  // Scroll to ~9 AM on mount
  useEffect(() => {
    if (scrollContainerRef.current) {
      const pixelsPerMinute = (60 * zoom) / 30
      const scrollTo = (9 - startHour) * 60 * pixelsPerMinute - 60
      scrollContainerRef.current.scrollTop = Math.max(0, scrollTo)
    }
  }, [zoom, startHour])

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return (
    <div className="flex flex-col h-full">
      {/* Day + Staff headers */}
      <div className="flex border-b border-cream-200 bg-card shrink-0">
        {/* Empty cell above time column */}
        <div className="w-[72px] shrink-0 border-r border-cream-200" />

        <div className="flex flex-1 overflow-x-auto">
          {days.map((day) => {
            const isToday = day.toDateString() === today.toDateString()
            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "flex flex-col border-r border-cream-200 last:border-r-0 flex-1",
                  isToday && "bg-sal-50/30"
                )}
              >
                {/* Day label */}
                <div className="text-center py-1.5 border-b border-cream-100">
                  <span
                    className={cn(
                      "text-[11px] font-medium uppercase",
                      isToday ? "text-sal-600" : "text-muted-foreground"
                    )}
                  >
                    {format(day, "EEE")}
                  </span>
                  <span
                    className={cn(
                      "ml-1 text-sm font-semibold",
                      isToday ? "text-sal-700" : "text-foreground"
                    )}
                  >
                    {format(day, "d")}
                  </span>
                </div>
                {/* Staff sub-headers */}
                <div className="flex">
                  {staff.map((s) => {
                    const staffDayAppts = appointments.filter(
                      (a) => a.staffId === s.id && a.startTime.toDateString() === day.toDateString()
                    ).length
                    return (
                    <div
                      key={s.id}
                      className="flex items-center justify-center gap-1 px-1 py-1 border-r border-cream-100 last:border-r-0 flex-1 min-w-[120px]"
                      style={{ backgroundColor: `${s.color}08` }}
                    >
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-semibold text-white shrink-0"
                        style={{ backgroundColor: s.color }}
                      >
                        {s.name.split(" ").map((n) => n[0]).join("")}
                      </div>
                      <span className="text-[10px] font-medium text-muted-foreground truncate">
                        {s.name.split(" ")[0]}
                      </span>
                      {staffDayAppts > 0 && (
                        <span className="text-[9px] font-semibold text-muted-foreground/70 bg-cream-100 rounded-full px-1 min-w-[16px] text-center">
                          {staffDayAppts}
                        </span>
                      )}
                    </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Scrollable grid body */}
      <div ref={scrollContainerRef} className="flex-1 overflow-auto relative">
        <div className="flex min-h-0">
          {/* Time column */}
          <TimeColumn zoom={zoom} startHour={startHour} endHour={endHour} />

          {/* Day groups with staff sub-columns */}
          <div className="flex flex-1 relative">
            <TimeIndicator zoom={zoom} startHour={startHour} />

            {days.map((day) => (
              <div
                key={day.toISOString()}
                className="flex border-r border-cream-300 last:border-r-0 flex-1"
              >
                {staff.map((s) => (
                  <StaffColumn
                    key={`${day.toISOString()}-${s.id}`}
                    staff={s}
                    date={day}
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
                    compact={true}
                    showWorkingHours={showWorkingHours}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
