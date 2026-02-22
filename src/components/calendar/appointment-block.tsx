"use client"

import React from "react"
import { motion } from "framer-motion"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { Appointment, Staff, Service } from "@/data/mock-data"

export type ColorByMode = "status" | "staff" | "service"

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  pending: { bg: "rgba(59, 130, 246, 0.12)", border: "#3b82f6", text: "#2563eb" },
  confirmed: { bg: "rgba(139, 92, 246, 0.12)", border: "#8b5cf6", text: "#7c3aed" },
  "checked-in": { bg: "rgba(245, 158, 11, 0.12)", border: "#f59e0b", text: "#d97706" },
  "in-progress": { bg: "rgba(16, 185, 129, 0.12)", border: "#10b981", text: "#059669" },
  completed: { bg: "rgba(107, 114, 128, 0.12)", border: "#6b7280", text: "#6b7280" },
  "no-show": { bg: "rgba(239, 68, 68, 0.12)", border: "#ef4444", text: "#dc2626" },
  cancelled: { bg: "rgba(252, 165, 165, 0.2)", border: "#fca5a5", text: "#dc2626" },
}

function getBlockColors(
  appointment: Appointment,
  colorBy: ColorByMode,
  staffList: Staff[],
  serviceList: Service[]
): { bg: string; border: string; text: string } {
  if (colorBy === "status") {
    return STATUS_COLORS[appointment.status] || STATUS_COLORS.confirmed
  }

  if (colorBy === "staff") {
    const staff = staffList.find((s) => s.id === appointment.staffId)
    const color = staff?.color || "#6b7280"
    return {
      bg: `${color}1A`,
      border: color,
      text: color,
    }
  }

  // service
  const service = serviceList.find((s) => s.id === appointment.serviceId)
  const color = service?.color || "#6b7280"
  return {
    bg: `${color}1A`,
    border: color,
    text: color,
  }
}

interface AppointmentBlockProps {
  appointment: Appointment
  colorBy: ColorByMode
  zoom: number
  staffList: Staff[]
  serviceList: Service[]
  onClick: (appointment: Appointment) => void
  startHour?: number
  compact?: boolean
  overlapColumn?: number
  overlapTotalColumns?: number
}

export function AppointmentBlock({
  appointment,
  colorBy,
  zoom,
  staffList,
  serviceList,
  onClick,
  startHour = 8,
  compact = false,
  overlapColumn = 0,
  overlapTotalColumns = 1,
}: AppointmentBlockProps) {
  const pixelsPerMinute = (60 * zoom) / 30
  const startMinutes =
    appointment.startTime.getHours() * 60 + appointment.startTime.getMinutes()
  const endMinutes =
    appointment.endTime.getHours() * 60 + appointment.endTime.getMinutes()
  const durationMinutes = endMinutes - startMinutes

  const top = (startMinutes - startHour * 60) * pixelsPerMinute
  const height = Math.max(durationMinutes * pixelsPerMinute, 24)

  const colors = getBlockColors(appointment, colorBy, staffList, serviceList)
  const timeRange = `${format(appointment.startTime, "h:mm a")} - ${format(
    appointment.endTime,
    "h:mm a"
  )}`

  // Duration display
  const durationLabel = durationMinutes >= 60
    ? `${Math.floor(durationMinutes / 60)}h${durationMinutes % 60 > 0 ? ` ${durationMinutes % 60}m` : ""}`
    : `${durationMinutes}m`

  const isShort = height < 50

  // Overlap positioning: compute left/right percentages
  const colWidthPercent = 100 / overlapTotalColumns
  const leftPercent = overlapColumn * colWidthPercent
  const rightPercent = 100 - (overlapColumn + 1) * colWidthPercent
  const paddingPx = 2 // gap between columns

  // Status label for tooltip
  const statusLabel = appointment.status.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{
        scale: 1.02,
        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
        zIndex: 20,
      }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      tabIndex={0}
      role="button"
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onClick(appointment)
        }
      }}
      className={cn(
        "absolute rounded-md cursor-pointer overflow-hidden",
        "border-l-[3px] px-1.5 py-1",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sal-500 focus-visible:ring-offset-1"
      )}
      style={{
        top: `${top}px`,
        height: `${height}px`,
        left: overlapTotalColumns > 1
          ? `calc(${leftPercent}% + ${paddingPx}px)`
          : "4px",
        right: overlapTotalColumns > 1
          ? `calc(${rightPercent}% + ${paddingPx}px)`
          : "4px",
        backgroundColor: colors.bg,
        borderLeftColor: colors.border,
      }}
      onClick={(e) => {
        e.stopPropagation()
        onClick(appointment)
      }}
    >
      {isShort ? (
        <div className="flex items-center gap-1.5 h-full overflow-hidden">
          <span
            className="text-[11px] font-semibold truncate"
            style={{ color: colors.text }}
          >
            {appointment.clientName}
          </span>
          {!compact && overlapTotalColumns <= 2 && (
            <span className="text-[10px] text-muted-foreground truncate">
              {appointment.serviceName}
            </span>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-0 overflow-hidden h-full">
          <span
            className="text-[11px] font-semibold truncate leading-tight"
            style={{ color: colors.text }}
          >
            {appointment.clientName}
          </span>
          {!compact && (
            <>
              <span className="text-[10px] text-muted-foreground truncate leading-tight">
                {appointment.serviceName}
              </span>
              {height > 60 && (
                <span className="text-[10px] text-muted-foreground/70 truncate leading-tight">
                  {durationLabel}
                </span>
              )}
              {height > 80 && (
                <span className="text-[10px] text-muted-foreground/70 truncate leading-tight mt-auto">
                  {timeRange}
                </span>
              )}
            </>
          )}
        </div>
      )}
    </motion.div>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-[220px] p-0">
          <div className="px-3 py-2 space-y-1">
            <p className="font-semibold text-sm">{appointment.clientName}</p>
            <p className="text-xs text-muted-foreground">{appointment.serviceName}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{timeRange}</span>
              <span className="text-[10px]">({durationLabel})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: colors.border }}
              />
              <span className="text-xs font-medium" style={{ color: colors.text }}>
                {statusLabel}
              </span>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
