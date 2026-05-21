"use client"

import React from "react"
import { motion } from "framer-motion"
import { format } from "date-fns"
import { useDraggable } from "@dnd-kit/core"
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
  onResize?: (appointmentId: string, newDurationMinutes: number) => void
  slotIncrementMinutes?: number
  startHour?: number
  compact?: boolean
  overlapColumn?: number
  overlapTotalColumns?: number
  /** If true, render as drag overlay ghost (no draggable wiring, no positioning). */
  asOverlay?: boolean
}

const NON_DRAGGABLE_STATUSES = new Set(["cancelled", "no-show", "completed"])

export function AppointmentBlock({
  appointment,
  colorBy,
  zoom,
  staffList,
  serviceList,
  onClick,
  onResize,
  slotIncrementMinutes = 15,
  startHour = 8,
  compact = false,
  overlapColumn = 0,
  overlapTotalColumns = 1,
  asOverlay = false,
}: AppointmentBlockProps) {
  const isDraggable = !asOverlay && !NON_DRAGGABLE_STATUSES.has(appointment.status)
  const canResize = isDraggable && !!onResize
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `appt:${appointment.id}`,
    disabled: !isDraggable,
    data: { appointmentId: appointment.id, type: "appointment" },
  })
  const pixelsPerMinute = (60 * zoom) / 30
  const startMinutes =
    appointment.startTime.getHours() * 60 + appointment.startTime.getMinutes()
  const endMinutes =
    appointment.endTime.getHours() * 60 + appointment.endTime.getMinutes()
  const durationMinutes = endMinutes - startMinutes

  const top = (startMinutes - startHour * 60) * pixelsPerMinute
  const baseHeight = Math.max(durationMinutes * pixelsPerMinute, 24)

  const [resizeDeltaPx, setResizeDeltaPx] = React.useState(0)
  const isResizing = resizeDeltaPx !== 0
  const previewDuration = Math.max(
    slotIncrementMinutes,
    Math.round((durationMinutes + resizeDeltaPx / pixelsPerMinute) / slotIncrementMinutes) *
      slotIncrementMinutes
  )
  const height = isResizing
    ? Math.max(previewDuration * pixelsPerMinute, 24)
    : baseHeight

  const handleResizePointerDown = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!canResize) return
      e.stopPropagation()
      e.preventDefault()
      const startY = e.clientY
      const startDuration = durationMinutes
      const target = e.currentTarget
      target.setPointerCapture(e.pointerId)

      const onMove = (ev: PointerEvent) => {
        setResizeDeltaPx(ev.clientY - startY)
      }
      const onUp = (ev: PointerEvent) => {
        target.releasePointerCapture(ev.pointerId)
        window.removeEventListener("pointermove", onMove)
        window.removeEventListener("pointerup", onUp)
        const deltaMinutes = (ev.clientY - startY) / pixelsPerMinute
        const newDuration = Math.max(
          slotIncrementMinutes,
          Math.round((startDuration + deltaMinutes) / slotIncrementMinutes) *
            slotIncrementMinutes
        )
        setResizeDeltaPx(0)
        if (newDuration !== startDuration && onResize) {
          onResize(appointment.id, newDuration)
        }
      }
      window.addEventListener("pointermove", onMove)
      window.addEventListener("pointerup", onUp)
    },
    [canResize, durationMinutes, pixelsPerMinute, slotIncrementMinutes, onResize, appointment.id]
  )

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

  // When in DragOverlay we want fixed dimensions and no absolute positioning.
  const overlayStyle: React.CSSProperties = asOverlay
    ? {
        height: `${height}px`,
        width: "200px",
        backgroundColor: colors.bg,
        borderLeftColor: colors.border,
        boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
      }
    : {
        top: `${top}px`,
        height: `${height}px`,
        left:
          overlapTotalColumns > 1
            ? `calc(${leftPercent}% + ${paddingPx}px)`
            : "4px",
        right:
          overlapTotalColumns > 1
            ? `calc(${rightPercent}% + ${paddingPx}px)`
            : "4px",
        backgroundColor: colors.bg,
        borderLeftColor: colors.border,
      }

  const innerBlock = (
    <motion.div
      ref={asOverlay ? undefined : setNodeRef}
      layout={!isDragging && !asOverlay}
      initial={asOverlay ? false : { opacity: 0, scale: 0.95 }}
      animate={{ opacity: isDragging ? 0.35 : 1, scale: 1 }}
      whileHover={
        asOverlay || isDragging
          ? undefined
          : {
              scale: 1.02,
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              zIndex: 20,
            }
      }
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      onKeyDown={(e) => {
        if (asOverlay) return
        if (e.key === "Enter") {
          e.preventDefault()
          onClick(appointment)
        }
      }}
      className={cn(
        asOverlay ? "relative" : "absolute",
        "rounded-md overflow-hidden border-l-[3px] px-1.5 py-1",
        isDraggable && !asOverlay ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
        isDragging && "ring-2 ring-sal-500/40",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sal-500 focus-visible:ring-offset-1"
      )}
      style={overlayStyle}
      onClick={(e) => {
        if (asOverlay) return
        e.stopPropagation()
        if (!isDragging) onClick(appointment)
      }}
      {...(asOverlay || !isDraggable
        ? { role: "button" as const, tabIndex: asOverlay ? -1 : 0 }
        : { ...attributes, ...listeners })}
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
          {canResize && (
            <div
              onPointerDown={handleResizePointerDown}
              onClick={(e) => e.stopPropagation()}
              className="absolute left-0 right-0 bottom-0 h-2 cursor-ns-resize opacity-0 hover:opacity-100 transition-opacity bg-gradient-to-t from-black/15 to-transparent"
              aria-hidden
            />
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
          {canResize && (
            <div
              onPointerDown={handleResizePointerDown}
              onClick={(e) => e.stopPropagation()}
              className="absolute left-0 right-0 bottom-0 h-2 cursor-ns-resize opacity-0 hover:opacity-100 transition-opacity bg-gradient-to-t from-black/15 to-transparent"
              aria-hidden
            />
          )}
          {isResizing && (
            <span className="absolute -top-5 right-0 text-[10px] font-semibold bg-foreground text-background px-1.5 py-0.5 rounded shadow">
              {previewDuration >= 60
                ? `${Math.floor(previewDuration / 60)}h${previewDuration % 60 > 0 ? ` ${previewDuration % 60}m` : ""}`
                : `${previewDuration}m`}
            </span>
          )}
        </div>
      )}
    </motion.div>
  )

  if (asOverlay) return innerBlock

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>{innerBlock}</TooltipTrigger>
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
