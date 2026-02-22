"use client"

import React, { useState } from "react"
import { motion } from "framer-motion"
import { Save, Coffee } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { TimePicker } from "@/components/ui/time-picker"
import { cn } from "@/lib/utils"
import { type Staff } from "@/data/mock-data"
import { toast } from "sonner"

interface StaffScheduleTabProps {
  staff: Staff
}

const DAYS = [
  { key: "monday", label: "Monday", short: "Mon" },
  { key: "tuesday", label: "Tuesday", short: "Tue" },
  { key: "wednesday", label: "Wednesday", short: "Wed" },
  { key: "thursday", label: "Thursday", short: "Thu" },
  { key: "friday", label: "Friday", short: "Fri" },
  { key: "saturday", label: "Saturday", short: "Sat" },
  { key: "sunday", label: "Sunday", short: "Sun" },
]

type ScheduleState = {
  [day: string]: { start: string; end: string; isOff: boolean; breakStart: string; breakEnd: string; hasBreak: boolean }
}

export function StaffScheduleTab({ staff }: StaffScheduleTabProps) {
  const [schedule, setSchedule] = useState<ScheduleState>(() => {
    const initial: ScheduleState = {}
    DAYS.forEach(({ key }) => {
      const hours = staff.workingHours[key]
      const isOff = hours === null
      initial[key] = {
        start: hours?.start ?? "09:00",
        end: hours?.end ?? "17:00",
        isOff,
        breakStart: "12:00",
        breakEnd: "13:00",
        hasBreak: !isOff,
      }
    })
    return initial
  })

  const handleDayOffToggle = (day: string) => {
    setSchedule((prev) => {
      const newIsOff = !prev[day].isOff
      return {
        ...prev,
        [day]: {
          ...prev[day],
          isOff: newIsOff,
          hasBreak: newIsOff ? false : prev[day].hasBreak,
        },
      }
    })
  }

  const handleTimeChange = (
    day: string,
    field: "start" | "end",
    value: string
  ) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }))
  }

  const handleBreakToggle = (day: string) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: { ...prev[day], hasBreak: !prev[day].hasBreak },
    }))
  }

  const handleBreakTimeChange = (
    day: string,
    field: "breakStart" | "breakEnd",
    value: string
  ) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }))
  }

  const handleSave = () => {
    toast.success(`Schedule for ${staff.name} saved successfully`)
  }

  // Convert "HH:MM" to total minutes
  const toMinutes = (time: string): number => {
    const [h, m] = time.split(":").map(Number)
    return h * 60 + m
  }

  // Calculate total working hours for visual overview
  const getHoursCount = (
    start: string,
    end: string,
    hasBreak?: boolean,
    breakStart?: string,
    breakEnd?: string
  ): number => {
    const total = (toMinutes(end) - toMinutes(start)) / 60
    if (hasBreak && breakStart && breakEnd) {
      const breakDuration = (toMinutes(breakEnd) - toMinutes(breakStart)) / 60
      return Math.max(total - breakDuration, 0)
    }
    return total
  }

  // Calculate total weekly hours
  const totalWeeklyHours = DAYS.reduce((sum, { key }) => {
    const day = schedule[key]
    if (day.isOff) return sum
    return sum + getHoursCount(day.start, day.end, day.hasBreak, day.breakStart, day.breakEnd)
  }, 0)

  return (
    <div className="space-y-6">
      {/* Schedule Editor */}
      <Card>
        <CardContent className="p-4">
          <h3 className="font-semibold text-foreground mb-4">
            Weekly Schedule
          </h3>
          <div className="space-y-3">
            {DAYS.map(({ key, label }, index) => {
              const day = schedule[key]
              return (
                <motion.div
                  key={key}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    "p-3 rounded-lg border transition-colors",
                    day.isOff
                      ? "bg-cream-50 border-cream-200"
                      : "bg-cream-50 border-cream-200"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-24 shrink-0">
                      <span
                        className={cn(
                          "text-sm font-medium",
                          day.isOff ? "text-muted-foreground/70" : "text-foreground"
                        )}
                      >
                        {label}
                      </span>
                    </div>

                    <div
                      className={cn(
                        "flex items-center gap-3 flex-1",
                        day.isOff && "opacity-40 pointer-events-none"
                      )}
                    >
                      <TimePicker
                        value={day.start}
                        onChange={(v) => handleTimeChange(key, "start", v)}
                        className="w-32"
                        startHour={6}
                        endHour={22}
                      />
                      <span className="text-sm text-muted-foreground">to</span>
                      <TimePicker
                        value={day.end}
                        onChange={(v) => handleTimeChange(key, "end", v)}
                        className="w-32"
                        startHour={6}
                        endHour={22}
                      />
                    </div>

                    <div
                      className={cn(
                        "flex items-center gap-2 shrink-0",
                        day.isOff && "opacity-40 pointer-events-none"
                      )}
                    >
                      <Button
                        type="button"
                        variant={day.hasBreak ? "default" : "outline"}
                        size="sm"
                        className={cn(
                          "h-7 px-2 text-xs gap-1",
                          day.hasBreak
                            ? "bg-amber-500 hover:bg-amber-600 text-white"
                            : "text-muted-foreground"
                        )}
                        onClick={() => handleBreakToggle(key)}
                      >
                        <Coffee className="w-3 h-3" />
                        Break
                      </Button>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground">Day Off</span>
                      <Switch
                        checked={day.isOff}
                        onCheckedChange={() => handleDayOffToggle(key)}
                      />
                    </div>
                  </div>

                  {/* Break time pickers */}
                  {day.hasBreak && !day.isOff && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="flex items-center gap-3 mt-2 ml-24 pl-4 border-l-2 border-amber-300"
                    >
                      <Coffee className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span className="text-xs text-amber-700 font-medium shrink-0">
                        Break
                      </span>
                      <TimePicker
                        value={day.breakStart}
                        onChange={(v) =>
                          handleBreakTimeChange(key, "breakStart", v)
                        }
                        className="w-32"
                        startHour={6}
                        endHour={22}
                      />
                      <span className="text-xs text-muted-foreground">to</span>
                      <TimePicker
                        value={day.breakEnd}
                        onChange={(v) =>
                          handleBreakTimeChange(key, "breakEnd", v)
                        }
                        className="w-32"
                        startHour={6}
                        endHour={22}
                      />
                      <span className="text-xs text-muted-foreground/70">
                        ({((toMinutes(day.breakEnd) - toMinutes(day.breakStart)) / 60).toFixed(1)}h)
                      </span>
                    </motion.div>
                  )}
                </motion.div>
              )
            })}
          </div>

          <div className="flex justify-end mt-4">
            <Button onClick={handleSave}>
              <Save className="w-4 h-4 mr-2" />
              Save Schedule
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Visual Weekly Overview */}
      <Card>
        <CardContent className="p-4">
          <h3 className="font-semibold text-foreground mb-4">
            Weekly Overview
          </h3>
          <div className="space-y-2">
            {DAYS.map(({ key, short }) => {
              const day = schedule[key]
              if (day.isOff) {
                return (
                  <div key={key} className="flex items-center gap-3">
                    <span className="w-10 text-xs font-medium text-muted-foreground/70">
                      {short}
                    </span>
                    <div className="flex-1 h-8 rounded-lg bg-cream-100 flex items-center justify-center">
                      <span className="text-xs text-muted-foreground/70">Day Off</span>
                    </div>
                    <span className="w-12 text-right text-xs text-muted-foreground/70">
                      0h
                    </span>
                  </div>
                )
              }

              const hours = getHoursCount(day.start, day.end, day.hasBreak, day.breakStart, day.breakEnd)
              const startMin = toMinutes(day.start)
              const endMin = toMinutes(day.end)
              // Map 6:00-22:00 (360-1320 minutes) to 0-100%
              const totalRange = 16 * 60 // 960 minutes
              const baseOffset = 6 * 60 // 360 minutes

              const leftPercent = ((startMin - baseOffset) / totalRange) * 100
              const widthPercent = ((endMin - startMin) / totalRange) * 100

              // Break position within the bar (relative to the full timeline)
              const hasBreakBar = day.hasBreak && day.breakStart && day.breakEnd
              let breakLeftPercent = 0
              let breakWidthPercent = 0
              if (hasBreakBar) {
                const breakStartMin = toMinutes(day.breakStart)
                const breakEndMin = toMinutes(day.breakEnd)
                breakLeftPercent = ((breakStartMin - baseOffset) / totalRange) * 100
                breakWidthPercent = ((breakEndMin - breakStartMin) / totalRange) * 100
              }

              return (
                <div key={key} className="flex items-center gap-3">
                  <span className="w-10 text-xs font-medium text-foreground">
                    {short}
                  </span>
                  <div className="flex-1 h-8 rounded-lg bg-cream-100 relative overflow-hidden">
                    {/* Working hours bar */}
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${widthPercent}%` }}
                      transition={{ duration: 0.5, delay: 0.1 }}
                      className="absolute h-full rounded-lg"
                      style={{
                        left: `${leftPercent}%`,
                        backgroundColor: `${staff.color}80`,
                        borderLeft: `3px solid ${staff.color}`,
                      }}
                    >
                      <div className="flex items-center justify-center h-full">
                        <span className="text-xs font-medium text-foreground whitespace-nowrap px-1">
                          {day.start} - {day.end}
                        </span>
                      </div>
                    </motion.div>

                    {/* Break gap overlay */}
                    {hasBreakBar && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3, delay: 0.4 }}
                        className="absolute h-full"
                        style={{
                          left: `${breakLeftPercent}%`,
                          width: `${breakWidthPercent}%`,
                          background: `repeating-linear-gradient(
                            45deg,
                            transparent,
                            transparent 3px,
                            rgba(255,255,255,0.6) 3px,
                            rgba(255,255,255,0.6) 6px
                          )`,
                          backgroundColor: "rgba(245, 158, 11, 0.25)",
                        }}
                      >
                        <div className="flex items-center justify-center h-full">
                          <Coffee className="w-3 h-3 text-amber-700 opacity-70" />
                        </div>
                      </motion.div>
                    )}
                  </div>
                  <span className="w-12 text-right text-xs font-medium text-muted-foreground">
                    {hours.toFixed(1)}h
                  </span>
                </div>
              )
            })}
          </div>

          {/* Time axis labels */}
          <div className="flex items-center gap-3 mt-1">
            <span className="w-10" />
            <div className="flex-1 flex justify-between px-1">
              {["6AM", "10AM", "2PM", "6PM", "10PM"].map((t) => (
                <span key={t} className="text-[10px] text-muted-foreground/70">
                  {t}
                </span>
              ))}
            </div>
            <span className="w-12" />
          </div>

          {/* Total weekly hours summary */}
          <div className="mt-4 pt-3 border-t border-cream-200 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-foreground">
                Total Weekly Hours
              </span>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <span
                    className="inline-block w-3 h-3 rounded-sm"
                    style={{ backgroundColor: `${staff.color}80` }}
                  />
                  Working
                </span>
                <span className="inline-flex items-center gap-1">
                  <span
                    className="inline-block w-3 h-3 rounded-sm"
                    style={{
                      background: `repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.6) 2px, rgba(255,255,255,0.6) 4px), rgba(245, 158, 11, 0.25)`,
                    }}
                  />
                  Break
                </span>
              </div>
            </div>
            <span className="text-lg font-bold text-foreground">
              {totalWeeklyHours.toFixed(1)}h
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
