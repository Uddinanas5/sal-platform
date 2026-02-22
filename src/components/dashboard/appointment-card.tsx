"use client"

import React, { useState } from "react"
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
  const [currentStatus, setCurrentStatus] = useState(appointment.status)
  const status = statusConfig[currentStatus]
  const StatusIcon = status.icon
  const action = nextAction[currentStatus]

  if (variant === "compact") {
    return (
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.05 }}
        className="flex items-center gap-4 p-3 rounded-xl hover:bg-cream-100 transition-colors cursor-pointer group"
      >
        <div className="flex-shrink-0 text-center w-12">
          <p className="text-sm font-semibold text-foreground">
            {formatTime(appointment.startTime)}
          </p>
        </div>
        <div className="w-1 h-10 rounded-full bg-sal-400" />
        <Avatar className="w-10 h-10">
          <AvatarImage src={appointment.clientAvatar} />
          <AvatarFallback className="bg-sal-100 text-sal-700 text-sm">
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
              className="h-7 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity border-sal-200 text-sal-600 hover:bg-sal-50"
              onClick={(e) => {
                e.stopPropagation()
                toast.success(action.toastMsg, { description: appointment.clientName })
                // Advance to next status
                const statusOrder: Appointment["status"][] = ["pending", "confirmed", "checked-in", "in-progress", "completed"]
                const idx = statusOrder.indexOf(currentStatus)
                if (idx >= 0 && idx < statusOrder.length - 1) {
                  setCurrentStatus(statusOrder[idx + 1])
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
      className="bg-card rounded-2xl p-5 border border-cream-200 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer group"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <Avatar className="w-12 h-12 ring-2 ring-sal-100">
            <AvatarImage src={appointment.clientAvatar} />
            <AvatarFallback className="bg-sal-100 text-sal-700 font-medium">
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
            <DropdownMenuItem onClick={() => toast.info(`Viewing details for ${appointment.clientName}'s appointment`)}>
              <Eye className="w-4 h-4 mr-2" />
              View Details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toast.info(`Editing ${appointment.clientName}'s appointment`)}>
              <Pencil className="w-4 h-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toast.info(`Rescheduling ${appointment.clientName}'s appointment`)}>
              <CalendarClock className="w-4 h-4 mr-2" />
              Reschedule
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600 focus:text-red-600"
              onClick={() => toast.success(`Appointment for ${appointment.clientName} cancelled`)}
            >
              <XCircle className="w-4 h-4 mr-2" />
              Cancel
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
