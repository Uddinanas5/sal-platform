"use client"

import React from "react"
import { isSameDay } from "date-fns"
import { Plus } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn, getInitials } from "@/lib/utils"
import { AppointmentBlock, type ColorByMode } from "./appointment-block"
import type { Appointment, Staff, Service } from "@/data/mock-data"

// --- Overlap/collision detection ---
// Groups overlapping appointments into columns so they render side-by-side
interface LayoutInfo {
  appointment: Appointment
  column: number
  totalColumns: number
}

function computeOverlapLayout(appointments: Appointment[]): LayoutInfo[] {
  if (appointments.length === 0) return []

  // Sort by start time, then by duration (longer first)
  const sorted = [...appointments].sort((a, b) => {
    const diff = a.startTime.getTime() - b.startTime.getTime()
    if (diff !== 0) return diff
    const durA = a.endTime.getTime() - a.startTime.getTime()
    const durB = b.endTime.getTime() - b.startTime.getTime()
    return durB - durA
  })

  // For each appointment, find the earliest column where it doesn't overlap
  const columns: { end: number }[][] = [] // columns[col] = array of {end} times
  const layout: Map<string, { column: number }> = new Map()

  for (const apt of sorted) {
    const aptStart = apt.startTime.getTime()
    const aptEnd = apt.endTime.getTime()

    let placed = false
    for (let col = 0; col < columns.length; col++) {
      const colSlots = columns[col]
      // Check if this appointment overlaps any existing slot in this column
      const hasOverlap = colSlots.some(
        (slot) => aptStart < slot.end
      )
      if (!hasOverlap) {
        colSlots.push({ end: aptEnd })
        layout.set(apt.id, { column: col })
        placed = true
        break
      }
    }

    if (!placed) {
      columns.push([{ end: aptEnd }])
      layout.set(apt.id, { column: columns.length - 1 })
    }
  }

  // Now determine totalColumns for each overlap cluster
  // Build clusters of appointments that transitively overlap
  const clusters: Appointment[][] = []
  const assigned = new Set<string>()

  for (const apt of sorted) {
    if (assigned.has(apt.id)) continue

    const cluster: Appointment[] = [apt]
    assigned.add(apt.id)

    // Expand cluster: find all that overlap with any member
    let i = 0
    while (i < cluster.length) {
      const current = cluster[i]
      for (const other of sorted) {
        if (assigned.has(other.id)) continue
        // Check if other overlaps with current
        if (
          other.startTime.getTime() < current.endTime.getTime() &&
          other.endTime.getTime() > current.startTime.getTime()
        ) {
          cluster.push(other)
          assigned.add(other.id)
        }
      }
      i++
    }

    clusters.push(cluster)
  }

  // For each cluster, find the max column used
  const result: LayoutInfo[] = []
  for (const cluster of clusters) {
    let maxCol = 0
    for (const apt of cluster) {
      const col = layout.get(apt.id)?.column || 0
      if (col > maxCol) maxCol = col
    }
    const totalColumns = maxCol + 1

    for (const apt of cluster) {
      result.push({
        appointment: apt,
        column: layout.get(apt.id)?.column || 0,
        totalColumns,
      })
    }
  }

  return result
}

interface StaffColumnProps {
  staff: Staff
  date: Date
  appointments: Appointment[]
  colorBy: ColorByMode
  zoom: number
  staffList: Staff[]
  serviceList: Service[]
  onAppointmentClick: (appointment: Appointment) => void
  onEmptySlotClick: (staffId: string, date: Date, hour: number, minute: number) => void
  startHour?: number
  endHour?: number
  showHeader?: boolean
  compact?: boolean
  showWorkingHours?: boolean
}

export function StaffColumn({
  staff,
  date,
  appointments,
  colorBy,
  zoom,
  staffList,
  serviceList,
  onAppointmentClick,
  onEmptySlotClick,
  startHour = 8,
  endHour = 20,
  showHeader = true,
  compact = false,
  showWorkingHours = false,
}: StaffColumnProps) {
  const slotHeight = 60 * zoom
  const totalSlots = (endHour - startHour) * 2
  const totalHeight = totalSlots * slotHeight

  // Filter appointments for this staff member on this date
  const dayAppointments = appointments.filter(
    (apt) =>
      apt.staffId === staff.id && isSameDay(new Date(apt.startTime), date)
  )

  // Compute overlap layout for side-by-side rendering
  const layoutInfo = computeOverlapLayout(dayAppointments)

  // Determine working hours for this day
  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
  const dayName = dayNames[date.getDay()]
  const todayHours = staff.workingHours[dayName]
  const isDayOff = todayHours === null || todayHours === undefined

  // Parse working hours into minutes
  let workStart = startHour * 60
  let workEnd = endHour * 60
  if (todayHours && !isDayOff) {
    const [sh, sm] = todayHours.start.split(":").map(Number)
    const [eh, em] = todayHours.end.split(":").map(Number)
    workStart = sh * 60 + sm
    workEnd = eh * 60 + em
  }

  // Build slot grid lines
  const slots: { hour: number; minute: number }[] = []
  for (let h = startHour; h < endHour; h++) {
    slots.push({ hour: h, minute: 0 })
    slots.push({ hour: h, minute: 30 })
  }

  const pixelsPerMinute = (60 * zoom) / 30

  return (
    <div
      className={cn(
        "flex flex-col border-r border-cream-200 last:border-r-0",
        compact ? "min-w-[120px]" : "min-w-[180px]"
      )}
      style={{
        backgroundColor: isDayOff && showWorkingHours ? "rgba(0,0,0,0.03)" : `${staff.color}08`,
      }}
    >
      {/* Staff header */}
      {showHeader && (
        <div className="sticky top-0 z-10 flex items-center gap-2 px-3 py-2 bg-white/95 backdrop-blur-sm border-b border-cream-200 h-[52px]">
          <Avatar className="h-7 w-7">
            <AvatarImage src={staff.avatar} />
            <AvatarFallback
              className="text-[10px] font-semibold text-white"
              style={{ backgroundColor: staff.color }}
            >
              {getInitials(staff.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-semibold text-foreground truncate">
              {staff.name}
            </span>
            {!compact && (
              <span className="text-[10px] text-muted-foreground/70 truncate">
                {isDayOff && showWorkingHours
                  ? "Day off"
                  : `${dayAppointments.length} appt${dayAppointments.length !== 1 ? "s" : ""}`}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Time grid with appointments */}
      <div className="relative" style={{ height: `${totalHeight}px` }}>
        {/* Working hours shading - before work */}
        {showWorkingHours && !isDayOff && workStart > startHour * 60 && (
          <div
            className="absolute left-0 right-0 z-[1] pointer-events-none"
            style={{
              top: 0,
              height: `${(workStart - startHour * 60) * pixelsPerMinute}px`,
              background: "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,0,0,0.03) 4px, rgba(0,0,0,0.03) 8px)",
              borderBottom: "1px dashed rgba(0,0,0,0.1)",
            }}
          />
        )}

        {/* Working hours shading - after work */}
        {showWorkingHours && !isDayOff && workEnd < endHour * 60 && (
          <div
            className="absolute left-0 right-0 z-[1] pointer-events-none"
            style={{
              top: `${(workEnd - startHour * 60) * pixelsPerMinute}px`,
              height: `${(endHour * 60 - workEnd) * pixelsPerMinute}px`,
              background: "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,0,0,0.03) 4px, rgba(0,0,0,0.03) 8px)",
              borderTop: "1px dashed rgba(0,0,0,0.1)",
            }}
          />
        )}

        {/* Full day off shading */}
        {showWorkingHours && isDayOff && (
          <div
            className="absolute inset-0 z-[1] pointer-events-none"
            style={{
              background: "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,0,0,0.04) 4px, rgba(0,0,0,0.04) 8px)",
            }}
          >
            <div className="flex items-center justify-center h-full">
              <span className="text-xs font-medium text-muted-foreground/70 bg-white/80 px-2 py-1 rounded-md">
                Day Off
              </span>
            </div>
          </div>
        )}

        {/* Slot grid lines */}
        {slots.map((slot) => (
          <div
            key={`${slot.hour}-${slot.minute}`}
            className={cn(
              "absolute left-0 right-0 border-b group cursor-pointer hover:bg-sal-50/40 transition-colors",
              slot.minute === 0 ? "border-cream-200" : "border-cream-100"
            )}
            style={{
              top: `${((slot.hour - startHour) * 2 + (slot.minute === 30 ? 1 : 0)) * slotHeight}px`,
              height: `${slotHeight}px`,
            }}
            onClick={() => onEmptySlotClick(staff.id, date, slot.hour, slot.minute)}
          >
            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center h-full">
              <Plus className="h-3.5 w-3.5 text-muted-foreground/70" />
            </div>
          </div>
        ))}

        {/* Appointment blocks with overlap layout */}
        {layoutInfo.map(({ appointment, column, totalColumns }) => (
          <AppointmentBlock
            key={appointment.id}
            appointment={appointment}
            colorBy={colorBy}
            zoom={zoom}
            staffList={staffList}
            serviceList={serviceList}
            onClick={onAppointmentClick}
            startHour={startHour}
            compact={compact}
            overlapColumn={column}
            overlapTotalColumns={totalColumns}
          />
        ))}
      </div>
    </div>
  )
}
