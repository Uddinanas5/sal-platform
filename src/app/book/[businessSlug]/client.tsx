"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Calendar as CalendarIcon,
  User,
  Scissors,
  Sparkles,
  Star,
  PartyPopper,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { createPublicBooking, addToPublicWaitlist } from "@/lib/actions/public-booking"
import { formatCurrency, formatDuration as fmtDuration } from "@/lib/utils"
import type { Service, Staff } from "@/data/mock-data"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BusinessHourData {
  dayOfWeek: number
  openTime: string | null
  closeTime: string | null
  isClosed: boolean
}

interface StaffScheduleData {
  dayOfWeek: number
  startTime: string
  endTime: string
  isWorking: boolean
}

interface StaffWithSchedules extends Staff {
  schedules?: StaffScheduleData[]
}

interface BookingPageClientProps {
  businessSlug: string
  businessId: string
  businessName: string
  locationId: string
  services: Service[]
  staff: StaffWithSchedules[]
  businessHours: BusinessHourData[]
  maxAdvanceBooking?: string
  timezone: string
}

interface ClientDetails {
  firstName: string
  lastName: string
  email: string
  phone: string
  notes: string
}

type BookingStep = 1 | 2 | 3 | 4 | 5

// ---------------------------------------------------------------------------
// Constants & helpers
// ---------------------------------------------------------------------------

const STEPS = [
  { label: "Service", icon: Scissors },
  { label: "Staff", icon: User },
  { label: "Date & Time", icon: CalendarIcon },
  { label: "Details", icon: Star },
  { label: "Confirm", icon: Check },
] as const

function formatTimeLabel(hour: number, minute: number): string {
  const h = hour % 12 || 12
  const ampm = hour < 12 ? "AM" : "PM"
  const m = minute.toString().padStart(2, "0")
  return `${h}:${m} ${ampm}`
}

function formatTimeInTimezone(isoString: string, timezone: string): string {
  return new Date(isoString).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  })
}

function formatDateInTimezone(isoString: string, timezone: string): string {
  return new Date(isoString).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: timezone,
  })
}

function getTimezoneAbbr(timezone: string): string {
  return (
    new Intl.DateTimeFormat("en-US", { timeZone: timezone, timeZoneName: "short" })
      .formatToParts(new Date())
      .find((p) => p.type === "timeZoneName")?.value || timezone
  )
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay()
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

function generateTimeSlots(
  openHour = 9,
  openMinute = 0,
  closeHour = 17,
  closeMinute = 0
): { hour: number; minute: number; label: string }[] {
  const slots: { hour: number; minute: number; label: string }[] = []
  let h = openHour
  let m = openMinute
  // Round up to nearest 30-minute mark
  if (m > 0 && m <= 30) m = 30
  else if (m > 30) { m = 0; h++ }

  while (h < closeHour || (h === closeHour && m < closeMinute)) {
    slots.push({ hour: h, minute: m, label: formatTimeLabel(h, m) })
    m += 30
    if (m >= 60) { m = 0; h++ }
  }
  return slots
}

/** Extract hours/minutes from a time ISO string (e.g. "1970-01-01T09:00:00.000Z") */
function parseTimeFromISO(iso: string): { hour: number; minute: number } {
  const d = new Date(iso)
  return { hour: d.getUTCHours(), minute: d.getUTCMinutes() }
}

function getTimeSlotsForDay(
  dayOfWeek: number,
  businessHours: BusinessHourData[]
): { hour: number; minute: number; label: string }[] {
  const dayHours = businessHours.find((bh) => bh.dayOfWeek === dayOfWeek)
  if (!dayHours || dayHours.isClosed || !dayHours.openTime || !dayHours.closeTime) {
    // Fallback: default 9 AM - 5 PM if no business hours data at all
    if (businessHours.length === 0) {
      return generateTimeSlots(9, 0, 17, 0)
    }
    // Business has hours configured but this day is closed
    return []
  }
  const open = parseTimeFromISO(dayHours.openTime)
  const close = parseTimeFromISO(dayHours.closeTime)
  return generateTimeSlots(open.hour, open.minute, close.hour, close.minute)
}

function isDayClosed(dayOfWeek: number, businessHours: BusinessHourData[]): boolean {
  // If no business hours configured at all, no days are closed
  if (businessHours.length === 0) return false
  const dayHours = businessHours.find((bh) => bh.dayOfWeek === dayOfWeek)
  // If no entry for this day, treat it as closed
  if (!dayHours) return true
  return dayHours.isClosed
}

const CATEGORY_COLORS: Record<string, string> = {
  Hair: "#f97316",
  Wellness: "#10b981",
  Nails: "#ec4899",
  Skincare: "#06b6d4",
  "Brows & Lashes": "#a855f7",
  Body: "#14b8a6",
}

// ---------------------------------------------------------------------------
// Confetti
// ---------------------------------------------------------------------------

function ConfettiParticle({ index }: { index: number }) {
  const colors = ["#059669", "#f97316", "#ec4899", "#8b5cf6", "#06b6d4", "#f59e0b"]
  const color = colors[index % colors.length]
  const left = Math.random() * 100
  const delay = Math.random() * 0.5
  const size = 6 + Math.random() * 6
  const rotation = Math.random() * 360

  return (
    <motion.div
      initial={{ y: -20, x: 0, opacity: 1, rotate: 0 }}
      animate={{
        y: [0, 400 + Math.random() * 200],
        x: [0, (Math.random() - 0.5) * 200],
        opacity: [1, 1, 0],
        rotate: rotation + 720,
      }}
      transition={{ duration: 2 + Math.random(), delay, ease: "easeOut" }}
      className="absolute pointer-events-none"
      style={{
        left: `${left}%`,
        top: -10,
        width: size,
        height: size,
        backgroundColor: color,
        borderRadius: Math.random() > 0.5 ? "50%" : "2px",
      }}
    />
  )
}

// ---------------------------------------------------------------------------
// Step Indicator
// ---------------------------------------------------------------------------

function StepIndicator({ currentStep }: { currentStep: BookingStep }) {
  return (
    <div className="w-full">
      {/* Mobile: compact bar */}
      <div className="sm:hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-foreground">
            Step {currentStep} of 5
          </span>
          <span className="text-sm text-muted-foreground">
            {STEPS[currentStep - 1].label}
          </span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-sal-500 rounded-full"
            initial={false}
            animate={{ width: `${(currentStep / 5) * 100}%` }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
          />
        </div>
      </div>

      {/* Desktop: stepped indicator */}
      <div className="hidden sm:flex items-center justify-center gap-0">
        {STEPS.map((step, i) => {
          const stepNum = (i + 1) as BookingStep
          const isActive = stepNum === currentStep
          const isCompleted = stepNum < currentStep
          const StepIcon = step.icon

          return (
            <div key={step.label} className="flex items-center">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300
                    ${
                      isCompleted
                        ? "bg-sal-500 text-white"
                        : isActive
                          ? "bg-sal-500 text-white ring-4 ring-sal-500/20"
                          : "bg-muted text-muted-foreground"
                    }
                  `}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <StepIcon className="w-4 h-4" />
                  )}
                </div>
                <span
                  className={`text-xs font-medium transition-colors ${
                    isActive || isCompleted ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`w-12 lg:w-16 h-0.5 mx-1 mt-[-18px] transition-colors duration-300 ${
                    stepNum < currentStep ? "bg-sal-500" : "bg-muted"
                  }`}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 1: Select Service
// ---------------------------------------------------------------------------

function ServiceStep({
  services,
  selectedService,
  onSelect,
}: {
  services: Service[]
  selectedService: Service | null
  onSelect: (s: Service) => void
}) {
  const grouped = useMemo(() => {
    const map: Record<string, Service[]> = {}
    for (const s of services) {
      if (!s.isActive) continue
      const cat = s.category || "Other"
      if (!map[cat]) map[cat] = []
      map[cat].push(s)
    }
    return map
  }, [services])

  const categories = Object.keys(grouped)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold font-heading text-foreground">
          Select a service
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Choose the service you&apos;d like to book
        </p>
      </div>

      {categories.map((cat) => (
        <div key={cat} className="space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: CATEGORY_COLORS[cat] || "#6b7280" }}
            />
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
              {cat}
            </h3>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {grouped[cat].length}
            </Badge>
          </div>

          <div className="space-y-2">
            {grouped[cat].map((service) => {
              const isSelected = selectedService?.id === service.id
              return (
                <motion.div key={service.id} whileTap={{ scale: 0.98 }} layout>
                  <Card
                    className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                      isSelected
                        ? "ring-2 ring-sal-500 shadow-md shadow-sal-500/10"
                        : "hover:border-sal-300 dark:hover:border-sal-700"
                    }`}
                    onClick={() => onSelect(service)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-foreground">
                              {service.name}
                            </h4>
                            {isSelected && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="w-5 h-5 rounded-full bg-sal-500 flex items-center justify-center"
                              >
                                <Check className="w-3 h-3 text-white" />
                              </motion.div>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">
                            {service.description}
                          </p>
                          <div className="flex items-center gap-3 mt-2">
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              {fmtDuration(service.duration)}
                            </span>
                          </div>
                        </div>
                        <div className="text-right ml-4 shrink-0">
                          <span className="text-lg font-semibold text-foreground font-heading">
                            {formatCurrency(service.price)}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 2: Select Staff
// ---------------------------------------------------------------------------

function StaffStep({
  staff,
  selectedService,
  selectedStaff,
  onSelect,
}: {
  staff: Staff[]
  selectedService: Service
  selectedStaff: Staff | null | "any"
  onSelect: (s: Staff | "any") => void
}) {
  const availableStaff = useMemo(
    () => staff.filter((s) => s.isActive && s.services.includes(selectedService.id)),
    [staff, selectedService]
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold font-heading text-foreground">
          Choose your stylist
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Select a team member for your{" "}
          <span className="font-medium text-foreground">{selectedService.name}</span>
        </p>
      </div>

      <div className="space-y-3">
        {/* Any Available */}
        <motion.div whileTap={{ scale: 0.98 }}>
          <Card
            className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
              selectedStaff === "any"
                ? "ring-2 ring-sal-500 shadow-md shadow-sal-500/10"
                : "hover:border-sal-300 dark:hover:border-sal-700"
            }`}
            onClick={() => onSelect("any")}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-sal-400 to-sal-600 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-foreground">Any available</h4>
                  <p className="text-sm text-muted-foreground">
                    We&apos;ll match you with the next available team member
                  </p>
                </div>
                {selectedStaff === "any" && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-6 h-6 rounded-full bg-sal-500 flex items-center justify-center"
                  >
                    <Check className="w-3.5 h-3.5 text-white" />
                  </motion.div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {availableStaff.map((member) => {
          const isSelected = selectedStaff !== "any" && selectedStaff?.id === member.id
          const initials = member.name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()

          return (
            <motion.div key={member.id} whileTap={{ scale: 0.98 }}>
              <Card
                className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                  isSelected
                    ? "ring-2 ring-sal-500 shadow-md shadow-sal-500/10"
                    : "hover:border-sal-300 dark:hover:border-sal-700"
                }`}
                onClick={() => onSelect(member)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-white text-sm font-semibold"
                      style={{ backgroundColor: member.color || "#059669" }}
                    >
                      {initials}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-foreground">{member.name}</h4>
                      <p className="text-sm text-muted-foreground capitalize">{member.role}</p>
                    </div>
                    {isSelected && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-6 h-6 rounded-full bg-sal-500 flex items-center justify-center"
                      >
                        <Check className="w-3.5 h-3.5 text-white" />
                      </motion.div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}

        {availableStaff.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <User className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No staff available for this service</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 3: Date & Time
// ---------------------------------------------------------------------------

const MAX_ADVANCE_MAP: Record<string, number> = {
  "1w": 7, "2w": 14, "1m": 30, "2m": 60, "3m": 90,
}

// ---------------------------------------------------------------------------
// Waitlist time range options
// ---------------------------------------------------------------------------

const WAITLIST_TIME_RANGES = [
  { label: "Any time", value: "any", start: undefined, end: undefined },
  { label: "Morning (9am–12pm)", value: "morning", start: "09:00:00", end: "12:00:00" },
  { label: "Afternoon (12pm–5pm)", value: "afternoon", start: "12:00:00", end: "17:00:00" },
  { label: "Evening (5pm–9pm)", value: "evening", start: "17:00:00", end: "21:00:00" },
] as const

type WaitlistTimeRange = (typeof WAITLIST_TIME_RANGES)[number]["value"]

interface WaitlistFormState {
  preferredTime: WaitlistTimeRange
  firstName: string
  lastName: string
  email: string
  phone: string
  notes: string
}

interface WaitlistFormErrors {
  firstName?: string
  lastName?: string
  email?: string
}

function DateTimeStep({
  selectedDate,
  selectedTime,
  onSelectDate,
  onSelectTime,
  businessHours,
  maxAdvanceBooking,
  timezone,
  // Waitlist props
  serviceId,
  prefillDetails,
  showWaitlistForm,
  waitlistSubmitted,
  waitlistLoading,
  onShowWaitlist,
  onWaitlistSubmit,
  onTryAnotherDate,
}: {
  selectedDate: Date | null
  selectedTime: { hour: number; minute: number } | null
  onSelectDate: (d: Date) => void
  onSelectTime: (t: { hour: number; minute: number }) => void
  businessHours: BusinessHourData[]
  maxAdvanceBooking?: string
  timezone: string
  serviceId: string | null
  prefillDetails: { firstName: string; lastName: string; email: string; phone: string }
  showWaitlistForm: boolean
  waitlistSubmitted: boolean
  waitlistLoading: boolean
  onShowWaitlist: () => void
  onWaitlistSubmit: (form: WaitlistFormState) => Promise<void>
  onTryAnotherDate: () => void
}) {
  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const maxDate = useMemo(() => {
    const maxDaysAdvance = MAX_ADVANCE_MAP[maxAdvanceBooking ?? "1m"] ?? 30
    const d = new Date(today)
    d.setDate(d.getDate() + maxDaysAdvance)
    return d
  }, [today, maxAdvanceBooking])

  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())

  const [waitlistForm, setWaitlistForm] = useState<WaitlistFormState>({
    preferredTime: "any",
    firstName: prefillDetails.firstName,
    lastName: prefillDetails.lastName,
    email: prefillDetails.email,
    phone: prefillDetails.phone,
    notes: "",
  })
  const [waitlistErrors, setWaitlistErrors] = useState<WaitlistFormErrors>({})

  // Pre-fill from parent details when they change
  useEffect(() => {
    setWaitlistForm((prev) => ({
      ...prev,
      firstName: prefillDetails.firstName || prev.firstName,
      lastName: prefillDetails.lastName || prev.lastName,
      email: prefillDetails.email || prev.email,
      phone: prefillDetails.phone || prev.phone,
    }))
  }, [prefillDetails.firstName, prefillDetails.lastName, prefillDetails.email, prefillDetails.phone])

  const daysInMonth = getDaysInMonth(viewYear, viewMonth)
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth)

  const prevMonth = useCallback(() => {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear((y) => y - 1)
    } else {
      setViewMonth((m) => m - 1)
    }
  }, [viewMonth])

  const nextMonth = useCallback(() => {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear((y) => y + 1)
    } else {
      setViewMonth((m) => m + 1)
    }
  }, [viewMonth])

  const isPastMonth =
    viewYear < today.getFullYear() ||
    (viewYear === today.getFullYear() && viewMonth < today.getMonth())

  const calendarCells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) calendarCells.push(null)
  for (let d = 1; d <= daysInMonth; d++) calendarCells.push(d)

  const isSameDate = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()

  const validateWaitlistForm = (): boolean => {
    const errs: WaitlistFormErrors = {}
    if (!waitlistForm.firstName.trim()) errs.firstName = "Required"
    if (!waitlistForm.lastName.trim()) errs.lastName = "Required"
    if (!waitlistForm.email.trim()) {
      errs.email = "Required"
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(waitlistForm.email.trim())) {
      errs.email = "Please enter a valid email"
    }
    setWaitlistErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleWaitlistSubmit = async () => {
    if (!validateWaitlistForm()) return
    await onWaitlistSubmit(waitlistForm)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold font-heading text-foreground">
          Pick a date & time
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Select your preferred appointment slot
        </p>
      </div>

      {/* Calendar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={prevMonth}
              disabled={isPastMonth}
              className="p-2 rounded-lg hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h3 className="font-semibold text-foreground font-heading">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </h3>
            <button
              onClick={nextMonth}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
              aria-label="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 mb-1">
            {DAY_LABELS.map((d) => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendarCells.map((day, idx) => {
              if (day === null) return <div key={`empty-${idx}`} className="h-10" />

              const cellDate = new Date(viewYear, viewMonth, day)
              cellDate.setHours(0, 0, 0, 0)
              const isPast = cellDate < today
              const isBeyondMax = cellDate > maxDate
              const isToday = isSameDate(cellDate, today)
              const isSelected = selectedDate ? isSameDate(cellDate, selectedDate) : false
              const closed = isDayClosed(cellDate.getDay(), businessHours)
              const isDisabled = isPast || closed || isBeyondMax

              return (
                <button
                  key={`day-${day}`}
                  disabled={isDisabled}
                  onClick={() => onSelectDate(cellDate)}
                  className={`
                    h-10 rounded-lg text-sm font-medium transition-all duration-200
                    ${
                      isSelected
                        ? "bg-sal-500 text-white shadow-sm"
                        : isToday && !closed
                          ? "bg-sal-500/10 text-sal-600 dark:text-sal-400 font-semibold"
                          : isDisabled
                            ? "text-muted-foreground/40 cursor-not-allowed"
                            : "text-foreground hover:bg-muted"
                    }
                  `}
                  aria-label={`${MONTH_NAMES[viewMonth]} ${day}`}
                >
                  {day}
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Time slots */}
      {selectedDate && (() => {
        const dayOfWeek = selectedDate.getDay()
        const timeSlots = getTimeSlotsForDay(dayOfWeek, businessHours)
        // Build a date string for the selected date in business timezone context
        const selectedDateIso = new Date(
          selectedDate.getFullYear(),
          selectedDate.getMonth(),
          selectedDate.getDate(),
          12, 0, 0
        ).toISOString()
        const tzAbbr = getTimezoneAbbr(timezone)
        return (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <h3 className="text-sm font-semibold text-foreground mb-3">
              Available times for{" "}
              {formatDateInTimezone(selectedDateIso, timezone).replace(/,\s*\d{4}$/, "")}
            </h3>
            {timeSlots.length === 0 ? (
              <div className="py-2">
                {waitlistSubmitted ? (
                  // Success state after joining waitlist
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="text-center space-y-4 py-4"
                  >
                    <div className="w-14 h-14 rounded-full bg-sal-500/10 mx-auto flex items-center justify-center">
                      <Bell className="w-7 h-7 text-sal-600 dark:text-sal-400" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground text-base">
                        You&apos;re on the waitlist!
                      </h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        We&apos;ll notify you at{" "}
                        <span className="font-medium text-foreground">{waitlistForm.email}</span>{" "}
                        when a slot opens up.
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={onTryAnotherDate}>
                      Try another date
                    </Button>
                  </motion.div>
                ) : showWaitlistForm ? (
                  // Inline waitlist form
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-4"
                  >
                    <div className="text-center">
                      <p className="text-sm font-medium text-foreground">
                        No slots available for this date
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Fill in your details and we&apos;ll notify you when a spot opens up
                      </p>
                    </div>

                    {/* Preferred time */}
                    <div className="space-y-2">
                      <Label htmlFor="wl-preferred-time">Preferred time</Label>
                      <select
                        id="wl-preferred-time"
                        value={waitlistForm.preferredTime}
                        onChange={(e) =>
                          setWaitlistForm((prev) => ({
                            ...prev,
                            preferredTime: e.target.value as WaitlistTimeRange,
                          }))
                        }
                        className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      >
                        {WAITLIST_TIME_RANGES.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Name row */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="wl-first-name">
                          First name <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="wl-first-name"
                          placeholder="Jane"
                          value={waitlistForm.firstName}
                          onChange={(e) =>
                            setWaitlistForm((prev) => ({ ...prev, firstName: e.target.value }))
                          }
                          className={waitlistErrors.firstName ? "border-destructive" : ""}
                        />
                        {waitlistErrors.firstName && (
                          <p className="text-xs text-destructive">{waitlistErrors.firstName}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="wl-last-name">
                          Last name <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="wl-last-name"
                          placeholder="Doe"
                          value={waitlistForm.lastName}
                          onChange={(e) =>
                            setWaitlistForm((prev) => ({ ...prev, lastName: e.target.value }))
                          }
                          className={waitlistErrors.lastName ? "border-destructive" : ""}
                        />
                        {waitlistErrors.lastName && (
                          <p className="text-xs text-destructive">{waitlistErrors.lastName}</p>
                        )}
                      </div>
                    </div>

                    {/* Email */}
                    <div className="space-y-2">
                      <Label htmlFor="wl-email">
                        Email <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="wl-email"
                        type="email"
                        placeholder="jane@example.com"
                        value={waitlistForm.email}
                        onChange={(e) =>
                          setWaitlistForm((prev) => ({ ...prev, email: e.target.value }))
                        }
                        className={waitlistErrors.email ? "border-destructive" : ""}
                      />
                      {waitlistErrors.email && (
                        <p className="text-xs text-destructive">{waitlistErrors.email}</p>
                      )}
                    </div>

                    {/* Phone */}
                    <div className="space-y-2">
                      <Label htmlFor="wl-phone">Phone (optional)</Label>
                      <Input
                        id="wl-phone"
                        type="tel"
                        placeholder="+1 (555) 000-0000"
                        value={waitlistForm.phone}
                        onChange={(e) =>
                          setWaitlistForm((prev) => ({ ...prev, phone: e.target.value }))
                        }
                      />
                    </div>

                    {/* Notes */}
                    <div className="space-y-2">
                      <Label htmlFor="wl-notes">Notes (optional)</Label>
                      <Textarea
                        id="wl-notes"
                        placeholder="Any additional notes..."
                        value={waitlistForm.notes}
                        onChange={(e) =>
                          setWaitlistForm((prev) => ({ ...prev, notes: e.target.value }))
                        }
                        maxLength={500}
                        className="min-h-[80px]"
                      />
                    </div>

                    <Button
                      className="w-full"
                      onClick={handleWaitlistSubmit}
                      disabled={waitlistLoading}
                    >
                      {waitlistLoading ? (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                          className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                        />
                      ) : (
                        <>
                          <Bell className="w-4 h-4 mr-2" />
                          Join Waitlist
                        </>
                      )}
                    </Button>
                    <Button variant="ghost" size="sm" className="w-full" onClick={onTryAnotherDate}>
                      Try another date instead
                    </Button>
                  </motion.div>
                ) : (
                  // Initial prompt to join waitlist
                  <div className="text-center space-y-3 py-4">
                    <p className="text-sm text-muted-foreground">
                      No available slots for{" "}
                      <span className="font-medium text-foreground">
                        {formatDateInTimezone(selectedDateIso, timezone).replace(/,\s*\d{4}$/, "")}
                      </span>
                      .
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Would you like to be notified when a spot opens up?
                    </p>
                    <Button size="sm" onClick={onShowWaitlist} disabled={!serviceId}>
                      <Bell className="w-4 h-4 mr-2" />
                      Join Waitlist
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {timeSlots.map((slot) => {
                    const isSelected =
                      selectedTime?.hour === slot.hour && selectedTime?.minute === slot.minute
                    return (
                      <button
                        key={slot.label}
                        onClick={() => onSelectTime({ hour: slot.hour, minute: slot.minute })}
                        className={`
                          py-2.5 px-3 rounded-lg text-sm font-medium transition-all duration-200 border
                          ${
                            isSelected
                              ? "bg-sal-500 text-white border-sal-500 shadow-sm"
                              : "border-input bg-background text-foreground hover:border-sal-400 hover:bg-sal-500/5"
                          }
                        `}
                      >
                        {slot.label}
                      </button>
                    )
                  })}
                </div>
                <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  All times shown in {tzAbbr}
                </p>
              </>
            )}
          </motion.div>
        )
      })()}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 4: Client Details
// ---------------------------------------------------------------------------

function DetailsStep({
  details,
  onChange,
  errors,
}: {
  details: ClientDetails
  onChange: (d: ClientDetails) => void
  errors: Partial<Record<keyof ClientDetails, string>>
}) {
  const update = (field: keyof ClientDetails, value: string) => {
    onChange({ ...details, [field]: value })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold font-heading text-foreground">
          Your details
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Enter your information to complete the booking
        </p>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="firstName">
              First name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="firstName"
              placeholder="Jane"
              value={details.firstName}
              onChange={(e) => update("firstName", e.target.value)}
              className={errors.firstName ? "border-destructive" : ""}
            />
            {errors.firstName && (
              <p className="text-xs text-destructive">{errors.firstName}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">
              Last name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="lastName"
              placeholder="Doe"
              value={details.lastName}
              onChange={(e) => update("lastName", e.target.value)}
              className={errors.lastName ? "border-destructive" : ""}
            />
            {errors.lastName && (
              <p className="text-xs text-destructive">{errors.lastName}</p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">
            Email <span className="text-destructive">*</span>
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="jane@example.com"
            value={details.email}
            onChange={(e) => update("email", e.target.value)}
            className={errors.email ? "border-destructive" : ""}
          />
          {errors.email && (
            <p className="text-xs text-destructive">{errors.email}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">
            Phone <span className="text-destructive">*</span>
          </Label>
          <Input
            id="phone"
            type="tel"
            placeholder="+1 (555) 000-0000"
            value={details.phone}
            onChange={(e) => update("phone", e.target.value)}
            className={errors.phone ? "border-destructive" : ""}
          />
          {errors.phone && (
            <p className="text-xs text-destructive">{errors.phone}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Notes (optional)</Label>
          <Textarea
            id="notes"
            placeholder="Any special requests or notes for your appointment..."
            value={details.notes}
            onChange={(e) => update("notes", e.target.value)}
            maxLength={500}
            showCounter
            className="min-h-[100px]"
          />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 5: Confirmation / Summary
// ---------------------------------------------------------------------------

function ConfirmationStep({
  service,
  staffMember,
  date,
  time,
  details,
  isSubmitting,
  onConfirm,
  timezone,
}: {
  service: Service
  staffMember: Staff | "any"
  date: Date
  time: { hour: number; minute: number }
  details: ClientDetails
  isSubmitting: boolean
  onConfirm: () => void
  timezone: string
}) {
  // Build an ISO string representing the selected date+time for timezone-aware formatting
  const appointmentIso = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    time.hour,
    time.minute,
    0
  ).toISOString()
  const dateStr = formatDateInTimezone(appointmentIso, timezone)
  const timeStr = formatTimeInTimezone(appointmentIso, timezone)
  const tzAbbr = getTimezoneAbbr(timezone)
  const staffName = staffMember === "any" ? "Any available" : staffMember.name

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold font-heading text-foreground">
          Review & confirm
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Please review your booking details
        </p>
      </div>

      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-sal-500/10 flex items-center justify-center shrink-0 mt-0.5">
              <Scissors className="w-4 h-4 text-sal-600 dark:text-sal-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Service</p>
              <p className="font-medium text-foreground">{service.name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-sm text-muted-foreground">
                  {fmtDuration(service.duration)}
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {formatCurrency(service.price)}
                </span>
              </div>
            </div>
          </div>

          <div className="border-t border-border" />

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-sal-500/10 flex items-center justify-center shrink-0 mt-0.5">
              <User className="w-4 h-4 text-sal-600 dark:text-sal-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Staff</p>
              <p className="font-medium text-foreground">{staffName}</p>
            </div>
          </div>

          <div className="border-t border-border" />

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-sal-500/10 flex items-center justify-center shrink-0 mt-0.5">
              <CalendarIcon className="w-4 h-4 text-sal-600 dark:text-sal-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Date & Time</p>
              <p className="font-medium text-foreground">{dateStr}</p>
              <p className="text-sm text-muted-foreground">{timeStr} ({tzAbbr})</p>
            </div>
          </div>

          <div className="border-t border-border" />

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-sal-500/10 flex items-center justify-center shrink-0 mt-0.5">
              <Star className="w-4 h-4 text-sal-600 dark:text-sal-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Your info</p>
              <p className="font-medium text-foreground">
                {details.firstName} {details.lastName}
              </p>
              <p className="text-sm text-muted-foreground">{details.email}</p>
              <p className="text-sm text-muted-foreground">{details.phone}</p>
              {details.notes && (
                <p className="text-sm text-muted-foreground mt-1 italic">
                  &ldquo;{details.notes}&rdquo;
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-sal-500/5 border-sal-500/20">
        <CardContent className="p-4 flex items-center justify-between">
          <span className="font-medium text-foreground">Total</span>
          <span className="text-xl font-bold text-sal-600 dark:text-sal-400 font-heading">
            {formatCurrency(service.price)}
          </span>
        </CardContent>
      </Card>

      <Button size="lg" className="w-full text-base h-12" onClick={onConfirm} disabled={isSubmitting}>
        {isSubmitting ? (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
          />
        ) : (
          <>
            Confirm Booking
            <Check className="w-4 h-4 ml-2" />
          </>
        )}
      </Button>

      <p className="text-xs text-center text-muted-foreground">
        By confirming, you agree to the cancellation policy. You&apos;ll receive a
        confirmation email at {details.email}.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Success State
// ---------------------------------------------------------------------------

function SuccessState({
  service,
  staffMember,
  date,
  time,
  onBookAnother,
  timezone,
}: {
  service: Service
  staffMember: Staff | "any"
  date: Date
  time: { hour: number; minute: number }
  onBookAnother: () => void
  timezone: string
}) {
  const [showConfetti, setShowConfetti] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(false), 3000)
    return () => clearTimeout(timer)
  }, [])

  const appointmentIso = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    time.hour,
    time.minute,
    0
  ).toISOString()
  const dateStr = new Date(appointmentIso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: timezone,
  })
  const timeStr = formatTimeInTimezone(appointmentIso, timezone)
  const tzAbbr = getTimezoneAbbr(timezone)
  const staffName = staffMember === "any" ? "Any available" : staffMember.name

  return (
    <div className="relative">
      {showConfetti && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none -top-20">
          {Array.from({ length: 40 }).map((_, i) => (
            <ConfettiParticle key={i} index={i} />
          ))}
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="text-center space-y-6"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          className="w-20 h-20 rounded-full bg-sal-500 mx-auto flex items-center justify-center"
        >
          <PartyPopper className="w-9 h-9 text-white" />
        </motion.div>

        <div>
          <h2 className="text-2xl font-bold font-heading text-foreground">
            Booking confirmed!
          </h2>
          <p className="text-muted-foreground mt-1">
            Your appointment has been booked successfully
          </p>
        </div>

        <Card>
          <CardContent className="p-5 text-left space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Service</span>
              <span className="font-medium text-foreground">{service.name}</span>
            </div>
            <div className="border-t border-border" />
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Staff</span>
              <span className="font-medium text-foreground">{staffName}</span>
            </div>
            <div className="border-t border-border" />
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Date</span>
              <span className="font-medium text-foreground">{dateStr}</span>
            </div>
            <div className="border-t border-border" />
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Time</span>
              <span className="font-medium text-foreground">{timeStr} ({tzAbbr})</span>
            </div>
            <div className="border-t border-border" />
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="font-semibold text-sal-600 dark:text-sal-400">
                {formatCurrency(service.price)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Button size="lg" variant="outline" className="w-full" onClick={onBookAnother}>
          Book another appointment
        </Button>
      </motion.div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Client Component
// ---------------------------------------------------------------------------

export function BookingPageClient({ businessSlug, businessId, businessName, locationId, services, staff, businessHours, maxAdvanceBooking, timezone }: BookingPageClientProps) {
  // locationId is used for future availability API calls from the client
  void locationId
  // Suppress unused variable warning - businessSlug is kept for future URL-based features
  void businessSlug
  const [step, setStep] = useState<BookingStep>(1)
  const [isSuccess, setIsSuccess] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [selectedStaff, setSelectedStaff] = useState<Staff | "any" | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedTime, setSelectedTime] = useState<{ hour: number; minute: number } | null>(null)
  const [clientDetails, setClientDetails] = useState<ClientDetails>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    notes: "",
  })
  const [detailErrors, setDetailErrors] = useState<Partial<Record<keyof ClientDetails, string>>>({})

  // Waitlist state
  const [showWaitlistForm, setShowWaitlistForm] = useState(false)
  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false)
  const [waitlistLoading, setWaitlistLoading] = useState(false)

  const [direction, setDirection] = useState(1)

  // businessName is passed as prop from server component

  const canNext = useMemo(() => {
    switch (step) {
      case 1:
        return selectedService !== null
      case 2:
        return selectedStaff !== null
      case 3:
        return selectedDate !== null && selectedTime !== null
      case 4:
        return (
          clientDetails.firstName.trim() !== "" &&
          clientDetails.lastName.trim() !== "" &&
          clientDetails.email.trim() !== "" &&
          clientDetails.phone.trim() !== ""
        )
      case 5:
        return true
      default:
        return false
    }
  }, [step, selectedService, selectedStaff, selectedDate, selectedTime, clientDetails])

  const validateDetails = useCallback((): boolean => {
    const errs: Partial<Record<keyof ClientDetails, string>> = {}
    if (!clientDetails.firstName.trim()) errs.firstName = "Required"
    if (!clientDetails.lastName.trim()) errs.lastName = "Required"
    if (!clientDetails.email.trim()) {
      errs.email = "Required"
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientDetails.email.trim())) {
      errs.email = "Please enter a valid email"
    }
    if (!clientDetails.phone.trim()) errs.phone = "Required"
    setDetailErrors(errs)
    return Object.keys(errs).length === 0
  }, [clientDetails])

  const goNext = useCallback(() => {
    if (step === 4 && !validateDetails()) return
    if (step < 5) {
      setDirection(1)
      setStep((s) => (s + 1) as BookingStep)
    }
  }, [step, validateDetails])

  const goBack = useCallback(() => {
    if (step > 1) {
      setDirection(-1)
      setStep((s) => (s - 1) as BookingStep)
    }
  }, [step])

  const handleConfirm = useCallback(async () => {
    if (!selectedService || !selectedDate || !selectedTime) return

    setIsSubmitting(true)
    try {
      // Build the start time in the business timezone.
      // We construct a wall-clock string for the selected date/time and interpret
      // it as if it were in the business timezone, yielding the correct UTC instant.
      const pad = (n: number) => String(n).padStart(2, "0")
      const localDateStr = `${selectedDate.getFullYear()}-${pad(selectedDate.getMonth() + 1)}-${pad(selectedDate.getDate())}T${pad(selectedTime.hour)}:${pad(selectedTime.minute)}:00`
      // Parse as UTC first, then shift by the timezone offset so the wall-clock
      // time is correct in the business timezone.
      const naiveUtc = new Date(localDateStr + "Z")
      // Determine what the business timezone renders naiveUtc as, compute offset.
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).formatToParts(naiveUtc)
      const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0")
      const tzYear = get("year")
      const tzMonth = get("month") - 1
      const tzDay = get("day")
      const tzHour = get("hour") % 24
      const tzMin = get("minute")
      const tzSec = get("second")
      const tzDate = new Date(Date.UTC(tzYear, tzMonth, tzDay, tzHour, tzMin, tzSec))
      const offsetMs = naiveUtc.getTime() - tzDate.getTime()
      const startTime = new Date(naiveUtc.getTime() + offsetMs)

      // When "any" is selected, pick the first staff member who provides the selected service
      const staffId =
        selectedStaff === "any" || !selectedStaff
          ? staff.find((s) => s.services.includes(selectedService.id))?.id
          : selectedStaff.id

      if (!staffId) {
        toast.error("No staff available for this service")
        setIsSubmitting(false)
        return
      }

      const result = await createPublicBooking({
        businessId,
        serviceId: selectedService.id,
        staffId,
        startTime: startTime.toISOString(),
        clientFirstName: clientDetails.firstName,
        clientLastName: clientDetails.lastName,
        clientEmail: clientDetails.email,
        clientPhone: clientDetails.phone,
        notes: clientDetails.notes || undefined,
      })

      if (result.success) {
        setIsSuccess(true)
        toast.success("Appointment booked successfully!")
      } else {
        toast.error(result.error || "Something went wrong")
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to book appointment. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }, [selectedService, selectedDate, selectedTime, selectedStaff, staff, businessId, clientDetails, timezone])

  const handleSelectDate = useCallback((d: Date) => {
    setSelectedDate(d)
    setSelectedTime(null)
    setShowWaitlistForm(false)
    setWaitlistSubmitted(false)
  }, [])

  const handleWaitlistSubmit = useCallback(
    async (form: WaitlistFormState) => {
      if (!selectedDate || !selectedService) return
      setWaitlistLoading(true)
      try {
        const pad = (n: number) => String(n).padStart(2, "0")
        const preferredDate = `${selectedDate.getFullYear()}-${pad(selectedDate.getMonth() + 1)}-${pad(selectedDate.getDate())}`

        const timeRange = WAITLIST_TIME_RANGES.find((r) => r.value === form.preferredTime)
        const staffId =
          selectedStaff === "any" || !selectedStaff
            ? (staff.find((s) => s.services.includes(selectedService.id))?.id ?? undefined)
            : selectedStaff.id

        const result = await addToPublicWaitlist({
          businessId,
          serviceId: selectedService.id,
          staffId,
          preferredDate,
          preferredTimeStart: timeRange?.start,
          preferredTimeEnd: timeRange?.end,
          clientFirstName: form.firstName,
          clientLastName: form.lastName,
          clientEmail: form.email,
          clientPhone: form.phone || undefined,
          notes: form.notes || undefined,
        })

        if (result.success) {
          setWaitlistSubmitted(true)
          toast.success("You've been added to the waitlist!")
        } else {
          toast.error(result.error || "Failed to join waitlist")
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to join waitlist")
      } finally {
        setWaitlistLoading(false)
      }
    },
    [selectedDate, selectedService, selectedStaff, staff, businessId]
  )

  const handleTryAnotherDate = useCallback(() => {
    setSelectedDate(null)
    setSelectedTime(null)
    setShowWaitlistForm(false)
    setWaitlistSubmitted(false)
  }, [])

  const handleBookAnother = useCallback(() => {
    setStep(1)
    setIsSuccess(false)
    setSelectedService(null)
    setSelectedStaff(null)
    setSelectedDate(null)
    setSelectedTime(null)
    setClientDetails({ firstName: "", lastName: "", email: "", phone: "", notes: "" })
    setDetailErrors({})
    setShowWaitlistForm(false)
    setWaitlistSubmitted(false)
  }, [])

  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center justify-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sal-500 flex items-center justify-center">
              <Scissors className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-lg font-semibold font-heading text-foreground">
              Book with {businessName}
            </h1>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-lg mx-auto px-4 py-6 pb-32">
        {!isSuccess && (
          <div className="mb-8">
            <StepIndicator currentStep={step} />
          </div>
        )}

        <AnimatePresence mode="wait" custom={direction}>
          {isSuccess ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <SuccessState
                service={selectedService!}
                staffMember={selectedStaff!}
                date={selectedDate!}
                time={selectedTime!}
                onBookAnother={handleBookAnother}
                timezone={timezone}
              />
            </motion.div>
          ) : (
            <motion.div
              key={step}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: "easeInOut" }}
            >
              {step === 1 && (
                <ServiceStep
                  services={services}
                  selectedService={selectedService}
                  onSelect={setSelectedService}
                />
              )}
              {step === 2 && selectedService && (
                <StaffStep
                  staff={staff}
                  selectedService={selectedService}
                  selectedStaff={selectedStaff}
                  onSelect={setSelectedStaff}
                />
              )}
              {step === 3 && (
                <DateTimeStep
                  selectedDate={selectedDate}
                  selectedTime={selectedTime}
                  onSelectDate={handleSelectDate}
                  onSelectTime={setSelectedTime}
                  businessHours={businessHours}
                  maxAdvanceBooking={maxAdvanceBooking}
                  timezone={timezone}
                  serviceId={selectedService?.id ?? null}
                  prefillDetails={{
                    firstName: clientDetails.firstName,
                    lastName: clientDetails.lastName,
                    email: clientDetails.email,
                    phone: clientDetails.phone,
                  }}
                  showWaitlistForm={showWaitlistForm}
                  waitlistSubmitted={waitlistSubmitted}
                  waitlistLoading={waitlistLoading}
                  onShowWaitlist={() => setShowWaitlistForm(true)}
                  onWaitlistSubmit={handleWaitlistSubmit}
                  onTryAnotherDate={handleTryAnotherDate}
                />
              )}
              {step === 4 && (
                <DetailsStep
                  details={clientDetails}
                  onChange={setClientDetails}
                  errors={detailErrors}
                />
              )}
              {step === 5 && selectedService && selectedStaff && selectedDate && selectedTime && (
                <ConfirmationStep
                  service={selectedService}
                  staffMember={selectedStaff}
                  date={selectedDate}
                  time={selectedTime}
                  details={clientDetails}
                  isSubmitting={isSubmitting}
                  onConfirm={handleConfirm}
                  timezone={timezone}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom nav bar */}
      {!isSuccess && (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-background/80 backdrop-blur-lg border-t border-border">
          <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
            {step > 1 && (
              <Button variant="outline" onClick={goBack} className="flex-shrink-0">
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
            )}
            {step < 5 && (
              <Button className="flex-1" onClick={goNext} disabled={!canNext}>
                Continue
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
