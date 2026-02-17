"use client"

import React from "react"
import { motion } from "framer-motion"
import { Clock, MoreVertical, CheckCircle2, XCircle, AlertCircle } from "lucide-react"
import { formatTime, formatCurrency } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Appointment } from "@/data/mock-data"

interface AppointmentCardProps {
  appointment: Appointment
  variant?: "compact" | "detailed"
  index?: number
}

const statusConfig = {
  confirmed: { label: "Confirmed", variant: "success" as const, icon: CheckCircle2 },
  pending: { label: "Pending", variant: "warning" as const, icon: AlertCircle },
  completed: { label: "Completed", variant: "secondary" as const, icon: CheckCircle2 },
  cancelled: { label: "Cancelled", variant: "destructive" as const, icon: XCircle },
  "no-show": { label: "No Show", variant: "destructive" as const, icon: XCircle },
}

export function AppointmentCard({ appointment, variant = "detailed", index = 0 }: AppointmentCardProps) {
  const status = statusConfig[appointment.status]
  const StatusIcon = status.icon

  if (variant === "compact") {
    return (
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.05 }}
        className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer group"
      >
        <div className="flex-shrink-0 text-center w-12">
          <p className="text-sm font-semibold text-gray-900">
            {formatTime(appointment.startTime)}
          </p>
        </div>
        <div className="w-1 h-10 rounded-full bg-sal-400" />
        <Avatar className="w-10 h-10">
          <AvatarImage src={appointment.clientAvatar} />
          <AvatarFallback className="bg-sal-100 text-sal-600 text-sm">
            {appointment.clientName.split(" ").map((n) => n[0]).join("")}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">
            {appointment.clientName}
          </p>
          <p className="text-xs text-gray-500 truncate">{appointment.serviceName}</p>
        </div>
        <Badge variant={status.variant}>{status.label}</Badge>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      whileHover={{ scale: 1.01 }}
      className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <Avatar className="w-12 h-12 ring-2 ring-sal-100">
            <AvatarImage src={appointment.clientAvatar} />
            <AvatarFallback className="bg-sal-100 text-sal-600 font-medium">
              {appointment.clientName.split(" ").map((n) => n[0]).join("")}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold text-gray-900">{appointment.clientName}</h3>
            <p className="text-sm text-gray-500">{appointment.serviceName}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
          <MoreVertical className="w-4 h-4" />
        </Button>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-600">
            <Clock className="w-4 h-4" />
            <span className="text-sm">
              {formatTime(appointment.startTime)} - {formatTime(appointment.endTime)}
            </span>
          </div>
          <span className="font-semibold text-gray-900">
            {formatCurrency(appointment.price)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            with <span className="font-medium text-gray-700">{appointment.staffName}</span>
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
