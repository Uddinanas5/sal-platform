"use client"

import React, { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  CheckCircle2,
  Wifi,
  Battery,
  Signal,
} from "lucide-react"
import { cn, formatCurrency, getInitials } from "@/lib/utils"
import type { Service, Staff } from "@/data/mock-data"
import { TimeSlotsGrid } from "./time-slots-grid"

const TOTAL_STEPS = 6

function PhoneStatusBar() {
  return (
    <div className="flex items-center justify-between px-5 py-1.5 text-[10px] text-white font-semibold">
      <span>9:41</span>
      <div className="flex items-center gap-1">
        <Signal className="w-3 h-3" />
        <Wifi className="w-3 h-3" />
        <Battery className="w-3.5 h-3.5" />
      </div>
    </div>
  )
}

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <motion.div
          key={i}
          animate={{
            width: i + 1 === current ? 16 : 6,
            backgroundColor:
              i + 1 === current
                ? "#4fe6a6"
                : i + 1 < current
                  ? "#2dd790"
                  : "rgba(255,255,255,0.25)",
          }}
          className={cn("h-1.5 rounded-full", i + 1 === current && "shadow-led-mint")}
          transition={{ duration: 0.3 }}
        />
      ))}
    </div>
  )
}

// Step 1: Service Selection
function ServiceStep({
  services,
  onSelect,
  selectedServiceId,
}: {
  services: Service[]
  onSelect: (id: string) => void
  selectedServiceId: string | null
}) {
  const categories = Array.from(new Set(services.map((s) => s.category)))
  const [expandedCategory, setExpandedCategory] = useState<string>(categories[0] ?? "")

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-ink">Select a Service</h3>
      <div className="space-y-2">
        {categories.map((cat) => {
          const catServices = services.filter((s) => s.category === cat)
          const isExpanded = expandedCategory === cat

          return (
            <div key={cat}>
              <button
                onClick={() => setExpandedCategory(isExpanded ? "" : cat)}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-ink-soft glass-tile rounded-lg hover:brightness-110 transition-all"
              >
                <span>{cat}</span>
                <ChevronRight
                  className={cn(
                    "w-3 h-3 transition-transform",
                    isExpanded && "rotate-90"
                  )}
                />
              </button>
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    {catServices.map((service) => (
                      <button
                        key={service.id}
                        onClick={() => onSelect(service.id)}
                        className={cn(
                          "w-full flex items-center justify-between px-3 py-2.5 text-left border-b border-white/10 last:border-0 transition-colors",
                          selectedServiceId === service.id
                            ? "bg-mint/10 border-l-2 border-l-mint"
                            : "hover:bg-white/[0.06]"
                        )}
                      >
                        <div>
                          <p className="text-xs font-medium text-ink">
                            {service.name}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-ink-faint flex items-center gap-0.5">
                              <Clock className="w-2.5 h-2.5" />
                              {service.duration}min
                            </span>
                          </div>
                        </div>
                        <span className="text-xs font-semibold text-ink">
                          {formatCurrency(service.price)}
                        </span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Step 2: Staff Selection
function StaffStep({
  staffList,
  onSelect,
  selectedStaffId,
}: {
  staffList: Staff[]
  onSelect: (id: string) => void
  selectedStaffId: string | null
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-ink">Choose Your Stylist</h3>
      <div className="space-y-2">
        {/* Any Available option */}
        <button
          onClick={() => onSelect("any")}
          className={cn(
            "w-full flex items-center gap-3 p-3 rounded-tile transition-all",
            selectedStaffId === "any"
              ? "border border-mint/60 bg-mint/10"
              : "glass-tile hover:brightness-110"
          )}
        >
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-sal-400 to-sal-600 flex items-center justify-center">
            <User className="w-4 h-4 text-white" />
          </div>
          <div className="text-left">
            <p className="text-xs font-semibold text-ink">Any Available</p>
            <p className="text-[10px] text-ink-faint">First available stylist</p>
          </div>
        </button>
        {staffList.map((member) => (
          <button
            key={member.id}
            onClick={() => onSelect(member.id)}
            className={cn(
              "w-full flex items-center gap-3 p-3 rounded-tile transition-all",
              selectedStaffId === member.id
                ? "border border-mint/60 bg-mint/10"
                : "glass-tile hover:brightness-110"
            )}
          >
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold"
              style={{ backgroundColor: member.color }}
            >
              {getInitials(member.name)}
            </div>
            <div className="text-left">
              <p className="text-xs font-semibold text-ink">{member.name}</p>
              <p className="text-[10px] text-ink-faint capitalize">{member.role}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// Step 3: Date & Time
function DateTimeStep({
  selectedDate,
  setSelectedDate,
  selectedTime,
  setSelectedTime,
}: {
  selectedDate: Date
  setSelectedDate: (d: Date) => void
  selectedTime: string | null
  setSelectedTime: (t: string) => void
}) {
  const today = new Date()
  const days: Date[] = []
  for (let i = 0; i < 14; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() + i)
    days.push(d)
  }

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ]

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-ink">Pick Date & Time</h3>

      {/* Mini calendar */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold text-ink-faint uppercase tracking-wider">
          {monthNames[selectedDate.getMonth()]} {selectedDate.getFullYear()}
        </p>
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {days.map((day) => {
            const isSelected =
              day.toDateString() === selectedDate.toDateString()
            const isToday = day.toDateString() === today.toDateString()

            return (
              <button
                key={day.toISOString()}
                onClick={() => setSelectedDate(day)}
                className={cn(
                  "flex flex-col items-center min-w-[40px] py-2 px-1.5 rounded-lg transition-all text-center",
                  isSelected
                    ? "bg-sal-500 text-white shadow-glow-sm"
                    : "glass-tile text-ink-soft hover:brightness-110"
                )}
              >
                <span className="text-[9px] font-medium">
                  {dayNames[day.getDay()]}
                </span>
                <span className="text-sm font-bold">{day.getDate()}</span>
                {isToday && !isSelected && (
                  <div className="w-1 h-1 rounded-full bg-mint mt-0.5" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Time slots */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold text-ink-faint uppercase tracking-wider">
          Available Times
        </p>
        <TimeSlotsGrid
          selectedDate={selectedDate}
          selectedTime={selectedTime}
          onSelectTime={setSelectedTime}
        />
      </div>
    </div>
  )
}

// Step 4: Your Details
function DetailsStep() {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-ink">Your Details</h3>
      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-ink-faint uppercase tracking-wider">
            Full Name
          </label>
          <input
            type="text"
            placeholder="Jane Doe"
            className="w-full px-3 py-2 text-xs border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-mint/60 focus:border-mint/60 bg-white/10 text-ink placeholder:text-ink-faint"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-ink-faint uppercase tracking-wider">
            Email
          </label>
          <input
            type="email"
            placeholder="jane@example.com"
            className="w-full px-3 py-2 text-xs border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-mint/60 focus:border-mint/60 bg-white/10 text-ink placeholder:text-ink-faint"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-ink-faint uppercase tracking-wider">
            Phone
          </label>
          <input
            type="tel"
            placeholder="+1 (555) 000-0000"
            className="w-full px-3 py-2 text-xs border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-mint/60 focus:border-mint/60 bg-white/10 text-ink placeholder:text-ink-faint"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-ink-faint uppercase tracking-wider">
            Notes (optional)
          </label>
          <textarea
            placeholder="Any special requests..."
            rows={2}
            className="w-full px-3 py-2 text-xs border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-mint/60 focus:border-mint/60 bg-white/10 text-ink placeholder:text-ink-faint resize-none"
          />
        </div>
      </div>
    </div>
  )
}

// Step 5: Confirmation
function ConfirmationStep({
  service,
  staff,
  date,
  time,
}: {
  service: Service | null
  staff: Staff | null
  date: Date
  time: string | null
}) {
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ]

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-ink">Confirm Booking</h3>
      <div className="space-y-2 glass-tile p-3 rounded-tile">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-xs font-semibold text-ink">
              {service?.name || "Classic Haircut"}
            </p>
            <p className="text-[10px] text-ink-faint flex items-center gap-1 mt-0.5">
              <Clock className="w-2.5 h-2.5" />
              {service?.duration || 45} minutes
            </p>
          </div>
          <span className="text-xs font-bold text-ink">
            {formatCurrency(service?.price || 45)}
          </span>
        </div>
        <div className="border-t border-white/10 pt-2 space-y-1.5">
          <div className="flex justify-between">
            <span className="text-[10px] text-ink-faint">Stylist</span>
            <span className="text-[10px] font-medium text-ink">
              {staff?.name || "Any Available"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[10px] text-ink-faint">Date</span>
            <span className="text-[10px] font-medium text-ink">
              {dayNames[date.getDay()]}, {monthNames[date.getMonth()]}{" "}
              {date.getDate()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[10px] text-ink-faint">Time</span>
            <span className="text-[10px] font-medium text-ink">
              {time || "10:00 AM"}
            </span>
          </div>
        </div>
        <div className="border-t border-white/10 pt-2 flex justify-between">
          <span className="text-xs font-semibold text-ink">Total</span>
          <span className="text-xs font-bold text-mint">
            {formatCurrency(service?.price || 45)}
          </span>
        </div>
      </div>
      <p className="text-[9px] text-ink-faint text-center">
        By booking, you agree to our cancellation policy. A confirmation will be
        sent to your email.
      </p>
    </div>
  )
}

// Step 6: Success
function SuccessStep() {
  return (
    <div className="flex flex-col items-center justify-center py-6 space-y-3">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
        className="w-16 h-16 rounded-full bg-mint/15 flex items-center justify-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.3 }}
        >
          <CheckCircle2 className="w-10 h-10 text-mint" />
        </motion.div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="text-center space-y-1"
      >
        <h3 className="text-sm font-bold text-ink">Booking Confirmed!</h3>
        <p className="text-[10px] text-ink-soft">
          Your appointment has been scheduled
        </p>
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="glass-tile px-4 py-2 rounded-tile"
      >
        <p className="text-[9px] text-ink-faint text-center">Reference Number</p>
        <p className="text-sm font-mono font-bold text-mint text-center">
          SAL-2026-0847
        </p>
      </motion.div>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
        className="text-[9px] text-ink-faint text-center"
      >
        A confirmation email has been sent to your inbox.
      </motion.p>
    </div>
  )
}

interface BookingPreviewProps {
  services: Service[]
  staff: Staff[]
  businessName?: string
}

export function BookingPreview({ services, staff, businessName }: BookingPreviewProps) {
  const [step, setStep] = useState(1)
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null)
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [selectedTime, setSelectedTime] = useState<string | null>(null)

  const selectedService = services.find((s) => s.id === selectedServiceId) || null
  const selectedStaff =
    selectedStaffId === "any"
      ? null
      : staff.find((s) => s.id === selectedStaffId) || null

  const canProceed = () => {
    switch (step) {
      case 1:
        return !!selectedServiceId
      case 2:
        return !!selectedStaffId
      case 3:
        return !!selectedTime
      case 4:
        return true
      case 5:
        return true
      default:
        return false
    }
  }

  const handleNext = () => {
    if (step < TOTAL_STEPS) setStep(step + 1)
  }

  const handleBack = () => {
    if (step > 1) setStep(step - 1)
  }

  const handleReset = () => {
    setStep(1)
    setSelectedServiceId(null)
    setSelectedStaffId(null)
    setSelectedTime(null)
    setSelectedDate(new Date())
  }

  return (
    <div className="flex justify-center">
      {/* Phone Frame */}
      <div className="relative w-[300px]">
        {/* Phone outer shell */}
        <div className="bg-gray-900 rounded-[40px] p-3 shadow-2xl shadow-black/20">
          {/* Notch */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 w-[120px] h-[28px] bg-gray-900 rounded-b-2xl z-10 flex items-center justify-center">
            <div className="w-16 h-4 bg-gray-800 rounded-full" />
          </div>

          {/* Screen */}
          <div className="env-canvas-lite rounded-[28px] overflow-hidden">
            {/* Status bar */}
            <div>
              <PhoneStatusBar />
            </div>

            {/* Business header */}
            <div className="px-4 pb-3 pt-1">
              <div className="flex items-center justify-between">
                {step > 1 && step < 6 && (
                  <button
                    onClick={handleBack}
                    className="text-white/80 hover:text-white"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                )}
                <div className={cn("text-center", step === 1 || step === 6 ? "flex-1" : "flex-1")}>
                  <h2 className="text-ink text-xs font-bold tracking-wide">
                    {businessName ? businessName.toUpperCase() : "YOUR SALON"}
                  </h2>
                  <p className="text-ink-soft text-[9px]">Book your appointment</p>
                </div>
                {step > 1 && step < 6 && <div className="w-4" />}
              </div>
            </div>

            {/* Step indicators */}
            <div className="py-2 border-b border-white/10">
              <StepDots current={step} total={TOTAL_STEPS} />
            </div>

            {/* Content */}
            <div className="h-[420px] overflow-y-auto">
              <div className="p-4">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    {step === 1 && (
                      <ServiceStep
                        services={services}
                        onSelect={setSelectedServiceId}
                        selectedServiceId={selectedServiceId}
                      />
                    )}
                    {step === 2 && (
                      <StaffStep
                        staffList={staff}
                        onSelect={setSelectedStaffId}
                        selectedStaffId={selectedStaffId}
                      />
                    )}
                    {step === 3 && (
                      <DateTimeStep
                        selectedDate={selectedDate}
                        setSelectedDate={setSelectedDate}
                        selectedTime={selectedTime}
                        setSelectedTime={setSelectedTime}
                      />
                    )}
                    {step === 4 && <DetailsStep />}
                    {step === 5 && (
                      <ConfirmationStep
                        service={selectedService}
                        staff={selectedStaff}
                        date={selectedDate}
                        time={selectedTime}
                      />
                    )}
                    {step === 6 && <SuccessStep />}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            {/* Bottom action — mirrors the live page's frosted sticky bar */}
            <div className="p-4 border-t border-white/15 bg-[rgba(10,42,30,0.88)]">
              {step < 6 ? (
                <button
                  onClick={step === 5 ? handleNext : handleNext}
                  disabled={!canProceed()}
                  className={cn(
                    "w-full py-2.5 rounded-xl text-xs font-bold transition-all",
                    canProceed()
                      ? "bg-sal-500 text-white hover:bg-sal-600 shadow-glow-sm"
                      : "bg-white/10 text-ink-faint cursor-not-allowed"
                  )}
                >
                  {step === 5 ? "Book Now" : "Continue"}
                </button>
              ) : (
                <button
                  onClick={handleReset}
                  className="w-full py-2.5 rounded-xl text-xs font-bold glass-tile text-mint hover:brightness-110 transition-all"
                >
                  Book Another Appointment
                </button>
              )}
            </div>

            {/* Home indicator */}
            <div className="flex justify-center pb-2 bg-[rgba(10,42,30,0.88)]">
              <div className="w-28 h-1 rounded-full bg-white/25" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
