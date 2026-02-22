"use client"

import React, { useRef, useEffect } from "react"
import { format, addDays, isSameDay, startOfWeek } from "date-fns"
import { TimeColumn } from "./time-column"
import { TimeIndicator } from "./time-indicator"
import { AppointmentBlock, type ColorByMode } from "./appointment-block"
import { cn } from "@/lib/utils"
import type { Appointment, Staff, Service } from "@/data/mock-data"

interface WeekViewProps {
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

export function WeekView({
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  showWorkingHours = false,
}: WeekViewProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const weekStart = startOfWeek(date, { weekStartsOn: 1 }) // Monday start
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const slotHeight = 60 * zoom
  const totalSlots = (endHour - startHour) * 2
  const totalHeight = totalSlots * slotHeight

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Scroll to ~9 AM on mount
  useEffect(() => {
    if (scrollContainerRef.current) {
      const pixelsPerMinute = (60 * zoom) / 30
      const scrollTo = (9 - startHour) * 60 * pixelsPerMinute - 60
      scrollContainerRef.current.scrollTop = Math.max(0, scrollTo)
    }
  }, [zoom, startHour])

  // Build half-hour slot markers
  const slots: { hour: number; minute: number }[] = []
  for (let h = startHour; h < endHour; h++) {
    slots.push({ hour: h, minute: 0 })
    slots.push({ hour: h, minute: 30 })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Day headers */}
      <div className="flex border-b border-cream-200 bg-card shrink-0">
        <div className="w-[72px] shrink-0 border-r border-cream-200" />
        <div className="flex flex-1">
          {days.map((day) => {
            const isToday = isSameDay(day, today)
            const dayApptCount = appointments.filter((a) =>
              isSameDay(new Date(a.startTime), day)
            ).length
            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "flex-1 text-center py-2.5 border-r border-cream-200 last:border-r-0",
                  isToday && "bg-sal-50/40"
                )}
              >
                <span
                  className={cn(
                    "text-[11px] font-medium uppercase block",
                    isToday ? "text-sal-600" : "text-muted-foreground"
                  )}
                >
                  {format(day, "EEE")}
                </span>
                <div className="flex items-center justify-center gap-1.5">
                  <span
                    className={cn(
                      "text-lg font-heading font-semibold",
                      isToday ? "text-sal-700" : "text-foreground"
                    )}
                  >
                    {format(day, "d")}
                  </span>
                  {dayApptCount > 0 && (
                    <span className={cn(
                      "text-[9px] font-semibold rounded-full px-1 min-w-[16px] text-center",
                      isToday
                        ? "bg-sal-500 text-white"
                        : "bg-cream-200 text-muted-foreground"
                    )}>
                      {dayApptCount}
                    </span>
                  )}
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

          {/* Day columns */}
          <div className="flex flex-1 relative">
            <TimeIndicator zoom={zoom} startHour={startHour} />

            {days.map((day) => {
              const isToday = isSameDay(day, today)
              const dayAppointments = appointments.filter((apt) =>
                isSameDay(new Date(apt.startTime), day)
              )

              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "flex-1 relative border-r border-cream-200 last:border-r-0 min-w-[100px]",
                    isToday && "bg-sal-50/20"
                  )}
                  style={{ height: `${totalHeight}px` }}
                >
                  {/* Grid lines */}
                  {slots.map((slot) => (
                    <div
                      key={`${slot.hour}-${slot.minute}`}
                      className={cn(
                        "absolute left-0 right-0 border-b cursor-pointer hover:bg-sal-50/30 transition-colors",
                        slot.minute === 0 ? "border-cream-200" : "border-cream-100"
                      )}
                      style={{
                        top: `${((slot.hour - startHour) * 2 + (slot.minute === 30 ? 1 : 0)) * slotHeight}px`,
                        height: `${slotHeight}px`,
                      }}
                      onClick={() =>
                        onEmptySlotClick(
                          staff[0]?.id || "",
                          day,
                          slot.hour,
                          slot.minute
                        )
                      }
                    />
                  ))}

                  {/* Stacked appointment blocks */}
                  {dayAppointments.map((apt) => (
                    <AppointmentBlock
                      key={apt.id}
                      appointment={apt}
                      colorBy={colorBy}
                      zoom={zoom}
                      staffList={staff}
                      serviceList={services}
                      onClick={onAppointmentClick}
                      startHour={startHour}
                      compact={true}
                    />
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
