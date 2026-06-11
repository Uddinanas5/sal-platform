"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Clock, MoreVertical, CheckCircle2, XCircle, Eye, Pencil, CalendarClock, Play, ShoppingCart } from "lucide-react"
import { formatTime, formatCurrency } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { updateAppointmentStatus } from "@/lib/actions/appointments"
import type { Appointment } from "@/data/mock-data"

interface AppointmentCardProps {
  appointment: Appointment
  variant?: "compact" | "detailed"
  index?: number
}

const statusConfig: Record<string, { label: string; variant: "success" | "warning" | "secondary" | "destructive" | "info"; icon: typeof CheckCircle2 }> = {
  pending: { label: "Booked", variant: "info", icon: Clock },
  confirmed: { label: "Confirmed", variant: "secondary", icon: CheckCircle2 },
  "checked-in": { label: "Arrived", variant: "warning", icon: CheckCircle2 },
  "in-progress": { label: "Started", variant: "success", icon: Clock },
  completed: { label: "Completed", variant: "secondary", icon: CheckCircle2 },
  "no-show": { label: "No Show", variant: "destructive", icon: XCircle },
  cancelled: { label: "Cancelled", variant: "destructive", icon: XCircle },
}

// Status progression mapping: what action advances this status
const nextAction: Record<string, { label: string; icon: typeof CheckCircle2; toastMsg: string } | null> = {
  pending: { label: "Confirm", icon: CheckCircle2, toastMsg: "Appointment confirmed" },
  confirmed: { label: "Check In", icon: CheckCircle2, toastMsg: "Client checked in" },
  "checked-in": { label: "Start", icon: Play, toastMsg: "Appointment started" },
  "in-progress": { label: "Checkout", icon: ShoppingCart, toastMsg: "Proceeding to checkout" },
  completed: null,
  "no-show": null,
  cancelled: null,
}

export function AppointmentCard({ appointment, variant = "detailed", index = 0 }: AppointmentCardProps) {
  const router = useRouter()
  const [currentStatus, setCurrentStatus] = useState(appointment.status)
  const [isCancelling, setIsCancelling] = useState(false)
  const status = statusConfig[currentStatus]
  const StatusIcon = status.icon
  const action = nextAction[currentStatus]

  async function handleCancel() {
    if (currentStatus === "cancelled" || isCancelling) return
    setIsCancelling(true)
    const result = await updateAppointmentStatus(appointment.id, "cancelled")
    setIsCancelling(false)
    if (result.success) {
      setCurrentStatus("cancelled")
      toast.success(`Appointment for ${appointment.clientName} cancelled`)
    } else {
      toast.error(result.error ?? "Failed to cancel appointment")
    }
  }

  if (variant === "compact") {
    return (
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.05 }}
        className="flex items-center gap-4 p-3 glass-tile rounded-tile hover:bg-white/[0.06] transition-colors cursor-pointer group"
      >
        <div className="flex-shrink-0 text-center w-12">
          <p className="text-sm font-semibold text-foreground">
            {formatTime(appointment.startTime)}
          </p>
        </div>
        <div className="led led-mint" />
        <Avatar className="w-10 h-10">
          <AvatarImage src={appointment.clientAvatar} />
          <AvatarFallback className="bg-sal-100 text-mint-soft text-sm">
            {appointment.clientName.split(" ").map((n) => n[0]).join("")}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {appointment.clientName}
          </p>
          <p className="text-xs text-muted-foreground truncate">{appointment.serviceName}</p>
        </div>
        <div className="flex items-center gap-2">
          {action && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity border-sal-200 text-mint hover:bg-sal-50"
              onClick={async (e) => {
                e.stopPropagation()
                const statusOrder: Appointment["status"][] = ["pending", "confirmed", "checked-in", "in-progress", "completed"]
                const idx = statusOrder.indexOf(currentStatus)
                if (idx >= 0 && idx < statusOrder.length - 1) {
                  const nextStatus = statusOrder[idx + 1]
                  const result = await updateAppointmentStatus(appointment.id, nextStatus)
                  if (result.success) {
                    setCurrentStatus(nextStatus)
                    toast.success(action.toastMsg, { description: appointment.clientName })
                  } else {
                    toast.error(result.error)
                  }
                }
              }}
            >
              <action.icon className="w-3 h-3 mr-1" />
              {action.label}
            </Button>
          )}
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      whileHover={{ scale: 1.01 }}
      className="glass-tile rounded-tile p-5 hover:bg-white/[0.06] transition-all duration-200 cursor-pointer group"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <Avatar className="w-12 h-12 ring-2 ring-sal-100">
            <AvatarImage src={appointment.clientAvatar} />
            <AvatarFallback className="bg-sal-100 text-mint-soft font-medium">
              {appointment.clientName.split(" ").map((n) => n[0]).join("")}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold text-foreground">{appointment.clientName}</h3>
            <p className="text-sm text-muted-foreground">{appointment.serviceName}</p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity" aria-label="More options">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => router.push(`/calendar?appointmentId=${appointment.id}`)}>
              <Eye className="w-4 h-4 mr-2" />
              View Details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push(`/calendar?appointmentId=${appointment.id}`)}>
              <Pencil className="w-4 h-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push(`/calendar?appointmentId=${appointment.id}`)}>
              <CalendarClock className="w-4 h-4 mr-2" />
              Reschedule
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-400 focus:text-red-400"
              disabled={isCancelling || currentStatus === "cancelled"}
              onSelect={(e) => {
                e.preventDefault()
                handleCancel()
              }}
            >
              <XCircle className="w-4 h-4 mr-2" />
              {isCancelling ? "Cancelling…" : "Cancel"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span className="text-sm">
              {formatTime(appointment.startTime)} - {formatTime(appointment.endTime)}
            </span>
          </div>
          <span className="font-semibold text-foreground">
            {formatCurrency(appointment.price)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            with <span className="font-medium text-foreground">{appointment.staffName}</span>
          </p>
          <Badge variant={status.variant} className="flex items-center gap-1">
            <StatusIcon className="w-3 h-3" />
            {status.label}
          </Badge>
        </div>
      </div>
    </motion.div>
  )
}
