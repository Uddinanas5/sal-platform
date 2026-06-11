"use client"

import { useState, useEffect } from "react"
import {
  Calendar,
  Clock,
  MapPin,
  Phone,
  Mail,
  User,
  Scissors,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn, formatCurrency } from "@/lib/utils"
import { cancelPublicBooking, reschedulePublicBooking } from "@/lib/actions/public-booking"
import { toast } from "sonner"
import Link from "next/link"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ServiceItem {
  name: string
  duration: number
  price: number
  staffName: string
}

interface BookingData {
  id: string
  bookingReference: string
  status: string
  startTime: string
  endTime: string
  totalAmount: number
  notes: string | null
  // Reschedule picker inputs (server-derived).
  locationId: string
  serviceId: string
  staffId: string | null
  businessName: string
  businessSlug: string
  businessTimezone: string
  businessPhone: string | null
  businessEmail: string | null
  clientName: string
  clientEmail: string
  locationName: string
  locationAddress: string
  locationCity: string
  locationState: string
  services: ServiceItem[]
}

interface ManageBookingClientProps {
  booking: BookingData
}

// A bookable slot as returned by GET /api/availability — same shape the public
// booking page consumes. `start` is the authoritative ISO instant we send to
// reschedulePublicBooking; `startTime` is the display string.
interface AvailabilitySlot {
  start: string
  end: string
  startTime: string
  endTime: string
  availableStaff: string[]
  staffCount: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// All three render in the SALON's timezone (passed through from the business),
// so the times shown here match what the customer saw at booking — not the
// viewer's device timezone.
function formatDateTime(iso: string, tz: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: tz || "UTC",
  }).format(new Date(iso))
}

function formatDateOnly(iso: string, tz: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: tz || "UTC",
  }).format(new Date(iso))
}

function formatTimeOnly(iso: string, tz: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: tz || "UTC",
  }).format(new Date(iso))
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function getStatusConfig(status: string): {
  label: string
  variant: "success" | "destructive" | "warning" | "secondary" | "outline"
  className?: string
  icon: React.ReactNode
} {
  switch (status) {
    case "confirmed":
      return {
        label: "Confirmed",
        variant: "success",
        icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      }
    case "pending":
      return {
        label: "Pending",
        variant: "warning",
        icon: <AlertCircle className="h-3.5 w-3.5" />,
      }
    case "cancelled":
      return {
        label: "Cancelled",
        variant: "destructive",
        icon: <XCircle className="h-3.5 w-3.5" />,
      }
    case "completed":
      return {
        label: "Completed",
        variant: "secondary",
        icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      }
    case "checked_in":
      return {
        label: "Checked In",
        variant: "info" as "outline",
        className: "border-transparent bg-blue-500/10 text-blue-300",
        icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      }
    case "in_progress":
      return {
        label: "In Progress",
        variant: "info" as "outline",
        className: "border-transparent bg-blue-500/10 text-blue-300",
        icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
      }
    case "no_show":
      return {
        label: "No Show",
        variant: "outline",
        icon: <XCircle className="h-3.5 w-3.5" />,
      }
    default:
      return {
        label: status,
        variant: "outline",
        icon: null,
      }
  }
}

// ---------------------------------------------------------------------------
// Cancel Dialog
// ---------------------------------------------------------------------------

interface CancelDialogProps {
  booking: BookingData
  onClose: () => void
  onCancelled: () => void
}

function CancelDialog({ booking, onClose, onCancelled }: CancelDialogProps) {
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleCancel() {
    setError("")
    if (!email.trim()) {
      setError("Please enter your email address.")
      return
    }

    setIsLoading(true)
    try {
      const result = await cancelPublicBooking(booking.bookingReference, email.trim())
      if (result.success) {
        toast.success("Your appointment has been cancelled.")
        onCancelled()
      } else {
        setError(result.error ?? "Failed to cancel appointment.")
      }
    } catch {
      setError("An unexpected error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md glass-popover rounded-panel shadow-2xl">
        <div className="p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-400/15">
              <XCircle className="h-5 w-5 text-red-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-ink">Cancel Appointment</h2>
              <p className="text-sm text-ink-faint">This action cannot be undone.</p>
            </div>
          </div>

          <div className="mb-4 glass-tile rounded-tile p-4 text-sm text-ink-soft">
            <p className="font-medium">{booking.services[0]?.name ?? "Appointment"}</p>
            <p className="mt-1 text-ink-faint">{formatDateTime(booking.startTime, booking.businessTimezone)}</p>
          </div>

          <div className="mb-4">
            <Label htmlFor="cancel-email" className="mb-1.5 block text-sm font-medium text-ink-soft">
              Confirm your email address
            </Label>
            <Input
              id="cancel-email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCancel()}
              className="w-full"
              disabled={isLoading}
            />
            <p className="mt-1 text-xs text-ink-faint">
              Enter the email address used when booking to verify your identity.
            </p>
          </div>

          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-400/10 px-3 py-2 text-sm text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="h-11 flex-1"
              onClick={onClose}
              disabled={isLoading}
            >
              Keep Appointment
            </Button>
            <Button
              variant="destructive"
              className="h-11 flex-1"
              onClick={handleCancel}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cancelling...
                </>
              ) : (
                "Cancel Appointment"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Reschedule Dialog
// ---------------------------------------------------------------------------

interface RescheduleDialogProps {
  booking: BookingData
  onClose: () => void
  onRescheduled: (newStartIso: string) => void
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function RescheduleDialog({ booking, onClose, onRescheduled }: RescheduleDialogProps) {
  const [email, setEmail] = useState("")
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null)
  const [slots, setSlots] = useState<AvailabilitySlot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())

  // Fetch real availability for the chosen date — the SAME /api/availability
  // endpoint the public booking page uses, scoped to this booking's lead
  // service (+ original staff if one was assigned). No client-side slot math.
  useEffect(() => {
    if (!selectedDate || !booking.serviceId || !booking.locationId) {
      setSlots([])
      setSlotsLoading(false)
      return
    }
    let active = true
    setSlotsLoading(true)
    setSlots([])
    setSelectedSlot(null)
    const pad = (n: number) => String(n).padStart(2, "0")
    const dateStr = `${selectedDate.getFullYear()}-${pad(selectedDate.getMonth() + 1)}-${pad(selectedDate.getDate())}`
    const params = new URLSearchParams({
      serviceId: booking.serviceId,
      date: dateStr,
      locationId: booking.locationId,
    })
    if (booking.staffId) params.set("staffId", booking.staffId)
    fetch(`/api/availability?${params.toString()}`)
      .then(async (res) => {
        if (!active) return
        if (!res.ok) {
          setSlots([])
          return
        }
        const data = await res.json().catch(() => ({}))
        setSlots(Array.isArray(data?.slots) ? (data.slots as AvailabilitySlot[]) : [])
      })
      .catch(() => {
        if (active) setSlots([])
      })
      .finally(() => {
        if (active) setSlotsLoading(false)
      })
    return () => {
      active = false
    }
  }, [selectedDate, booking.serviceId, booking.locationId, booking.staffId])

  // Build the calendar grid for the viewed month.
  const firstOfMonth = new Date(viewYear, viewMonth, 1)
  const startOffset = firstOfMonth.getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const grid: (Date | null)[] = []
  for (let i = 0; i < startOffset; i++) grid.push(null)
  for (let d = 1; d <= daysInMonth; d++) grid.push(new Date(viewYear, viewMonth, d))

  const atMinMonth =
    viewYear < today.getFullYear() ||
    (viewYear === today.getFullYear() && viewMonth <= today.getMonth())

  function prevMonth() {
    if (atMinMonth) return
    const m = viewMonth - 1
    if (m < 0) {
      setViewMonth(11)
      setViewYear((y) => y - 1)
    } else {
      setViewMonth(m)
    }
  }
  function nextMonth() {
    const m = viewMonth + 1
    if (m > 11) {
      setViewMonth(0)
      setViewYear((y) => y + 1)
    } else {
      setViewMonth(m)
    }
  }

  async function handleConfirm() {
    setError("")
    if (!email.trim()) {
      setError("Please enter your email address.")
      return
    }
    if (!selectedSlot) {
      setError("Please choose a new time.")
      return
    }
    setIsSubmitting(true)
    try {
      const result = await reschedulePublicBooking(
        booking.bookingReference,
        email.trim(),
        selectedSlot.start,
      )
      if (result.success) {
        toast.success("Your appointment has been rescheduled.")
        onRescheduled(result.data.startTime)
      } else {
        setError(result.error ?? "Failed to reschedule appointment.")
      }
    } catch {
      setError("An unexpected error occurred. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const monthLabel = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(firstOfMonth)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden glass-popover rounded-panel shadow-2xl">
        <div className="flex items-start gap-3 border-b border-white/10 p-6 pb-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mint/15">
            <Calendar className="h-5 w-5 text-mint" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-ink">Reschedule Appointment</h2>
            <p className="text-sm text-ink-faint">Pick a new date and time.</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Email confirmation */}
          <div className="mb-5">
            <Label
              htmlFor="reschedule-email"
              className="mb-1.5 block text-sm font-medium text-ink-soft"
            >
              Confirm your email address
            </Label>
            <Input
              id="reschedule-email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full"
              disabled={isSubmitting}
            />
            <p className="mt-1 text-xs text-ink-faint">
              Enter the email used when booking to verify your identity.
            </p>
          </div>

          {/* Month calendar */}
          <div className="mb-5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-ink-soft">Choose a date</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={prevMonth}
                  disabled={atMinMonth}
                  aria-label="Previous month"
                  className="flex h-11 w-11 items-center justify-center rounded-md text-ink-faint hover:bg-white/[0.08] disabled:opacity-30"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="min-w-[120px] text-center text-sm font-medium text-ink">
                  {monthLabel}
                </span>
                <button
                  type="button"
                  onClick={nextMonth}
                  aria-label="Next month"
                  className="flex h-11 w-11 items-center justify-center rounded-md text-ink-faint hover:bg-white/[0.08]"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
              {WEEKDAYS.map((w) => (
                <div key={w} className="py-1 text-xs font-medium text-ink-faint">
                  {w}
                </div>
              ))}
              {grid.map((d, i) => {
                if (!d) return <div key={`empty-${i}`} />
                const isPast = d < today
                const isSelected = selectedDate ? isSameDay(d, selectedDate) : false
                return (
                  <button
                    key={d.toISOString()}
                    type="button"
                    disabled={isPast || isSubmitting}
                    onClick={() => setSelectedDate(d)}
                    className={cn(
                      "aspect-square rounded-md text-sm transition-colors",
                      isPast && "cursor-not-allowed text-white/25",
                      !isPast && !isSelected && "text-ink-soft hover:bg-mint/10",
                      isSelected && "bg-sal-500 font-semibold text-white shadow-glow-sm",
                    )}
                  >
                    {d.getDate()}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Time slots */}
          {selectedDate && (
            <div className="mb-2">
              <span className="mb-2 block text-sm font-medium text-ink-soft">
                Available times
              </span>
              {slotsLoading ? (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-ink-faint">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading times...
                </div>
              ) : slots.length === 0 ? (
                <div className="glass-tile rounded-tile px-3 py-4 text-center text-sm text-ink-faint">
                  No open times on this date. Try another day.
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {slots.map((slot) => {
                    const isSelected = selectedSlot?.start === slot.start
                    return (
                      <button
                        key={slot.start}
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => setSelectedSlot(slot)}
                        className={cn(
                          "min-h-[44px] rounded-tile px-2 py-2 text-sm transition-all",
                          isSelected
                            ? "border border-mint/60 bg-mint/15 font-semibold text-white shadow-glow-sm"
                            : "glass-tile text-ink-soft hover:brightness-110",
                        )}
                      >
                        {slot.startTime}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-400/10 px-3 py-2 text-sm text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
        </div>

        <div className="flex gap-3 border-t border-white/10 p-6 pt-4">
          <Button variant="outline" className="h-11 flex-1" onClick={onClose} disabled={isSubmitting}>
            Keep Current Time
          </Button>
          <Button
            className="h-11 flex-1"
            onClick={handleConfirm}
            disabled={isSubmitting || !selectedSlot}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Rescheduling...
              </>
            ) : (
              "Confirm New Time"
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function ManageBookingClient({ booking }: ManageBookingClientProps) {
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [showRescheduleDialog, setShowRescheduleDialog] = useState(false)
  const [currentStatus, setCurrentStatus] = useState(booking.status)
  // Local copy of the appointment times so the page reflects a successful
  // reschedule without a full reload.
  const [startTime, setStartTime] = useState(booking.startTime)
  const [endTime, setEndTime] = useState(booking.endTime)

  const statusConfig = getStatusConfig(currentStatus)

  const isActionable = currentStatus === "confirmed" || currentStatus === "pending"
  const isCancelled = currentStatus === "cancelled"
  const isPast = ["completed", "checked_in", "in_progress"].includes(currentStatus)
  const isNoShow = currentStatus === "no_show"

  function handleCancelled() {
    setCurrentStatus("cancelled")
    setShowCancelDialog(false)
  }

  function handleRescheduled(newStartIso: string) {
    // Derive the new end from the original duration so the card stays accurate.
    const durationMs = new Date(endTime).getTime() - new Date(startTime).getTime()
    const newStart = new Date(newStartIso)
    setStartTime(newStart.toISOString())
    setEndTime(new Date(newStart.getTime() + durationMs).toISOString())
    setShowRescheduleDialog(false)
  }

  const locationLine = [
    booking.locationAddress,
    booking.locationCity,
    booking.locationState,
  ]
    .filter(Boolean)
    .join(", ")

  return (
    <div className="min-h-screen env-canvas-lite">
      {/* Header */}
      <div className="border-b border-white/10 bg-white/[0.04]">
        <div className="mx-auto max-w-2xl px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sal-500 shadow-glow-sm">
                <span className="text-sm font-bold text-white">S</span>
              </div>
              <span className="text-base font-semibold text-ink">{booking.businessName}</span>
            </div>
            {booking.businessSlug && (
              <Link
                href={`/book/${booking.businessSlug}`}
                className="flex min-h-[44px] items-center gap-1 px-2 text-sm text-mint hover:text-mint-soft"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Book Again
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-2xl px-4 py-8">
        {/* The single blurred panel on this screen — cards inside are
            blur-free glass tiles. */}
        <div className="glass-panel glass-panel-lite rounded-panel p-5 sm:p-7">
        {/* Title + Status */}
        <div className="mb-6">
          <h1 className="mb-2 text-2xl font-bold text-ink">Your Appointment</h1>
          <div className="flex flex-wrap items-center gap-3">
            <Badge
              variant={statusConfig.variant as "success" | "destructive" | "warning" | "secondary" | "outline"}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 text-sm",
                statusConfig.className,
              )}
            >
              {statusConfig.icon}
              {statusConfig.label}
            </Badge>
            <span className="font-mono text-sm font-medium text-mint">
              {booking.bookingReference}
            </span>
          </div>
        </div>

        {/* State Messages */}
        {isCancelled && (
          <div className="mb-6 flex items-start gap-3 rounded-tile border border-red-400/20 bg-red-400/10 p-4">
            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
            <div>
              <p className="font-medium text-red-200">This appointment has been cancelled.</p>
              <p className="mt-1 text-sm text-red-300">
                If you&apos;d like to book again, visit our{" "}
                {booking.businessSlug ? (
                  <Link
                    href={`/book/${booking.businessSlug}`}
                    className="underline"
                  >
                    booking page
                  </Link>
                ) : (
                  "booking page"
                )}
                .
              </p>
            </div>
          </div>
        )}

        {isPast && (
          <div className="mb-6 flex items-start gap-3 glass-tile rounded-tile p-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-ink-soft" />
            <div>
              <p className="font-medium text-ink">This appointment has already taken place.</p>
              <p className="mt-1 text-sm text-ink-soft">
                Thank you for visiting {booking.businessName}!
              </p>
            </div>
          </div>
        )}

        {isNoShow && (
          <div className="mb-6 flex items-start gap-3 rounded-tile border border-amber-400/20 bg-amber-400/10 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <div>
              <p className="font-medium text-amber-200">This appointment was marked as a no-show.</p>
              <p className="mt-1 text-sm text-amber-300">
                Please contact {booking.businessName} if you have any questions.
              </p>
            </div>
          </div>
        )}

        {/* Service Details Card */}
        <Card variant="tile" className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Scissors className="h-4 w-4 text-mint" />
              Service Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {booking.services.map((svc, i) => (
              <div key={i} className={cn(i > 0 && "border-t pt-4")}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-ink">{svc.name}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-faint">
                      <span className="flex items-center gap-1">
                        <User className="h-3.5 w-3.5" />
                        {svc.staffName}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {formatDuration(svc.duration)}
                      </span>
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-ink">
                    {formatCurrency(svc.price)}
                  </span>
                </div>
              </div>
            ))}

            {booking.services.length > 1 && (
              <div className="flex items-center justify-between border-t pt-3">
                <span className="text-sm font-medium text-ink-soft">Total</span>
                <span className="font-semibold text-ink">
                  {formatCurrency(booking.totalAmount)}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Date & Time Card */}
        <Card variant="tile" className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4 text-mint" />
              Date &amp; Time
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 shrink-0 text-ink-faint" />
              <span className="text-ink-soft">{formatDateOnly(startTime, booking.businessTimezone)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 shrink-0 text-ink-faint" />
              <span className="text-ink-soft">
                {formatTimeOnly(startTime, booking.businessTimezone)} &ndash; {formatTimeOnly(endTime, booking.businessTimezone)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Location Card */}
        {(booking.locationName || locationLine) && (
          <Card variant="tile" className="mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-4 w-4 text-mint" />
                Location
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {booking.locationName && (
                <p className="text-sm font-medium text-ink">{booking.locationName}</p>
              )}
              {locationLine && (
                <p className="text-sm text-ink-faint">{locationLine}</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Contact Card */}
        {(booking.businessPhone || booking.businessEmail) && (
          <Card variant="tile" className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Phone className="h-4 w-4 text-mint" />
                Contact {booking.businessName}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {booking.businessPhone && (
                <a
                  href={`tel:${booking.businessPhone}`}
                  className="flex min-h-[44px] items-center gap-2 text-sm text-mint hover:text-mint-soft"
                >
                  <Phone className="h-4 w-4 shrink-0" />
                  {booking.businessPhone}
                </a>
              )}
              {booking.businessEmail && (
                <a
                  href={`mailto:${booking.businessEmail}`}
                  className="flex min-h-[44px] items-center gap-2 text-sm text-mint hover:text-mint-soft"
                >
                  <Mail className="h-4 w-4 shrink-0" />
                  {booking.businessEmail}
                </a>
              )}
            </CardContent>
          </Card>
        )}

        {/* Notes */}
        {booking.notes && (
          <Card variant="tile" className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-ink-soft">{booking.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        {isActionable && (
          <div className="space-y-3">
            {/* Reschedule — real self-service date/time picker */}
            {booking.serviceId && booking.locationId && (
              <Button
                variant="outline"
                className="h-11 w-full border-mint/40 text-mint hover:bg-mint/10 hover:text-mint"
                onClick={() => setShowRescheduleDialog(true)}
              >
                <Calendar className="mr-2 h-4 w-4" />
                Reschedule Appointment
              </Button>
            )}

            {/* Cancel */}
            <Button
              variant="outline"
              className="h-11 w-full border-red-400/30 text-red-400 hover:bg-red-400/10 hover:text-red-300"
              onClick={() => setShowCancelDialog(true)}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Cancel Appointment
            </Button>
          </div>
        )}
        </div>
      </div>

      {/* Cancel Dialog Overlay */}
      {showCancelDialog && (
        <CancelDialog
          booking={{ ...booking, status: currentStatus, startTime, endTime }}
          onClose={() => setShowCancelDialog(false)}
          onCancelled={handleCancelled}
        />
      )}

      {/* Reschedule Dialog Overlay */}
      {showRescheduleDialog && (
        <RescheduleDialog
          booking={{ ...booking, status: currentStatus, startTime, endTime }}
          onClose={() => setShowRescheduleDialog(false)}
          onRescheduled={handleRescheduled}
        />
      )}
    </div>
  )
}
