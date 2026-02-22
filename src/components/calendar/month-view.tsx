"use client"

import { useMemo } from "react"
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  isWeekend,
} from "date-fns"
import { cn } from "@/lib/utils"
import type { Appointment, Staff, Service } from "@/data/mock-data"
import type { ColorByMode } from "./appointment-block"

// --- Status dot colors (matching appointment-block.tsx patterns) ---

const STATUS_DOT_COLORS: Record<string, string> = {
  pending: "#3b82f6",
  confirmed: "#8b5cf6",
  "checked-in": "#f59e0b",
  "in-progress": "#10b981",
  completed: "#6b7280",
  "no-show": "#ef4444",
  cancelled: "#ef4444",
}

const SERVICE_CATEGORY_COLORS: Record<string, string> = {
  Hair: "#f97316",
  Wellness: "#10b981",
  Nails: "#ec4899",
  Skincare: "#06b6d4",
  "Brows & Lashes": "#a855f7",
  Body: "#14b8a6",
}

function hashCategoryToColor(category: string): string {
  if (SERVICE_CATEGORY_COLORS[category]) {
    return SERVICE_CATEGORY_COLORS[category]
  }
  // Fallback: simple hash to pick from a set of predefined colors
  const fallbackColors = [
    "#f97316",
    "#8b5cf6",
    "#10b981",
    "#ec4899",
    "#06b6d4",
    "#a855f7",
    "#14b8a6",
    "#f59e0b",
  ]
  let hash = 0
  for (let i = 0; i < category.length; i++) {
    hash = category.charCodeAt(i) + ((hash << 5) - hash)
  }
  return fallbackColors[Math.abs(hash) % fallbackColors.length]
}

function getDotColor(
  appointment: Appointment,
  colorBy: ColorByMode,
  staffList: Staff[],
  serviceList: Service[]
): string {
  if (colorBy === "status") {
    return STATUS_DOT_COLORS[appointment.status] || "#6b7280"
  }

  if (colorBy === "staff") {
    const staff = staffList.find((s) => s.id === appointment.staffId)
    return staff?.color || "#6b7280"
  }

  // colorBy === "service"
  const service = serviceList.find((s) => s.id === appointment.serviceId)
  if (service) {
    return hashCategoryToColor(service.category)
  }
  return "#6b7280"
}

// --- Component ---

interface MonthViewProps {
  date: Date
  appointments: Appointment[]
  staff: Staff[]
  services: Service[]
  colorBy: ColorByMode
  onDayClick: (date: Date) => void
  onAppointmentClick: (appointment: Appointment) => void
}

const DAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const DAY_HEADERS_SHORT = ["M", "T", "W", "T", "F", "S", "S"]
const MAX_DOTS = 3

export function MonthView({
  date,
  appointments,
  staff,
  services,
  colorBy,
  onDayClick,
  onAppointmentClick,
}: MonthViewProps) {
  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  // Build the grid of days: from the Monday of the week containing the 1st,
  // to the Sunday of the week containing the last day of the month.
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(date)
    const monthEnd = endOfMonth(date)
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

    const days: Date[] = []
    let current = gridStart
    while (current <= gridEnd) {
      days.push(current)
      current = addDays(current, 1)
    }
    return days
  }, [date])

  // Group appointments by date string for quick lookup
  const appointmentsByDay = useMemo(() => {
    const map = new Map<string, Appointment[]>()
    for (const apt of appointments) {
      const key = format(apt.startTime, "yyyy-MM-dd")
      const existing = map.get(key)
      if (existing) {
        existing.push(apt)
      } else {
        map.set(key, [apt])
      }
    }
    return map
  }, [appointments])

  // Split days into rows of 7
  const weeks = useMemo(() => {
    const rows: Date[][] = []
    for (let i = 0; i < calendarDays.length; i += 7) {
      rows.push(calendarDays.slice(i, i + 7))
    }
    return rows
  }, [calendarDays])

  return (
    <div className="flex flex-col h-full">
      {/* Day-of-week header */}
      <div className="grid grid-cols-7 border-b border-cream-200 bg-card shrink-0">
        {DAY_HEADERS.map((dayName, i) => (
          <div
            key={dayName}
            className={cn(
              "py-2 sm:py-2.5 text-center text-[10px] sm:text-[11px] font-medium uppercase tracking-wide",
              dayName === "Sat" || dayName === "Sun"
                ? "text-muted-foreground/60"
                : "text-muted-foreground"
            )}
          >
            <span className="hidden sm:inline">{dayName}</span>
            <span className="sm:hidden">{DAY_HEADERS_SHORT[i]}</span>
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="flex-1 grid grid-rows-[repeat(auto-fill,minmax(0,1fr))]">
        {weeks.map((week, weekIdx) => (
          <div key={weekIdx} className="grid grid-cols-7 border-b border-cream-200 last:border-b-0">
            {week.map((day) => {
              const isCurrentMonth = isSameMonth(day, date)
              const isToday = isSameDay(day, today)
              const weekend = isWeekend(day)
              const dayKey = format(day, "yyyy-MM-dd")
              const dayAppointments = appointmentsByDay.get(dayKey) || []
              const overflowCount = dayAppointments.length - MAX_DOTS
              const visibleAppointments = dayAppointments.slice(0, MAX_DOTS)

              return (
                <div
                  key={dayKey}
                  className={cn(
                    "min-h-[70px] sm:min-h-[100px] p-1 sm:p-1.5 border-r border-cream-200 last:border-r-0 cursor-pointer transition-colors",
                    "hover:bg-cream-100 hover:rounded-lg",
                    weekend && "bg-cream-50",
                    !isCurrentMonth && "opacity-40"
                  )}
                  onClick={() => onDayClick(day)}
                >
                  {/* Day number */}
                  <div className="flex items-start justify-between mb-1">
                    <span
                      className={cn(
                        "inline-flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 text-xs sm:text-sm rounded-full",
                        isToday &&
                          "ring-2 ring-sal-400 font-bold text-sal-700 bg-sal-50",
                        !isToday && isCurrentMonth && "text-foreground",
                        !isToday && !isCurrentMonth && "text-muted-foreground/70"
                      )}
                    >
                      {format(day, "d")}
                    </span>
                  </div>

                  {/* Appointment dots */}
                  {dayAppointments.length > 0 && (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1 flex-wrap">
                        {visibleAppointments.map((apt) => (
                          <button
                            key={apt.id}
                            type="button"
                            className="w-2 h-2 rounded-full shrink-0 hover:scale-150 transition-transform"
                            style={{
                              backgroundColor: getDotColor(
                                apt,
                                colorBy,
                                staff,
                                services
                              ),
                            }}
                            onClick={(e) => {
                              e.stopPropagation()
                              onAppointmentClick(apt)
                            }}
                            title={`${apt.clientName} - ${apt.serviceName}`}
                          />
                        ))}
                      </div>
                      {overflowCount > 0 && (
                        <button
                          className="text-[10px] text-sal-600 font-medium leading-tight hover:text-sal-800 hover:underline transition-colors"
                          onClick={(e) => {
                            e.stopPropagation()
                            onDayClick(day)
                          }}
                        >
                          +{overflowCount} more
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
