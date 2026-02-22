"use client"

import React, { useState, useEffect } from "react"
import { format, isSameDay } from "date-fns"
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Settings,
  Users,
  CalendarDays,
  Filter,
  Check,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import { CalendarSettingsPopover } from "./calendar-settings-popover"
import type { ColorByMode } from "./appointment-block"
import type { Staff } from "@/data/mock-data"

export type CalendarView = "day" | "3day" | "week" | "month"

const STATUS_OPTIONS = [
  { value: "pending", label: "Booked", color: "#3b82f6" },
  { value: "confirmed", label: "Confirmed", color: "#8b5cf6" },
  { value: "checked-in", label: "Arrived", color: "#f59e0b" },
  { value: "in-progress", label: "Started", color: "#10b981" },
  { value: "completed", label: "Completed", color: "#6b7280" },
  { value: "no-show", label: "No Show", color: "#ef4444" },
  { value: "cancelled", label: "Cancelled", color: "#ef4444" },
]

interface CalendarHeaderProps {
  currentDate: Date
  view: CalendarView
  onDateChange: (date: Date) => void
  onViewChange: (view: CalendarView) => void
  onTodayClick: () => void
  onPrev: () => void
  onNext: () => void
  onNewAppointment: () => void
  onSettingsClick: () => void
  settingsOpen?: boolean
  onSettingsOpenChange?: (open: boolean) => void
  colorBy?: ColorByMode
  onColorByChange?: (mode: ColorByMode) => void
  zoom?: number
  onZoomChange?: (zoom: number) => void
  showWorkingHours?: boolean
  onShowWorkingHoursChange?: (show: boolean) => void
  staff: Staff[]
  selectedStaffId: string
  onStaffFilterChange: (staffId: string) => void
  statusFilter?: Set<string>
  onStatusFilterChange?: (statuses: Set<string>) => void
}

export function CalendarHeader({
  currentDate,
  view,
  onDateChange,
  onViewChange,
  onTodayClick,
  onPrev,
  onNext,
  onNewAppointment,
  onSettingsClick,
  settingsOpen,
  onSettingsOpenChange,
  colorBy,
  onColorByChange,
  zoom,
  onZoomChange,
  showWorkingHours,
  onShowWorkingHoursChange,
  staff,
  selectedStaffId,
  onStaffFilterChange,
  statusFilter,
  onStatusFilterChange,
}: CalendarHeaderProps) {
  const dateLabelFull = format(currentDate, "EEEE, MMMM d, yyyy")
  const dateLabelShort = format(currentDate, "MMM d, yyyy")
  const [miniCalOpen, setMiniCalOpen] = useState(false)
  const [currentTime, setCurrentTime] = useState<string>("")
  const isToday = isSameDay(currentDate, new Date())

  useEffect(() => {
    if (!isToday) return
    const update = () => setCurrentTime(format(new Date(), "h:mm a"))
    update()
    const interval = setInterval(update, 60000)
    return () => clearInterval(interval)
  }, [isToday])

  return (
    <div className="flex flex-col gap-2 px-3 py-2.5 sm:px-4 sm:py-3 bg-card border-b border-cream-200">
      {/* Row 1: Navigation + Date */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <Button
            variant="outline"
            size="sm"
            onClick={onTodayClick}
            className="font-medium h-8 px-2.5 sm:px-3"
          >
            Today
          </Button>
          <div className="flex items-center">
            <Button variant="ghost" size="icon" onClick={onPrev} className="h-8 w-8" aria-label="Previous">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onNext} className="h-8 w-8" aria-label="Next">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Popover open={miniCalOpen} onOpenChange={setMiniCalOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                className="gap-1.5 font-heading font-semibold text-foreground text-sm sm:text-base hover:bg-cream-100 px-1.5 sm:px-2 min-w-0"
              >
                <CalendarDays className="h-4 w-4 text-sal-500 shrink-0" />
                <span className="hidden sm:inline truncate">{dateLabelFull}</span>
                <span className="sm:hidden truncate">{dateLabelShort}</span>
                {isToday && currentTime && (
                  <span className="text-xs font-normal text-sal-600 bg-sal-50 rounded-md px-1.5 py-0.5 ml-1 shrink-0">
                    {currentTime}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={currentDate}
                onSelect={(date: Date | undefined) => {
                  if (date) {
                    onDateChange(date)
                    setMiniCalOpen(false)
                  }
                }}
                defaultMonth={currentDate}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Settings + New (desktop only for New) */}
        <div className="flex items-center gap-1.5">
          {onSettingsOpenChange && colorBy && onColorByChange && zoom !== undefined && onZoomChange && showWorkingHours !== undefined && onShowWorkingHoursChange ? (
            <CalendarSettingsPopover
              open={settingsOpen ?? false}
              onOpenChange={onSettingsOpenChange}
              colorBy={colorBy}
              onColorByChange={onColorByChange}
              zoom={zoom}
              onZoomChange={onZoomChange}
              showWorkingHours={showWorkingHours}
              onShowWorkingHoursChange={onShowWorkingHoursChange}
            />
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={onSettingsClick}
              className="h-8 w-8"
            >
              <Settings className="h-4 w-4 text-muted-foreground" />
            </Button>
          )}
          <Button size="sm" onClick={onNewAppointment} className="hidden sm:flex h-8 gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            New Appointment
          </Button>
        </div>
      </div>

      {/* Row 2: View toggles + Staff filter */}
      <div className="flex items-center justify-between gap-2">
        {/* View toggles */}
        <div className="flex items-center gap-1 bg-cream-100 rounded-lg p-0.5 sm:p-1">
          {(["day", "3day", "week", "month"] as CalendarView[]).map((v) => (
            <Button
              key={v}
              variant={view === v ? "default" : "ghost"}
              size="sm"
              onClick={() => onViewChange(v)}
              className={cn(
                "h-7 sm:h-8 px-2.5 sm:px-4 text-xs sm:text-sm font-medium transition-all",
                view === v
                  ? "bg-background text-foreground shadow-sm hover:bg-background"
                  : "text-muted-foreground hover:text-foreground hover:bg-transparent"
              )}
            >
              {v === "day" ? "Day" : v === "3day" ? "3-Day" : v === "week" ? "Week" : "Month"}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {/* Status filter */}
          {onStatusFilterChange && (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-8 sm:h-9 text-xs sm:text-sm gap-1.5",
                    statusFilter && statusFilter.size > 0 && "border-sal-300 bg-sal-50 text-sal-700"
                  )}
                >
                  <Filter className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Status</span>
                  {statusFilter && statusFilter.size > 0 && (
                    <span className="bg-sal-500 text-white text-[10px] rounded-full px-1.5 py-0.5 min-w-[18px] text-center font-semibold">
                      {statusFilter.size}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-52 p-2">
                <p className="text-xs font-medium text-muted-foreground px-2 pb-2">Filter by status</p>
                {STATUS_OPTIONS.map((opt) => {
                  const isChecked = statusFilter?.has(opt.value) || false
                  return (
                    <button
                      key={opt.value}
                      onClick={() => {
                        const next = new Set(statusFilter)
                        if (isChecked) {
                          next.delete(opt.value)
                        } else {
                          next.add(opt.value)
                        }
                        onStatusFilterChange(next)
                      }}
                      className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm hover:bg-cream-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sal-500"
                    >
                      <span
                        className={cn(
                          "flex h-4 w-4 items-center justify-center rounded border",
                          isChecked ? "bg-sal-500 border-sal-500" : "border-cream-300"
                        )}
                      >
                        {isChecked && <Check className="h-3 w-3 text-white" />}
                      </span>
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: opt.color }}
                      />
                      {opt.label}
                    </button>
                  )
                })}
                {statusFilter && statusFilter.size > 0 && (
                  <button
                    onClick={() => onStatusFilterChange(new Set())}
                    className="w-full text-xs text-sal-600 hover:text-sal-800 mt-2 py-1"
                  >
                    Clear all filters
                  </button>
                )}
              </PopoverContent>
            </Popover>
          )}

          {/* Staff filter */}
          <Select value={selectedStaffId} onValueChange={onStaffFilterChange}>
            <SelectTrigger className="w-[140px] sm:w-[160px] h-8 sm:h-9 text-xs sm:text-sm">
              <Users className="h-3.5 w-3.5 mr-1 text-muted-foreground/70" />
              <SelectValue placeholder="All Staff" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Staff</SelectItem>
              {staff.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: s.color }}
                    />
                    {s.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}
