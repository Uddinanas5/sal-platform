"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { format, setHours, setMinutes } from "date-fns"
import {
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
  LogIn,
  Play,
  User,
  Scissors,
  CalendarDays,
  DollarSign,
  FileText,
  ShoppingCart,
  ExternalLink,
  UserX,
  ThumbsUp,
  Repeat,
} from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { DatePicker } from "@/components/ui/date-picker"
import { TimePicker } from "@/components/ui/time-picker"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { cn, getInitials, formatCurrency } from "@/lib/utils"
import { toast } from "sonner"
import { rescheduleAppointment, cancelAppointment } from "@/lib/actions/appointments"
import { RequestReviewButton } from "@/components/reviews/request-review-button"
import { getSeriesInfo, cancelRecurring } from "@/lib/actions/recurring"
import type { Appointment, Staff, Service, Client } from "@/data/mock-data"

type CancelScope = "this" | "following" | "all"

const RECURRENCE_LABELS: Record<string, string> = {
  weekly: "Repeats weekly",
  biweekly: "Repeats every 2 weeks",
  monthly: "Repeats monthly",
}

type CancelReasonCode =
  | "client_request"
  | "illness"
  | "scheduling_conflict"
  | "staff_unavailable"
  | "no_show"
  | "payment_issue"
  | "other"

const CANCEL_REASONS: { value: CancelReasonCode; label: string }[] = [
  { value: "client_request", label: "Client requested" },
  { value: "illness", label: "Illness" },
  { value: "scheduling_conflict", label: "Scheduling conflict" },
  { value: "staff_unavailable", label: "Staff unavailable" },
  { value: "no_show", label: "No-show" },
  { value: "payment_issue", label: "Payment issue" },
  { value: "other", label: "Other" },
]

interface AppointmentDetailSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  appointment: Appointment | null
  staffList: Staff[]
  serviceList: Service[]
  clientList: Client[]
  onStatusChange?: (appointmentId: string, newStatus: string) => void | Promise<boolean>
}

const STATUS_CONFIG: Record<
  string,
  {
    label: string
    variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info"
    className?: string
  }
> = {
  pending: {
    label: "Booked",
    variant: "default",
    className: "bg-blue-500/10 text-blue-300 hover:bg-blue-500/15",
  },
  confirmed: {
    label: "Confirmed",
    variant: "default",
    className: "bg-purple-500/10 text-purple-300 hover:bg-purple-500/15",
  },
  "checked-in": {
    label: "Arrived",
    variant: "default",
    className: "bg-amber-500/10 text-amber-300 hover:bg-amber-500/15",
  },
  "in-progress": {
    label: "Started",
    variant: "default",
    className: "bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15",
  },
  completed: {
    label: "Completed",
    variant: "secondary",
  },
  "no-show": {
    label: "No Show",
    variant: "destructive",
  },
  cancelled: {
    label: "Cancelled",
    variant: "default",
    className: "bg-red-500/10 text-red-300 hover:bg-red-500/15",
  },
}

export function AppointmentDetailSheet({
  open,
  onOpenChange,
  appointment,
  staffList,
  serviceList,
  clientList,
  onStatusChange,
}: AppointmentDetailSheetProps) {
  const router = useRouter()
  const [rescheduleOpen, setRescheduleOpen] = useState(false)
  const [rescheduleDate, setRescheduleDate] = useState<Date | undefined>(undefined)
  const [rescheduleTime, setRescheduleTime] = useState<string | undefined>(undefined)
  const [rescheduleStaff, setRescheduleStaff] = useState<string>("")
  const [isRescheduling, setIsRescheduling] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelMode, setCancelMode] = useState<"cancelled" | "no_show">("cancelled")
  const [cancelInitiator, setCancelInitiator] = useState<"client" | "business">("business")
  const [cancelReason, setCancelReason] = useState<CancelReasonCode>("client_request")
  const [cancelNote, setCancelNote] = useState("")
  const [isCancelling, setIsCancelling] = useState(false)
  // Cancellation scope only applies to a recurring series member.
  const [cancelScope, setCancelScope] = useState<CancelScope>("this")

  // Series membership for the currently-open appointment. Resolved from the
  // server (the calendar's Appointment objects don't carry series fields), so
  // the badge + scope picker are real, not decorative.
  const [seriesInfo, setSeriesInfo] = useState<{
    isSeriesMember: boolean
    recurrenceRule: string | null
  } | null>(null)

  const appointmentId = appointment?.id

  useEffect(() => {
    if (!open || !appointmentId) {
      setSeriesInfo(null)
      return
    }
    let cancelled = false
    setSeriesInfo(null)
    getSeriesInfo(appointmentId).then((res) => {
      if (cancelled) return
      if (res.success) {
        setSeriesInfo({
          isSeriesMember: res.data.isSeriesMember,
          recurrenceRule: res.data.recurrenceRule,
        })
      } else {
        // On failure, treat as a one-off (no badge / no scope picker) rather
        // than guessing — never show a series UI we can't back up.
        setSeriesInfo({ isSeriesMember: false, recurrenceRule: null })
      }
    })
    return () => {
      cancelled = true
    }
  }, [open, appointmentId])

  if (!appointment) return null

  const isSeriesMember = seriesInfo?.isSeriesMember ?? false
  const recurrenceLabel = seriesInfo?.recurrenceRule
    ? RECURRENCE_LABELS[seriesInfo.recurrenceRule] ?? "Repeats"
    : "Repeats"

  const staffMember = staffList.find((s) => s.id === appointment.staffId)
  const service = serviceList.find((s) => s.id === appointment.serviceId)
  const client = clientList.find((c) => c.id === appointment.clientId)
  const statusConfig = STATUS_CONFIG[appointment.status] || STATUS_CONFIG.confirmed

  const handleStatusAction = async (action: string, newStatus: string) => {
    // Await the server result and only confirm on success, so we don't show a
    // success toast that the parent's failure path immediately contradicts.
    const ok = await onStatusChange?.(appointment.id, newStatus)
    if (ok !== false) {
      toast.success(`Appointment ${action}`, {
        description: `${appointment.clientName}'s appointment has been ${action.toLowerCase()}.`,
      })
      onOpenChange(false)
    }
  }

  const openCancel = (mode: "cancelled" | "no_show") => {
    setCancelMode(mode)
    // Sensible defaults: a no-show is client-side; a manual cancel is usually
    // initiated by the business. The user can change both.
    setCancelInitiator(mode === "no_show" ? "client" : "business")
    setCancelReason(mode === "no_show" ? "no_show" : "client_request")
    setCancelNote("")
    // A no-show is inherently a single occurrence; a cancel of a series member
    // defaults to just this one (the user can widen the scope).
    setCancelScope("this")
    setCancelOpen(true)
  }

  const handleCancelConfirm = async () => {
    if (!appointment) return
    setIsCancelling(true)

    // For a series member with a wider scope, use the scoped recurring cancel.
    // A no-show is always a single occurrence, so it never batches the series.
    const useSeriesScope =
      isSeriesMember && cancelMode === "cancelled" && cancelScope !== "this"

    const result = useSeriesScope
      ? await cancelRecurring({
          appointmentId: appointment.id,
          scope: cancelScope,
          status: cancelMode,
          initiator: cancelInitiator,
          reasonCode: cancelReason,
          note: cancelNote.trim() || undefined,
        })
      : await cancelAppointment({
          id: appointment.id,
          status: cancelMode,
          initiator: cancelInitiator,
          reasonCode: cancelReason,
          note: cancelNote.trim() || undefined,
        })

    setIsCancelling(false)
    if (!result.success) {
      toast.error(result.error || "Failed to cancel appointment")
      return
    }

    if (useSeriesScope && "data" in result && result.data) {
      const n = result.data.count
      toast.success(
        cancelScope === "all"
          ? `Cancelled all ${n} appointment${n === 1 ? "" : "s"} in the series`
          : `Cancelled ${n} appointment${n === 1 ? "" : "s"} (this and following)`
      )
    } else {
      toast.success(
        cancelMode === "no_show" ? "Marked as no-show" : "Appointment cancelled"
      )
    }
    setCancelOpen(false)
    onOpenChange(false)
    router.refresh()
  }

  const openReschedule = () => {
    setRescheduleDate(appointment.startTime)
    setRescheduleTime(format(appointment.startTime, "HH:mm"))
    setRescheduleStaff(appointment.staffId)
    setRescheduleOpen(true)
  }

  const handleRescheduleConfirm = async () => {
    if (!appointment) return
    if (!rescheduleDate || !rescheduleTime) {
      toast.error("Please select a date and time")
      return
    }
    const [h, m] = rescheduleTime.split(":").map(Number)
    const newDate = setMinutes(setHours(rescheduleDate, h), m)
    const newStaffMember = staffList.find((s) => s.id === rescheduleStaff)
    const staffChanged = rescheduleStaff && rescheduleStaff !== appointment.staffId

    setIsRescheduling(true)
    // Call the real server action so the appointment actually moves (and is
    // re-checked for conflicts / working hours), instead of just toasting.
    const result = await rescheduleAppointment(
      appointment.id,
      newDate.toISOString(),
      staffChanged ? rescheduleStaff : undefined
    )
    setIsRescheduling(false)

    if (!result.success) {
      toast.error(result.error || "Failed to reschedule appointment")
      return
    }

    toast.success("Appointment rescheduled", {
      description: `Moved to ${format(newDate, "MMM d, yyyy")} at ${format(newDate, "h:mm a")}${newStaffMember && staffChanged ? ` with ${newStaffMember.name}` : ""}`,
    })
    setRescheduleOpen(false)
    onOpenChange(false)
    router.refresh()
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[400px] sm:w-[440px] overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarImage src={appointment.clientAvatar} />
              <AvatarFallback className="text-sm">
                {getInitials(appointment.clientName)}
              </AvatarFallback>
            </Avatar>
            <div>
              <SheetTitle className="text-base">
                {appointment.clientName}
              </SheetTitle>
              <SheetDescription className="text-xs">
                {appointment.serviceName}
              </SheetDescription>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Badge
              variant={statusConfig.variant}
              className={cn("w-fit", statusConfig.className)}
            >
              {statusConfig.label}
            </Badge>
            {isSeriesMember && (
              <Badge
                variant="outline"
                className="w-fit gap-1 bg-sal-500/10 text-sal-300 border-sal-500/20"
              >
                <Repeat className="h-3 w-3" />
                {recurrenceLabel} · series
              </Badge>
            )}
          </div>
        </SheetHeader>

        <Separator />

        {/* Details */}
        <div className="py-4 space-y-4">
          {/* Client info */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">
              Client
            </h4>
            <div
              className="flex items-center gap-3 p-3 bg-cream-50 dark:bg-muted/50 rounded-lg cursor-pointer hover:bg-cream-100 dark:hover:bg-muted transition-colors group/client"
              onClick={() => {
                if (client) {
                  onOpenChange(false)
                  router.push(`/clients/${client.id}`)
                }
              }}
            >
              <User className="h-4 w-4 text-muted-foreground/70 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">
                  {appointment.clientName}
                </p>
                {client && (
                  <p className="text-xs text-muted-foreground">
                    {client.email} &middot; {client.phone}
                  </p>
                )}
              </div>
              {client && (
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/70 group-hover/client:text-mint-strong transition-colors shrink-0" />
              )}
            </div>
          </div>

          {/* Service info */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">
              Service
            </h4>
            <div className="flex items-center gap-3 p-3 bg-cream-50 dark:bg-muted/50 rounded-lg">
              <Scissors className="h-4 w-4 text-muted-foreground/70 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {appointment.serviceName}
                </p>
                {service && (
                  <p className="text-xs text-muted-foreground">
                    {service.category} &middot;{" "}
                    {service.duration} min
                  </p>
                )}
              </div>
              {service && (
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: service.color }}
                />
              )}
            </div>
          </div>

          {/* Staff info */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">
              Staff
            </h4>
            <div className="flex items-center gap-3 p-3 bg-cream-50 dark:bg-muted/50 rounded-lg">
              <Avatar className="h-7 w-7">
                <AvatarImage src={staffMember?.avatar} />
                <AvatarFallback
                  className="text-[10px] font-semibold text-white"
                  style={{
                    backgroundColor: staffMember?.color || "#6b7280",
                  }}
                >
                  {getInitials(appointment.staffName)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {appointment.staffName}
                </p>
                {staffMember && (
                  <p className="text-xs text-muted-foreground capitalize">
                    {staffMember.role}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Date & Time */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">
              Date & Time
            </h4>
            <div className="flex items-center gap-3 p-3 bg-cream-50 dark:bg-muted/50 rounded-lg">
              <CalendarDays className="h-4 w-4 text-muted-foreground/70 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {format(appointment.startTime, "EEEE, MMMM d, yyyy")}
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {format(appointment.startTime, "h:mm a")} -{" "}
                  {format(appointment.endTime, "h:mm a")}
                </p>
              </div>
            </div>
          </div>

          {/* Price */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">
              Price
            </h4>
            <div className="flex items-center gap-3 p-3 bg-cream-50 dark:bg-muted/50 rounded-lg">
              <DollarSign className="h-4 w-4 text-muted-foreground/70 shrink-0" />
              <p className="text-lg font-bold text-foreground">
                {formatCurrency(appointment.price)}
              </p>
            </div>
          </div>

          {/* Notes */}
          {appointment.notes && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">
                Notes
              </h4>
              <div className="flex items-start gap-3 p-3 bg-cream-50 dark:bg-muted/50 rounded-lg">
                <FileText className="h-4 w-4 text-muted-foreground/70 shrink-0 mt-0.5" />
                <p className="text-sm text-foreground">{appointment.notes}</p>
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Actions */}
        <div className="py-4 space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider mb-3">
            Actions
          </h4>

          {appointment.status === "pending" && (
            <Button
              variant="outline"
              className="w-full justify-start gap-2 h-10"
              onClick={() => handleStatusAction("Confirmed", "confirmed")}
            >
              <ThumbsUp className="h-4 w-4 text-blue-500" />
              Confirm
            </Button>
          )}

          {(appointment.status === "confirmed" ||
            appointment.status === "pending") && (
            <Button
              variant="outline"
              className="w-full justify-start gap-2 h-10"
              onClick={() => handleStatusAction("Checked In", "checked-in")}
            >
              <LogIn className="h-4 w-4 text-purple-500" />
              Check In
            </Button>
          )}

          {(appointment.status === "checked-in" ||
            appointment.status === "confirmed") && (
            <Button
              variant="outline"
              className="w-full justify-start gap-2 h-10"
              onClick={() =>
                handleStatusAction("Started", "in-progress")
              }
            >
              <Play className="h-4 w-4 text-cyan-500" />
              Start Service
            </Button>
          )}

          {(appointment.status === "in-progress" ||
            appointment.status === "checked-in") && (
            <Button
              variant="outline"
              className="w-full justify-start gap-2 h-10"
              onClick={() =>
                handleStatusAction("Completed", "completed")
              }
            >
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Complete
            </Button>
          )}

          {(appointment.status === "in-progress" ||
            appointment.status === "completed" ||
            appointment.status === "checked-in") && (
            <Button
              className="w-full justify-start gap-2 h-10 bg-sal-500 hover:bg-sal-600 text-white"
              onClick={() => {
                onOpenChange(false)
                router.push("/checkout")
                toast.success("Checkout started", {
                  description: `${appointment.clientName} — ${appointment.serviceName}`,
                })
              }}
            >
              <ShoppingCart className="h-4 w-4" />
              Checkout
            </Button>
          )}

          {/* Self-gates to completed visits; emails the client a /r/<token> review link */}
          <RequestReviewButton
            appointmentId={appointment.id}
            status={appointment.status}
            className="w-full justify-start gap-2 h-10"
          />

          {appointment.status !== "cancelled" &&
            appointment.status !== "completed" &&
            appointment.status !== "no-show" && (
              <>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2 h-10"
                  onClick={openReschedule}
                >
                  <RotateCcw className="h-4 w-4 text-blue-500" />
                  Reschedule
                </Button>

                <Button
                  variant="outline"
                  className="w-full justify-start gap-2 h-10 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                  onClick={() => openCancel("no_show")}
                >
                  <UserX className="h-4 w-4" />
                  Mark No-Show
                </Button>

                <Button
                  variant="outline"
                  className="w-full justify-start gap-2 h-10 text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => openCancel("cancelled")}
                >
                  <XCircle className="h-4 w-4" />
                  Cancel Appointment
                </Button>
              </>
            )}
        </div>
      </SheetContent>

      {/* Reschedule Dialog */}
      <Dialog open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reschedule Appointment</DialogTitle>
            <DialogDescription>
              {appointment.clientName} &mdash; {appointment.serviceName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Date</label>
              <DatePicker
                date={rescheduleDate}
                onSelect={setRescheduleDate}
                placeholder="Select new date"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Time</label>
              <TimePicker
                value={rescheduleTime}
                onChange={setRescheduleTime}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Staff</label>
              <Select value={rescheduleStaff} onValueChange={setRescheduleStaff}>
                <SelectTrigger>
                  <SelectValue placeholder="Select staff" />
                </SelectTrigger>
                <SelectContent>
                  {staffList.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setRescheduleOpen(false)}
                disabled={isRescheduling}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-sal-500 hover:bg-sal-600 text-white"
                onClick={handleRescheduleConfirm}
                disabled={isRescheduling}
              >
                {isRescheduling ? "Rescheduling…" : "Confirm Reschedule"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancellation reason dialog */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {cancelMode === "no_show" ? "Mark as No-Show" : "Cancel Appointment"}
            </DialogTitle>
            <DialogDescription>
              Record why so it shows up in cancellation reports later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Scope picker — only for a recurring series member, and only when
                cancelling (a no-show is always a single occurrence). */}
            {isSeriesMember && cancelMode === "cancelled" && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <Repeat className="h-3.5 w-3.5 text-mint-strong" />
                  Apply to
                </label>
                <Select
                  value={cancelScope}
                  onValueChange={(v) => setCancelScope(v as CancelScope)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="this">This appointment</SelectItem>
                    <SelectItem value="following">This &amp; following</SelectItem>
                    <SelectItem value="all">All in series</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Initiated by</label>
              <Select
                value={cancelInitiator}
                onValueChange={(v) => setCancelInitiator(v as "client" | "business")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="business">Business / staff</SelectItem>
                  <SelectItem value="client">Client</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Reason</label>
              <Select
                value={cancelReason}
                onValueChange={(v) => setCancelReason(v as CancelReasonCode)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CANCEL_REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Note (optional)</label>
              <Textarea
                value={cancelNote}
                onChange={(e) => setCancelNote(e.target.value)}
                placeholder="Any extra detail…"
                maxLength={500}
                rows={3}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setCancelOpen(false)}
                disabled={isCancelling}
              >
                Back
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleCancelConfirm}
                disabled={isCancelling}
              >
                {isCancelling
                  ? "Saving…"
                  : cancelMode === "no_show"
                    ? "Mark No-Show"
                    : "Confirm Cancel"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Sheet>
  )
}
