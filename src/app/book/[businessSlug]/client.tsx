"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowLeft,
  ArrowRight,
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
import { createPublicBooking } from "@/lib/actions/public-booking"
import { formatCurrency, formatDuration as fmtDuration } from "@/lib/utils"
import type { Service, Staff } from "@/data/mock-data"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BookingPageClientProps {
  businessSlug: string
  businessId: string
  businessName: string
  services: Service[]
  staff: Staff[]
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

function generateTimeSlots(): { hour: number; minute: number; label: string }[] {
  const slots: { hour: number; minute: number; label: string }[] = []
  for (let h = 9; h < 18; h++) {
    slots.push({ hour: h, minute: 0, label: formatTimeLabel(h, 0) })
    slots.push({ hour: h, minute: 30, label: formatTimeLabel(h, 30) })
  }
  return slots
}

const TIME_SLOTS = generateTimeSlots()

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

function DateTimeStep({
  selectedDate,
  selectedTime,
  onSelectDate,
  onSelectTime,
}: {
  selectedDate: Date | null
  selectedTime: { hour: number; minute: number } | null
  onSelectDate: (d: Date) => void
  onSelectTime: (t: { hour: number; minute: number }) => void
}) {
  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())

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
              const isToday = isSameDate(cellDate, today)
              const isSelected = selectedDate ? isSameDate(cellDate, selectedDate) : false
              const isSunday = cellDate.getDay() === 0

              return (
                <button
                  key={`day-${day}`}
                  disabled={isPast || isSunday}
                  onClick={() => onSelectDate(cellDate)}
                  className={`
                    h-10 rounded-lg text-sm font-medium transition-all duration-200
                    ${
                      isSelected
                        ? "bg-sal-500 text-white shadow-sm"
                        : isToday
                          ? "bg-sal-500/10 text-sal-600 dark:text-sal-400 font-semibold"
                          : isPast || isSunday
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
      {selectedDate && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <h3 className="text-sm font-semibold text-foreground mb-3">
            Available times for{" "}
            {selectedDate.toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {TIME_SLOTS.map((slot) => {
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
        </motion.div>
      )}
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
}: {
  service: Service
  staffMember: Staff | "any"
  date: Date
  time: { hour: number; minute: number }
  details: ClientDetails
  isSubmitting: boolean
  onConfirm: () => void
}) {
  const dateStr = date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })
  const timeStr = formatTimeLabel(time.hour, time.minute)
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
              <p className="text-sm text-muted-foreground">{timeStr}</p>
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
}: {
  service: Service
  staffMember: Staff | "any"
  date: Date
  time: { hour: number; minute: number }
  onBookAnother: () => void
}) {
  const [showConfetti, setShowConfetti] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(false), 3000)
    return () => clearTimeout(timer)
  }, [])

  const dateStr = date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  })
  const timeStr = formatTimeLabel(time.hour, time.minute)
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
              <span className="font-medium text-foreground">{timeStr}</span>
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

export function BookingPageClient({ businessSlug, businessId, businessName, services, staff }: BookingPageClientProps) {
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
      const startTime = new Date(selectedDate)
      startTime.setHours(selectedTime.hour, selectedTime.minute, 0, 0)

      const staffId =
        selectedStaff === "any" || !selectedStaff
          ? staff[0]?.id || "any"
          : selectedStaff.id

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
  }, [selectedService, selectedDate, selectedTime, selectedStaff, staff, businessId, clientDetails])

  const handleBookAnother = useCallback(() => {
    setStep(1)
    setIsSuccess(false)
    setSelectedService(null)
    setSelectedStaff(null)
    setSelectedDate(null)
    setSelectedTime(null)
    setClientDetails({ firstName: "", lastName: "", email: "", phone: "", notes: "" })
    setDetailErrors({})
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
                  onSelectDate={setSelectedDate}
                  onSelectTime={setSelectedTime}
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
