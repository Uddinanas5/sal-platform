"use client"

import { useState } from "react"
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
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn, formatCurrency } from "@/lib/utils"
import { cancelPublicBooking } from "@/lib/actions/public-booking"
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
  businessName: string
  businessSlug: string
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateTime(iso: string) {
  const date = new Date(iso)
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date)
}

function formatDateOnly(iso: string) {
  const date = new Date(iso)
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date)
}

function formatTimeOnly(iso: string) {
  const date = new Date(iso)
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date)
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
        className: "border-transparent bg-blue-500/10 text-blue-700",
        icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      }
    case "in_progress":
      return {
        label: "In Progress",
        variant: "info" as "outline",
        className: "border-transparent bg-blue-500/10 text-blue-700",
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
        <div className="p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
              <XCircle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Cancel Appointment</h2>
              <p className="text-sm text-gray-500">This action cannot be undone.</p>
            </div>
          </div>

          <div className="mb-4 rounded-lg bg-gray-50 p-4 text-sm text-gray-700">
            <p className="font-medium">{booking.services[0]?.name ?? "Appointment"}</p>
            <p className="mt-1 text-gray-500">{formatDateTime(booking.startTime)}</p>
          </div>

          <div className="mb-4">
            <Label htmlFor="cancel-email" className="mb-1.5 block text-sm font-medium text-gray-700">
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
            <p className="mt-1 text-xs text-gray-500">
              Enter the email address used when booking to verify your identity.
            </p>
          </div>

          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onClose}
              disabled={isLoading}
            >
              Keep Appointment
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
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
// Main Component
// ---------------------------------------------------------------------------

export function ManageBookingClient({ booking }: ManageBookingClientProps) {
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [showRescheduleInfo, setShowRescheduleInfo] = useState(false)
  const [currentStatus, setCurrentStatus] = useState(booking.status)

  const statusConfig = getStatusConfig(currentStatus)

  const isActionable = currentStatus === "confirmed" || currentStatus === "pending"
  const isCancelled = currentStatus === "cancelled"
  const isPast = ["completed", "checked_in", "in_progress"].includes(currentStatus)
  const isNoShow = currentStatus === "no_show"

  function handleCancelled() {
    setCurrentStatus("cancelled")
    setShowCancelDialog(false)
  }

  const locationLine = [
    booking.locationAddress,
    booking.locationCity,
    booking.locationState,
  ]
    .filter(Boolean)
    .join(", ")

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b bg-white">
        <div className="mx-auto max-w-2xl px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600">
                <span className="text-sm font-bold text-white">S</span>
              </div>
              <span className="text-base font-semibold text-gray-900">{booking.businessName}</span>
            </div>
            {booking.businessSlug && (
              <Link
                href={`/book/${booking.businessSlug}`}
                className="flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-700"
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
        {/* Title + Status */}
        <div className="mb-6">
          <h1 className="mb-2 text-2xl font-bold text-gray-900">Your Appointment</h1>
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
            <span className="font-mono text-sm font-medium text-emerald-600">
              {booking.bookingReference}
            </span>
          </div>
        </div>

        {/* State Messages */}
        {isCancelled && (
          <div className="mb-6 flex items-start gap-3 rounded-xl bg-red-50 p-4">
            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <div>
              <p className="font-medium text-red-900">This appointment has been cancelled.</p>
              <p className="mt-1 text-sm text-red-700">
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
          <div className="mb-6 flex items-start gap-3 rounded-xl bg-gray-100 p-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-gray-600" />
            <div>
              <p className="font-medium text-gray-900">This appointment has already taken place.</p>
              <p className="mt-1 text-sm text-gray-600">
                Thank you for visiting {booking.businessName}!
              </p>
            </div>
          </div>
        )}

        {isNoShow && (
          <div className="mb-6 flex items-start gap-3 rounded-xl bg-amber-50 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="font-medium text-amber-900">This appointment was marked as a no-show.</p>
              <p className="mt-1 text-sm text-amber-700">
                Please contact {booking.businessName} if you have any questions.
              </p>
            </div>
          </div>
        )}

        {/* Service Details Card */}
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Scissors className="h-4 w-4 text-emerald-600" />
              Service Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {booking.services.map((svc, i) => (
              <div key={i} className={cn(i > 0 && "border-t pt-4")}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-gray-900">{svc.name}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
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
                  <span className="shrink-0 text-sm font-semibold text-gray-900">
                    {formatCurrency(svc.price)}
                  </span>
                </div>
              </div>
            ))}

            {booking.services.length > 1 && (
              <div className="flex items-center justify-between border-t pt-3">
                <span className="text-sm font-medium text-gray-700">Total</span>
                <span className="font-semibold text-gray-900">
                  {formatCurrency(booking.totalAmount)}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Date & Time Card */}
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4 text-emerald-600" />
              Date &amp; Time
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 shrink-0 text-gray-400" />
              <span className="text-gray-700">{formatDateOnly(booking.startTime)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 shrink-0 text-gray-400" />
              <span className="text-gray-700">
                {formatTimeOnly(booking.startTime)} &ndash; {formatTimeOnly(booking.endTime)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Location Card */}
        {(booking.locationName || locationLine) && (
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-4 w-4 text-emerald-600" />
                Location
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {booking.locationName && (
                <p className="text-sm font-medium text-gray-900">{booking.locationName}</p>
              )}
              {locationLine && (
                <p className="text-sm text-gray-500">{locationLine}</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Contact Card */}
        {(booking.businessPhone || booking.businessEmail) && (
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Phone className="h-4 w-4 text-emerald-600" />
                Contact {booking.businessName}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {booking.businessPhone && (
                <a
                  href={`tel:${booking.businessPhone}`}
                  className="flex items-center gap-2 text-sm text-emerald-600 hover:text-emerald-700"
                >
                  <Phone className="h-4 w-4 shrink-0" />
                  {booking.businessPhone}
                </a>
              )}
              {booking.businessEmail && (
                <a
                  href={`mailto:${booking.businessEmail}`}
                  className="flex items-center gap-2 text-sm text-emerald-600 hover:text-emerald-700"
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
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">{booking.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        {isActionable && (
          <div className="space-y-3">
            {/* Reschedule */}
            <div>
              {showRescheduleInfo ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="mb-1 font-medium text-emerald-900">To reschedule your appointment</p>
                  <p className="mb-3 text-sm text-emerald-800">
                    Please contact {booking.businessName} directly:
                  </p>
                  <div className="space-y-1.5">
                    {booking.businessPhone && (
                      <a
                        href={`tel:${booking.businessPhone}`}
                        className="flex items-center gap-2 text-sm font-medium text-emerald-700 hover:text-emerald-800"
                      >
                        <Phone className="h-4 w-4" />
                        {booking.businessPhone}
                      </a>
                    )}
                    {booking.businessEmail && (
                      <a
                        href={`mailto:${booking.businessEmail}`}
                        className="flex items-center gap-2 text-sm font-medium text-emerald-700 hover:text-emerald-800"
                      >
                        <Mail className="h-4 w-4" />
                        {booking.businessEmail}
                      </a>
                    )}
                    {!booking.businessPhone && !booking.businessEmail && (
                      <p className="text-sm text-emerald-700">
                        No contact information available. Please visit the{" "}
                        {booking.businessSlug ? (
                          <Link href={`/book/${booking.businessSlug}`} className="underline">
                            booking page
                          </Link>
                        ) : (
                          "booking page"
                        )}{" "}
                        to book a new appointment.
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setShowRescheduleInfo(false)}
                    className="mt-3 text-xs text-emerald-600 underline"
                  >
                    Dismiss
                  </button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                  onClick={() => setShowRescheduleInfo(true)}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  Reschedule Appointment
                </Button>
              )}
            </div>

            {/* Cancel */}
            <Button
              variant="outline"
              className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => setShowCancelDialog(true)}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Cancel Appointment
            </Button>
          </div>
        )}
      </div>

      {/* Cancel Dialog Overlay */}
      {showCancelDialog && (
        <CancelDialog
          booking={{ ...booking, status: currentStatus }}
          onClose={() => setShowCancelDialog(false)}
          onCancelled={handleCancelled}
        />
      )}
    </div>
  )
}
