"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  Building2,
  Clock,
  Scissors,
  PartyPopper,
  ArrowRight,
  ArrowLeft,
  Plus,
  Trash2,
  Copy,
  Check,
  Sparkles,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import {
  updateBusinessDetails,
  saveWorkingHours,
  addOnboardingServices,
  completeOnboarding,
} from "@/lib/actions/onboarding"
import { formatCurrency } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OnboardingClientProps {
  business: {
    id: string
    name: string
    slug: string
    phone: string
    timezone: string
  }
  location: {
    id: string
    addressLine1: string
    city: string
    state: string
    postalCode: string
    country: string
  } | null
}

type OnboardingStep = 1 | 2 | 3 | 4

interface ServiceEntry {
  id: string
  name: string
  durationMinutes: number
  price: number
}

interface WorkingDay {
  dayOfWeek: number
  label: string
  isWorking: boolean
  openTime: string
  closeTime: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STEPS = [
  { label: "Business Details", icon: Building2 },
  { label: "Working Hours", icon: Clock },
  { label: "Services", icon: Scissors },
  { label: "All Set!", icon: PartyPopper },
] as const

const US_TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HT)" },
  { value: "America/Phoenix", label: "Arizona (no DST)" },
]

const COUNTRIES = [
  { value: "US", label: "United States" },
  { value: "CA", label: "Canada" },
  { value: "GB", label: "United Kingdom" },
  { value: "AU", label: "Australia" },
  { value: "NZ", label: "New Zealand" },
  { value: "IE", label: "Ireland" },
]

const DURATION_OPTIONS = [
  { value: 15, label: "15 min" },
  { value: 30, label: "30 min" },
  { value: 45, label: "45 min" },
  { value: 60, label: "1 hour" },
  { value: 90, label: "1h 30min" },
  { value: 120, label: "2 hours" },
]

const TIME_OPTIONS = (() => {
  const options: { value: string; label: string }[] = []
  for (let h = 5; h <= 23; h++) {
    for (const m of [0, 30]) {
      const v = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`
      const hour12 = h % 12 || 12
      const ampm = h < 12 ? "AM" : "PM"
      const mStr = m.toString().padStart(2, "0")
      options.push({ value: v, label: `${hour12}:${mStr} ${ampm}` })
    }
  }
  return options
})()

const TEMPLATE_SERVICES: ServiceEntry[] = [
  { id: "t1", name: "Women's Haircut", durationMinutes: 45, price: 55 },
  { id: "t2", name: "Men's Haircut", durationMinutes: 30, price: 35 },
  { id: "t3", name: "Color Treatment", durationMinutes: 120, price: 120 },
  { id: "t4", name: "Blowout", durationMinutes: 30, price: 40 },
  { id: "t5", name: "Manicure", durationMinutes: 30, price: 35 },
  { id: "t6", name: "Facial", durationMinutes: 60, price: 75 },
]

const DEFAULT_HOURS: WorkingDay[] = [
  { dayOfWeek: 1, label: "Monday", isWorking: true, openTime: "09:00", closeTime: "17:00" },
  { dayOfWeek: 2, label: "Tuesday", isWorking: true, openTime: "09:00", closeTime: "17:00" },
  { dayOfWeek: 3, label: "Wednesday", isWorking: true, openTime: "09:00", closeTime: "17:00" },
  { dayOfWeek: 4, label: "Thursday", isWorking: true, openTime: "09:00", closeTime: "17:00" },
  { dayOfWeek: 5, label: "Friday", isWorking: true, openTime: "09:00", closeTime: "17:00" },
  { dayOfWeek: 6, label: "Saturday", isWorking: true, openTime: "09:00", closeTime: "17:00" },
  { dayOfWeek: 0, label: "Sunday", isWorking: false, openTime: "09:00", closeTime: "17:00" },
]

// ---------------------------------------------------------------------------
// Confetti animation component
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

function StepIndicator({ currentStep }: { currentStep: OnboardingStep }) {
  return (
    <div className="w-full">
      {/* Mobile: compact bar */}
      <div className="sm:hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-foreground">
            Step {currentStep} of 4
          </span>
          <span className="text-sm text-muted-foreground">
            {STEPS[currentStep - 1].label}
          </span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-sal-500 rounded-full"
            initial={false}
            animate={{ width: `${(currentStep / 4) * 100}%` }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
          />
        </div>
      </div>

      {/* Desktop: step pills */}
      <div className="hidden sm:flex items-center justify-center gap-1">
        {STEPS.map((s, i) => {
          const stepNum = (i + 1) as OnboardingStep
          const Icon = s.icon
          const isActive = stepNum === currentStep
          const isCompleted = stepNum < currentStep

          return (
            <div key={stepNum} className="flex items-center">
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-300 ${
                  isActive
                    ? "bg-sal-500 text-white shadow-md shadow-sal-500/20"
                    : isCompleted
                    ? "bg-sal-500/10 text-sal-700 dark:text-sal-300"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {isCompleted ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Icon className="w-3.5 h-3.5" />
                )}
                <span className="hidden md:inline">{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`w-6 h-0.5 mx-1 rounded transition-colors duration-300 ${
                    isCompleted ? "bg-sal-500" : "bg-muted"
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
// Main Onboarding Client
// ---------------------------------------------------------------------------

export function OnboardingClient({ business, location }: OnboardingClientProps) {
  const router = useRouter()
  const [step, setStep] = useState<OnboardingStep>(1)
  const [direction, setDirection] = useState(1)
  const [saving, setSaving] = useState(false)

  // Step 1 state
  const [businessName, setBusinessName] = useState(business.name)
  const [phone, setPhone] = useState(business.phone)
  const [addressLine1, setAddressLine1] = useState(location?.addressLine1 ?? "")
  const [city, setCity] = useState(location?.city ?? "")
  const [state, setState] = useState(location?.state ?? "")
  const [postalCode, setPostalCode] = useState(location?.postalCode ?? "")
  const [country, setCountry] = useState(location?.country ?? "US")
  const [timezone, setTimezone] = useState(
    business.timezone === "UTC" ? "America/New_York" : business.timezone
  )

  // Step 2 state
  const [workingHours, setWorkingHours] = useState<WorkingDay[]>(DEFAULT_HOURS)

  // Step 3 state
  const [services, setServices] = useState<ServiceEntry[]>([])
  const [newServiceName, setNewServiceName] = useState("")
  const [newServiceDuration, setNewServiceDuration] = useState(30)
  const [newServicePrice, setNewServicePrice] = useState("")

  // Step 4 state
  const [copied, setCopied] = useState(false)

  // ---------------------------------------------------------------------------
  // Step navigation
  // ---------------------------------------------------------------------------

  const goNext = useCallback(async () => {
    setSaving(true)

    try {
      if (step === 1) {
        // Validate
        if (!businessName.trim()) {
          toast.error("Business name is required")
          setSaving(false)
          return
        }
        if (!phone.trim()) {
          toast.error("Phone number is required")
          setSaving(false)
          return
        }
        if (!addressLine1.trim() || !city.trim()) {
          toast.error("Address and city are required")
          setSaving(false)
          return
        }

        const result = await updateBusinessDetails({
          businessId: business.id,
          name: businessName.trim(),
          phone: phone.trim(),
          timezone,
          addressLine1: addressLine1.trim(),
          city: city.trim(),
          state: state.trim(),
          postalCode: postalCode.trim(),
          country,
        })

        if (!result.success) {
          toast.error(result.error)
          setSaving(false)
          return
        }
      }

      if (step === 2) {
        const result = await saveWorkingHours({
          businessId: business.id,
          hours: workingHours.map((h) => ({
            dayOfWeek: h.dayOfWeek,
            isClosed: !h.isWorking,
            openTime: h.openTime,
            closeTime: h.closeTime,
          })),
        })

        if (!result.success) {
          toast.error(result.error)
          setSaving(false)
          return
        }
      }

      if (step === 3) {
        if (services.length === 0) {
          toast.error("Please add at least one service")
          setSaving(false)
          return
        }

        const result = await addOnboardingServices({
          businessId: business.id,
          services: services.map((s) => ({
            name: s.name,
            durationMinutes: s.durationMinutes,
            price: s.price,
          })),
        })

        if (!result.success) {
          toast.error(result.error)
          setSaving(false)
          return
        }

        // Also mark onboarding complete
        const completeResult = await completeOnboarding({
          businessId: business.id,
        })

        if (!completeResult.success) {
          toast.error(completeResult.error)
          setSaving(false)
          return
        }
      }

      if (step < 4) {
        setDirection(1)
        setStep((s) => (s + 1) as OnboardingStep)
      }
    } catch {
      toast.error("Something went wrong. Please try again.")
    } finally {
      setSaving(false)
    }
  }, [
    step,
    business.id,
    businessName,
    phone,
    addressLine1,
    city,
    state,
    postalCode,
    country,
    timezone,
    workingHours,
    services,
  ])

  const goBack = useCallback(() => {
    if (step > 1) {
      setDirection(-1)
      setStep((s) => (s - 1) as OnboardingStep)
    }
  }, [step])

  // ---------------------------------------------------------------------------
  // Service helpers
  // ---------------------------------------------------------------------------

  const addService = useCallback(() => {
    if (!newServiceName.trim()) {
      toast.error("Service name is required")
      return
    }
    const price = parseFloat(newServicePrice)
    if (isNaN(price) || price < 0) {
      toast.error("Please enter a valid price")
      return
    }

    const entry: ServiceEntry = {
      id: `custom-${Date.now()}`,
      name: newServiceName.trim(),
      durationMinutes: newServiceDuration,
      price,
    }
    setServices((prev) => [...prev, entry])
    setNewServiceName("")
    setNewServicePrice("")
    setNewServiceDuration(30)
  }, [newServiceName, newServiceDuration, newServicePrice])

  const removeService = useCallback((id: string) => {
    setServices((prev) => prev.filter((s) => s.id !== id))
  }, [])

  const useTemplate = useCallback(() => {
    setServices(TEMPLATE_SERVICES)
    toast.success("Template services added")
  }, [])

  // ---------------------------------------------------------------------------
  // Copy booking link
  // ---------------------------------------------------------------------------

  const copyBookingLink = useCallback(() => {
    const link = `${window.location.origin}/book/${business.slug}`
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true)
      toast.success("Booking link copied!")
      setTimeout(() => setCopied(false), 2000)
    })
  }, [business.slug])

  // ---------------------------------------------------------------------------
  // Working hours helpers
  // ---------------------------------------------------------------------------

  const updateWorkingDay = useCallback(
    (dayOfWeek: number, field: keyof WorkingDay, value: string | boolean) => {
      setWorkingHours((prev) =>
        prev.map((d) => (d.dayOfWeek === dayOfWeek ? { ...d, [field]: value } : d))
      )
    },
    []
  )

  // ---------------------------------------------------------------------------
  // Format duration label
  // ---------------------------------------------------------------------------

  function formatDurationLabel(minutes: number): string {
    if (minutes < 60) return `${minutes} min`
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return m > 0 ? `${h}h ${m}min` : `${h}h`
  }

  // ---------------------------------------------------------------------------
  // Animation variants
  // ---------------------------------------------------------------------------

  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-cream dark:bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-cream/80 dark:bg-background/80 backdrop-blur-lg border-b border-cream-200 dark:border-border">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-sal-500 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-lg font-semibold font-heading text-foreground">
              Set up your salon
            </h1>
          </div>
          {step < 4 && <StepIndicator currentStep={step} />}
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-2xl mx-auto px-4 py-8 pb-32">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25, ease: "easeInOut" }}
          >
            {/* ============ Step 1: Business Details ============ */}
            {step === 1 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-heading font-bold text-foreground">
                    Tell us about your business
                  </h2>
                  <p className="text-muted-foreground mt-1">
                    This information will appear on your booking page.
                  </p>
                </div>

                <Card>
                  <CardContent className="p-6 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="businessName">Business name</Label>
                      <Input
                        id="businessName"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        placeholder="Your salon name"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone number</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="(555) 123-4567"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="address">Street address</Label>
                      <Input
                        id="address"
                        value={addressLine1}
                        onChange={(e) => setAddressLine1(e.target.value)}
                        placeholder="123 Main Street"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="city">City</Label>
                        <Input
                          id="city"
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          placeholder="New York"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="state">State</Label>
                        <Input
                          id="state"
                          value={state}
                          onChange={(e) => setState(e.target.value)}
                          placeholder="NY"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="postalCode">Zip code</Label>
                        <Input
                          id="postalCode"
                          value={postalCode}
                          onChange={(e) => setPostalCode(e.target.value)}
                          placeholder="10001"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="country">Country</Label>
                        <Select value={country} onValueChange={setCountry}>
                          <SelectTrigger id="country">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {COUNTRIES.map((c) => (
                              <SelectItem key={c.value} value={c.value}>
                                {c.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="timezone">Timezone</Label>
                      <Select value={timezone} onValueChange={setTimezone}>
                        <SelectTrigger id="timezone">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {US_TIMEZONES.map((tz) => (
                            <SelectItem key={tz.value} value={tz.value}>
                              {tz.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ============ Step 2: Working Hours ============ */}
            {step === 2 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-heading font-bold text-foreground">
                    Set your working hours
                  </h2>
                  <p className="text-muted-foreground mt-1">
                    When is your salon open? You can change this anytime.
                  </p>
                </div>

                <Card>
                  <CardContent className="p-6 space-y-3">
                    {workingHours.map((day) => (
                      <div
                        key={day.dayOfWeek}
                        className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                          day.isWorking
                            ? "bg-sal-500/5 dark:bg-sal-500/10"
                            : "bg-muted/50"
                        }`}
                      >
                        <Switch
                          checked={day.isWorking}
                          onCheckedChange={(checked) =>
                            updateWorkingDay(day.dayOfWeek, "isWorking", checked)
                          }
                          aria-label={`Toggle ${day.label}`}
                        />
                        <span
                          className={`w-24 text-sm font-medium ${
                            day.isWorking
                              ? "text-foreground"
                              : "text-muted-foreground"
                          }`}
                        >
                          {day.label}
                        </span>

                        {day.isWorking ? (
                          <div className="flex items-center gap-2 flex-1">
                            <Select
                              value={day.openTime}
                              onValueChange={(v) =>
                                updateWorkingDay(day.dayOfWeek, "openTime", v)
                              }
                            >
                              <SelectTrigger className="h-8 text-xs w-[110px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {TIME_OPTIONS.map((t) => (
                                  <SelectItem key={t.value} value={t.value}>
                                    {t.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <span className="text-muted-foreground text-xs">to</span>
                            <Select
                              value={day.closeTime}
                              onValueChange={(v) =>
                                updateWorkingDay(day.dayOfWeek, "closeTime", v)
                              }
                            >
                              <SelectTrigger className="h-8 text-xs w-[110px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {TIME_OPTIONS.map((t) => (
                                  <SelectItem key={t.value} value={t.value}>
                                    {t.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground italic">
                            Closed
                          </span>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ============ Step 3: Services ============ */}
            {step === 3 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-heading font-bold text-foreground">
                    Add your services
                  </h2>
                  <p className="text-muted-foreground mt-1">
                    What services does your salon offer? Add them below or use our template.
                  </p>
                </div>

                {/* Template button */}
                {services.length === 0 && (
                  <Card className="border-dashed border-2 border-sal-500/30">
                    <CardContent className="p-6 text-center">
                      <Sparkles className="w-8 h-8 text-sal-500 mx-auto mb-3" />
                      <h3 className="font-semibold text-foreground mb-1">
                        Start with a template
                      </h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Pre-populate with common salon services. You can edit them later.
                      </p>
                      <Button onClick={useTemplate} variant="outline" className="gap-2">
                        <Sparkles className="w-4 h-4" />
                        Use Template
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {/* Quick-add form */}
                <Card>
                  <CardContent className="p-6">
                    <h3 className="text-sm font-medium text-foreground mb-3">
                      Add a service
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="serviceName" className="text-xs">
                          Service name
                        </Label>
                        <Input
                          id="serviceName"
                          value={newServiceName}
                          onChange={(e) => setNewServiceName(e.target.value)}
                          placeholder="e.g. Balayage"
                          className="h-9"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault()
                              addService()
                            }
                          }}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="serviceDuration" className="text-xs">
                          Duration
                        </Label>
                        <Select
                          value={String(newServiceDuration)}
                          onValueChange={(v) => setNewServiceDuration(parseInt(v))}
                        >
                          <SelectTrigger id="serviceDuration" className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DURATION_OPTIONS.map((d) => (
                              <SelectItem key={d.value} value={String(d.value)}>
                                {d.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="servicePrice" className="text-xs">
                          Price ($)
                        </Label>
                        <div className="flex gap-2">
                          <Input
                            id="servicePrice"
                            type="number"
                            min="0"
                            step="0.01"
                            value={newServicePrice}
                            onChange={(e) => setNewServicePrice(e.target.value)}
                            placeholder="0.00"
                            className="h-9"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault()
                                addService()
                              }
                            }}
                          />
                          <Button
                            type="button"
                            size="sm"
                            onClick={addService}
                            className="h-9 px-3 shrink-0"
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Services list */}
                {services.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <h3 className="text-sm font-medium text-foreground">
                        Your services ({services.length})
                      </h3>
                      {services.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={useTemplate}
                          className="text-xs gap-1 h-7"
                        >
                          <Sparkles className="w-3 h-3" />
                          Use Template
                        </Button>
                      )}
                    </div>

                    <div className="space-y-2">
                      {services.map((service) => (
                        <Card key={service.id}>
                          <CardContent className="p-4 flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-foreground truncate">
                                {service.name}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {formatDurationLabel(service.durationMinutes)} &middot;{" "}
                                {formatCurrency(service.price)}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeService(service.id)}
                              className="shrink-0 text-muted-foreground hover:text-red-500"
                              aria-label={`Remove ${service.name}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ============ Step 4: All Set ============ */}
            {step === 4 && (
              <div className="relative">
                {/* Confetti */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  {Array.from({ length: 40 }).map((_, i) => (
                    <ConfettiParticle key={i} index={i} />
                  ))}
                </div>

                <div className="text-center space-y-6 relative z-10">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{
                      type: "spring",
                      stiffness: 200,
                      damping: 15,
                      delay: 0.2,
                    }}
                    className="w-20 h-20 bg-sal-500 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-sal-500/30"
                  >
                    <Check className="w-10 h-10 text-white" />
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                  >
                    <h2 className="text-3xl font-heading font-bold text-foreground">
                      You&apos;re all set!
                    </h2>
                    <p className="text-muted-foreground mt-2 text-lg">
                      Your salon is ready to accept bookings.
                    </p>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                  >
                    <Card>
                      <CardContent className="p-6">
                        <p className="text-sm text-muted-foreground mb-2">
                          Your booking link
                        </p>
                        <div className="flex items-center gap-2 bg-muted rounded-lg p-3">
                          <code className="text-sm text-foreground flex-1 truncate">
                            {typeof window !== "undefined"
                              ? `${window.location.origin}/book/${business.slug}`
                              : `sal-platform.vercel.app/book/${business.slug}`}
                          </code>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={copyBookingLink}
                            className="shrink-0 gap-1.5"
                          >
                            {copied ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                Copied
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                Copy
                              </>
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 }}
                  >
                    <Button
                      size="lg"
                      className="gap-2 px-8"
                      onClick={() => router.push("/dashboard")}
                    >
                      Go to Dashboard
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </motion.div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom nav buttons (steps 1-3) */}
      {step < 4 && (
        <div className="fixed bottom-0 inset-x-0 bg-cream/80 dark:bg-background/80 backdrop-blur-lg border-t border-cream-200 dark:border-border z-20">
          <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={goBack}
              disabled={step === 1 || saving}
              className="gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <Button onClick={goNext} disabled={saving} className="gap-1.5 min-w-[100px]">
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  {step === 3 ? "Finish" : "Next"}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
