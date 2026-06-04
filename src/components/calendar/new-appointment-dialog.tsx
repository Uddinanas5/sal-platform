"use client"

import React, { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { format, setHours, setMinutes, isSameDay } from "date-fns"
import { createAppointment } from "@/lib/actions/appointments"
import { createRecurringAppointment } from "@/lib/actions/recurring"
import {
  Search,
  ChevronRight,
  ChevronLeft,
  Check,
  Clock,
  CalendarDays,
  CircleDot,
  Repeat,
  Users,
  ChevronDown,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DatePicker } from "@/components/ui/date-picker"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn, getInitials, formatCurrency, formatDuration } from "@/lib/utils"
import { toast } from "sonner"
import type { Appointment, Client, Service, Staff } from "@/data/mock-data"

interface NewAppointmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  clients: Client[]
  services: Service[]
  staff: Staff[]
  appointments?: Appointment[]
  initialDate?: Date
  initialStaffId?: string
  initialHour?: number
  initialMinute?: number
}

type Step = 1 | 2 | 3 | 4 | 5

const STEP_LABELS: Record<Step, string> = {
  1: "Select Client",
  2: "Select Service",
  3: "Select Staff",
  4: "Date & Time",
  5: "Confirm",
}

// Time slots from 8 AM to 8 PM at 15-minute intervals
function generateTimeSlots(): { hour: number; minute: number; label: string }[] {
  const slots: { hour: number; minute: number; label: string }[] = []
  for (let h = 8; h < 20; h++) {
    for (let m = 0; m < 60; m += 15) {
      const ampm = h >= 12 ? "PM" : "AM"
      const displayH = h % 12 === 0 ? 12 : h % 12
      const label = `${displayH}:${m.toString().padStart(2, "0")} ${ampm}`
      slots.push({ hour: h, minute: m, label })
    }
  }
  return slots
}

const TIME_SLOTS = generateTimeSlots()

export function NewAppointmentDialog({
  open,
  onOpenChange,
  clients,
  services,
  staff,
  appointments = [],
  initialDate,
  initialStaffId,
  initialHour,
  initialMinute,
}: NewAppointmentDialogProps) {
  const [step, setStep] = useState<Step>(1)
  const [clientSearch, setClientSearch] = useState("")
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  // Multi-service: a cut + beard trim + line-up is ONE appointment. Services are
  // kept in pick order so they chain back-to-back the way the barber adds them.
  const [selectedServices, setSelectedServices] = useState<Service[]>([])
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    initialDate || new Date()
  )
  const [selectedTime, setSelectedTime] = useState<{
    hour: number
    minute: number
  } | null>(
    initialHour != null
      ? { hour: initialHour, minute: initialMinute || 0 }
      : null
  )
  const [notes, setNotes] = useState("")
  const [activeCategory, setActiveCategory] = useState<string>("All")

  // Recurring appointment state
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurrenceRule, setRecurrenceRule] = useState<"weekly" | "biweekly" | "monthly">("weekly")
  const [recurrenceEndDate, setRecurrenceEndDate] = useState("")

  // Group booking is disabled in this dialog (no multi-participant picker yet —
  // see the "Coming soon" toggle below), so no group state is tracked here.
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const router = useRouter()

  // Reset state when dialog opens
  React.useEffect(() => {
    if (open) {
      setStep(1)
      setClientSearch("")
      setSelectedClient(null)
      setSelectedServices([])
      setSelectedStaff(null)
      setSelectedDate(initialDate || new Date())
      setSelectedTime(
        initialHour != null
          ? { hour: initialHour, minute: initialMinute || 0 }
          : null
      )
      setNotes("")
      setActiveCategory("All")
      setIsRecurring(false)
      setRecurrenceRule("weekly")
      setRecurrenceEndDate("")
      setShowAdvanced(false)
      setIsSaving(false)

      // Pre-select staff if provided
      if (initialStaffId) {
        const preselectedStaff = staff.find((s) => s.id === initialStaffId)
        if (preselectedStaff) {
          setSelectedStaff(preselectedStaff)
        }
      }
    }
  }, [open, initialDate, initialStaffId, initialHour, initialMinute, staff])

  // Filtered clients
  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return clients
    const search = clientSearch.toLowerCase()
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(search) ||
        c.email.toLowerCase().includes(search) ||
        c.phone.includes(search)
    )
  }, [clients, clientSearch])

  // Service categories
  const categories = useMemo(() => {
    const cats = Array.from(new Set(services.map((s) => s.category)))
    return ["All", ...cats]
  }, [services])

  // Filtered services by category
  const filteredServices = useMemo(() => {
    if (activeCategory === "All") return services.filter((s) => s.isActive)
    return services.filter((s) => s.isActive && s.category === activeCategory)
  }, [services, activeCategory])

  // Combined totals across all selected services (live in the UI; the server
  // still recomputes authoritatively from the DB on submit).
  const combinedDuration = useMemo(
    () => selectedServices.reduce((sum, s) => sum + s.duration, 0),
    [selectedServices]
  )
  const combinedPrice = useMemo(
    () => selectedServices.reduce((sum, s) => sum + s.price, 0),
    [selectedServices]
  )

  // Staff must be qualified for EVERY selected service (one staff performs the
  // whole combo in this dialog). With nothing selected, show all active staff.
  const qualifiedStaff = useMemo(() => {
    if (selectedServices.length === 0) return staff.filter((s) => s.isActive)
    return staff.filter(
      (s) =>
        s.isActive && selectedServices.every((svc) => s.services.includes(svc.id))
    )
  }, [staff, selectedServices])

  function toggleService(service: Service) {
    setSelectedServices((prev) => {
      const exists = prev.some((s) => s.id === service.id)
      if (exists) return prev.filter((s) => s.id !== service.id)
      return [...prev, service]
    })
    // A new service set can invalidate the previously chosen staff (they may not
    // be qualified for the added service). Clear it so step 3 re-validates.
    setSelectedStaff(null)
  }

  // Staff availability for selected date
  const staffAvailability = useMemo(() => {
    if (!selectedDate) return new Map<string, { count: number; isWorking: boolean; hours: string }>()
    const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
    const dayName = dayNames[selectedDate.getDay()]
    const result = new Map<string, { count: number; isWorking: boolean; hours: string }>()

    for (const s of staff) {
      const dayAppts = appointments.filter(
        (a) => a.staffId === s.id && isSameDay(new Date(a.startTime), selectedDate) && a.status !== "cancelled"
      )
      const schedule = s.workingHours?.[dayName]
      const isWorking = schedule !== null && schedule !== undefined
      const hours = isWorking && schedule ? `${schedule.start} - ${schedule.end}` : "Day off"
      result.set(s.id, { count: dayAppts.length, isWorking, hours })
    }
    return result
  }, [staff, appointments, selectedDate])

  function handleNext() {
    if (step < 5) setStep((step + 1) as Step)
  }

  function handleBack() {
    if (step > 1) setStep((step - 1) as Step)
  }

  async function handleSave() {
    if (
      !selectedClient ||
      selectedServices.length === 0 ||
      !selectedStaff ||
      !selectedDate ||
      !selectedTime
    ) {
      toast.error("Please complete all required fields")
      return
    }

    const startTime = setMinutes(
      setHours(selectedDate, selectedTime.hour),
      selectedTime.minute
    )

    // Recurring requires an end date before we can generate the series.
    if (isRecurring && !recurrenceEndDate) {
      toast.error("Pick an end date for the recurring appointment")
      return
    }

    setIsSaving(true)

    const serviceSummary =
      selectedServices.length > 1
        ? `${selectedServices[0].name} +${selectedServices.length - 1} more`
        : selectedServices[0].name
    const baseDescription = `${serviceSummary} with ${selectedStaff.name} on ${format(
      startTime,
      "MMM d 'at' h:mm a"
    )}`

    // Branch: when "Repeat" is on, create the whole series via the recurring
    // backend (single create otherwise). Recurring still books ONE service per
    // occurrence (the recurring backend is single-service); we pass the lead
    // service so the series is unambiguous rather than silently dropping add-ons.
    if (isRecurring) {
      const result = await createRecurringAppointment({
        clientId: selectedClient.id,
        serviceId: selectedServices[0].id,
        staffId: selectedStaff.id,
        startTime: startTime.toISOString(),
        notes: notes.trim() || undefined,
        recurrenceRule,
        recurrenceEndDate,
      })

      if (!result.success) {
        setIsSaving(false)
        toast.error(result.error)
        return
      }

      toast.success(
        `Recurring series created (${result.data.count} appointment${result.data.count === 1 ? "" : "s"})`,
        { description: baseDescription }
      )
      onOpenChange(false)
      router.refresh()
      return
    }

    // Multi-service: send the full ordered list. The server recomputes duration
    // and price from the DB and writes one AppointmentService row per service.
    const result = await createAppointment({
      clientId: selectedClient.id,
      serviceIds: selectedServices.map((s) => s.id),
      staffId: selectedStaff.id,
      startTime: startTime.toISOString(),
      notes: notes.trim() || undefined,
    })

    if (!result.success) {
      setIsSaving(false)
      toast.error(result.error)
      return
    }

    toast.success("Appointment created", { description: baseDescription })
    onOpenChange(false)
    router.refresh()
  }

  const canProceed = (): boolean => {
    switch (step) {
      case 1:
        return selectedClient !== null
      case 2:
        return selectedServices.length > 0
      case 3:
        return selectedStaff !== null
      case 4:
        return selectedDate !== undefined && selectedTime !== null
      case 5:
        return true
      default:
        return false
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] max-h-[85vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <DialogHeader>
            <DialogTitle className="text-lg font-heading">
              New Appointment
            </DialogTitle>
            <DialogDescription>
              {STEP_LABELS[step]} (Step {step} of 5)
            </DialogDescription>
          </DialogHeader>

          {/* Step indicators */}
          <div className="flex items-center gap-1 mt-4">
            {([1, 2, 3, 4, 5] as Step[]).map((s) => (
              <div
                key={s}
                className={cn(
                  "flex-1 h-1.5 rounded-full transition-all",
                  s <= step ? "bg-sal-500" : "bg-cream-200"
                )}
              />
            ))}
          </div>
        </div>

        <Separator />

        {/* Step content */}
        <div className="flex-1 overflow-hidden px-6 py-4">
          {/* Step 1: Select Client */}
          {step === 1 && (
            <div className="flex flex-col gap-3 h-full">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
                <Input
                  placeholder="Search clients by name, email, or phone..."
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <ScrollArea className="flex-1 max-h-[340px]">
                <div className="space-y-1">
                  {filteredClients.map((client) => (
                    <button
                      key={client.id}
                      onClick={() => setSelectedClient(client)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sal-500",
                        selectedClient?.id === client.id
                          ? "bg-sal-50 ring-1 ring-sal-300"
                          : "hover:bg-cream-100"
                      )}
                    >
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={client.avatar} />
                        <AvatarFallback className="text-xs">
                          {getInitials(client.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {client.name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {client.email}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-muted-foreground/70">
                          {client.totalVisits} visits
                        </p>
                        {client.tags && client.tags.length > 0 && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] mt-0.5"
                          >
                            {client.tags[0]}
                          </Badge>
                        )}
                      </div>
                      {selectedClient?.id === client.id && (
                        <Check className="h-4 w-4 text-sal-500 shrink-0" />
                      )}
                    </button>
                  ))}
                  {filteredClients.length === 0 && (
                    <p className="text-center text-sm text-muted-foreground/70 py-8">
                      No clients found
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Step 2: Select Service */}
          {step === 2 && (
            <div className="flex flex-col gap-3 h-full">
              {/* Category tabs */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
                {categories.map((cat) => (
                  <Button
                    key={cat}
                    variant={activeCategory === cat ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActiveCategory(cat)}
                    className="h-7 text-xs shrink-0"
                  >
                    {cat}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Pick one or more services — they&apos;ll run back-to-back as one
                appointment.
              </p>
              <ScrollArea className="flex-1 max-h-[280px]">
                <div className="space-y-1">
                  {filteredServices.map((service) => {
                    const isSelected = selectedServices.some((s) => s.id === service.id)
                    const order = selectedServices.findIndex((s) => s.id === service.id)
                    return (
                      <button
                        key={service.id}
                        onClick={() => toggleService(service)}
                        aria-pressed={isSelected}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sal-500",
                          isSelected
                            ? "bg-sal-50 ring-1 ring-sal-300"
                            : "hover:bg-cream-100"
                        )}
                      >
                        <div
                          className="w-2 h-8 rounded-full shrink-0"
                          style={{ backgroundColor: service.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">
                            {service.name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {service.description}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold text-foreground">
                            {formatCurrency(service.price)}
                          </p>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground/70 justify-end">
                            <Clock className="h-3 w-3" />
                            {formatDuration(service.duration)}
                          </div>
                        </div>
                        {/* Square checkbox-style indicator with pick-order number */}
                        <div
                          className={cn(
                            "flex items-center justify-center h-5 w-5 rounded-md border shrink-0 text-[10px] font-semibold",
                            isSelected
                              ? "bg-sal-500 border-sal-500 text-white"
                              : "border-cream-300 text-transparent"
                          )}
                        >
                          {isSelected ? order + 1 : ""}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </ScrollArea>

              {/* Live combined total bar — sums every selected service. */}
              {selectedServices.length > 0 && (
                <div className="rounded-lg bg-sal-50 dark:bg-sal-500/10 ring-1 ring-sal-200 dark:ring-sal-500/20 px-3 py-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-foreground">
                      {selectedServices.length} service
                      {selectedServices.length === 1 ? "" : "s"} selected
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatDuration(combinedDuration)}
                      </span>
                      <span className="text-sm font-bold text-sal-600">
                        {formatCurrency(combinedPrice)}
                      </span>
                    </div>
                  </div>
                  {selectedServices.length > 1 && (
                    <p className="mt-1 text-[11px] text-muted-foreground truncate">
                      {selectedServices.map((s) => s.name).join(" → ")}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Select Staff */}
          {step === 3 && (
            <div className="flex flex-col gap-3 h-full">
              <p className="text-xs text-muted-foreground">
                {selectedServices.length > 0
                  ? `Showing staff qualified for ${
                      selectedServices.length === 1
                        ? selectedServices[0].name
                        : `all ${selectedServices.length} selected services`
                    }`
                  : "Select a staff member"}
                {selectedDate && (
                  <span className="ml-1 text-muted-foreground/70">
                    — {format(selectedDate, "EEE, MMM d")}
                  </span>
                )}
              </p>
              <ScrollArea className="flex-1 max-h-[340px]">
                <div className="space-y-1">
                  {qualifiedStaff.map((s) => {
                    const availability = staffAvailability.get(s.id)
                    const isWorking = availability?.isWorking ?? true
                    const apptCount = availability?.count ?? 0
                    const hours = availability?.hours ?? ""
                    return (
                      <button
                        key={s.id}
                        onClick={() => setSelectedStaff(s)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sal-500",
                          selectedStaff?.id === s.id
                            ? "bg-sal-50 ring-1 ring-sal-300"
                            : "hover:bg-cream-100",
                          !isWorking && "opacity-50"
                        )}
                      >
                        <div className="relative">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={s.avatar} />
                            <AvatarFallback
                              className="text-xs font-semibold text-white"
                              style={{ backgroundColor: s.color }}
                            >
                              {getInitials(s.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span
                            className={cn(
                              "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white",
                              isWorking ? "bg-emerald-500" : "bg-cream-300"
                            )}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">
                            {s.name}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-muted-foreground capitalize">
                              {s.role}
                            </span>
                            {isWorking && hours && (
                              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/70">
                                <Clock className="h-2.5 w-2.5" />
                                {hours}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {isWorking ? (
                            <span className={cn(
                              "flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                              apptCount === 0
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                                : apptCount >= 5
                                  ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                                  : "bg-cream-100 dark:bg-muted text-muted-foreground"
                            )}>
                              <CalendarDays className="h-2.5 w-2.5" />
                              {apptCount === 0 ? "Free" : `${apptCount} appts`}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground/70 bg-cream-100 px-1.5 py-0.5 rounded-full">
                              <CircleDot className="h-2.5 w-2.5" />
                              Day off
                            </span>
                          )}
                          {selectedStaff?.id === s.id && (
                            <Check className="h-4 w-4 text-sal-500" />
                          )}
                        </div>
                      </button>
                    )
                  })}
                  {qualifiedStaff.length === 0 && (
                    <p className="text-center text-sm text-muted-foreground/70 py-8">
                      No qualified staff available
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Step 4: Date & Time */}
          {step === 4 && (
            <div className="flex flex-col gap-4 h-full">
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">
                  Date
                </label>
                <DatePicker
                  date={selectedDate}
                  onSelect={setSelectedDate}
                  placeholder="Select appointment date"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">
                  Time
                </label>
                <ScrollArea className="max-h-[240px]">
                  <div className="grid grid-cols-4 gap-1.5">
                    {TIME_SLOTS.map((slot) => (
                      <button
                        key={`${slot.hour}-${slot.minute}`}
                        onClick={() =>
                          setSelectedTime({
                            hour: slot.hour,
                            minute: slot.minute,
                          })
                        }
                        className={cn(
                          "px-2 py-2 rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sal-500",
                          selectedTime?.hour === slot.hour &&
                            selectedTime?.minute === slot.minute
                            ? "bg-sal-500 text-white"
                            : "bg-cream-100 text-foreground hover:bg-cream-200"
                        )}
                      >
                        {slot.label}
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
          )}

          {/* Step 5: Confirm */}
          {step === 5 && (
            <div className="flex flex-col gap-4 h-full">
              <div className="bg-cream-50 rounded-xl p-4 space-y-3">
                <h4 className="text-sm font-semibold text-foreground">
                  Appointment Summary
                </h4>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Client</span>
                    <span className="text-sm font-medium text-foreground">
                      {selectedClient?.name}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-xs text-muted-foreground pt-0.5">
                      {selectedServices.length > 1 ? "Services" : "Service"}
                    </span>
                    <div className="flex-1 text-right space-y-1">
                      {selectedServices.map((svc, i) => (
                        <div
                          key={svc.id}
                          className="flex items-center justify-end gap-2"
                        >
                          {selectedServices.length > 1 && (
                            <span className="text-[10px] text-muted-foreground/70">
                              {i + 1}.
                            </span>
                          )}
                          <span className="text-sm font-medium text-foreground">
                            {svc.name}
                          </span>
                          <span className="text-xs text-muted-foreground/70 w-16">
                            {formatDuration(svc.duration)}
                          </span>
                          <span className="text-xs text-muted-foreground w-14">
                            {formatCurrency(svc.price)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Staff</span>
                    <span className="text-sm font-medium text-foreground">
                      {selectedStaff?.name}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Date</span>
                    <span className="text-sm font-medium text-foreground">
                      {selectedDate ? format(selectedDate, "EEE, MMM d, yyyy") : ""}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Time</span>
                    <span className="text-sm font-medium text-foreground">
                      {selectedTime
                        ? TIME_SLOTS.find(
                            (s) =>
                              s.hour === selectedTime.hour &&
                              s.minute === selectedTime.minute
                          )?.label || ""
                        : ""}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {selectedServices.length > 1 ? "Total Duration" : "Duration"}
                    </span>
                    <span className="text-sm font-medium text-foreground">
                      {selectedServices.length > 0
                        ? formatDuration(combinedDuration)
                        : ""}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {selectedServices.length > 1 ? "Total Price" : "Price"}
                    </span>
                    <span className="text-sm font-bold text-sal-600">
                      {selectedServices.length > 0
                        ? formatCurrency(combinedPrice)
                        : ""}
                    </span>
                  </div>
                </div>
              </div>
              {/* Advanced Options: Recurring & Group */}
              <div className="border border-cream-200 dark:border-muted rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-foreground hover:bg-cream-50 dark:hover:bg-muted/50 transition-colors"
                >
                  <span>Advanced Options</span>
                  <ChevronDown className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform",
                    showAdvanced && "rotate-180"
                  )} />
                </button>
                {showAdvanced && (
                  <div className="px-4 pb-4 space-y-4 border-t border-cream-200 dark:border-muted pt-3">
                    {/* Recurring Appointment */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Repeat className="h-4 w-4 text-sal-500" />
                          <span className="text-sm font-medium text-foreground">Recurring</span>
                        </div>
                        <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
                      </div>
                      {isRecurring && (
                        <div className="ml-6 space-y-2">
                          <Select value={recurrenceRule} onValueChange={(v) => setRecurrenceRule(v as "weekly" | "biweekly" | "monthly")}>
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="weekly">Every week</SelectItem>
                              <SelectItem value="biweekly">Every 2 weeks</SelectItem>
                              <SelectItem value="monthly">Every month</SelectItem>
                            </SelectContent>
                          </Select>
                          <div className="space-y-1">
                            <label className="text-xs text-muted-foreground">End date</label>
                            <Input
                              type="date"
                              value={recurrenceEndDate}
                              onChange={(e) => setRecurrenceEndDate(e.target.value)}
                              className="h-9"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* Group Booking — the backend (createGroupBooking) needs a
                        list of participant clients, but this dialog only selects
                        ONE client. Until a multi-participant picker exists, the
                        toggle is disabled rather than silently booking a "group
                        of one". No fake feature. */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between opacity-60">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium text-foreground">
                            Group Booking{" "}
                            <span className="text-xs font-normal text-muted-foreground">(Coming soon)</span>
                          </span>
                        </div>
                        <Switch checked={false} disabled aria-label="Group booking (coming soon)" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">
                  Notes (optional)
                </label>
                <Textarea
                  placeholder="Add any notes for this appointment..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  maxLength={500}
                  showCounter
                />
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Footer navigation */}
        <div className="flex items-center justify-between px-6 py-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            disabled={step === 1}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>

          {step < 5 ? (
            <Button
              size="sm"
              onClick={handleNext}
              disabled={!canProceed()}
              className="gap-1"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button size="sm" onClick={handleSave} disabled={isSaving} className="gap-1">
              <Check className="h-4 w-4" />
              {isSaving ? "Creating…" : "Create Appointment"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
