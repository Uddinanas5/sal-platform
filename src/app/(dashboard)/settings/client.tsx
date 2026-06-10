"use client"

import React, { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { toast } from "sonner"
import {
  Building2,
  CreditCard,
  Palette,
  Globe,
  Lock,
  Moon,
  Sun,
  Smartphone,
  MapPin,
  Save,
  Upload,
} from "lucide-react"
import { updateBusinessSettings } from "@/lib/actions/settings"
import type { BookingSettings } from "@/lib/actions/booking-settings"
import type { OnlinePresenceSettings, PaymentSettings, NotificationSettings } from "@/lib/actions/settings"
import { Header } from "@/components/dashboard/header"
import { BookingSettingsTab } from "@/components/settings/booking-settings-tab"
import { PaymentsSettingsTab } from "@/components/settings/payments-settings-tab"
import { NotificationsSettingsTab } from "@/components/settings/notifications-settings-tab"
import { OnlinePresenceTab } from "@/components/settings/online-presence-tab"
import { FormsSection } from "@/components/settings/forms-section"
import type { FormTemplateItem } from "@/components/settings/forms-section"
import { ResourcesSection } from "@/components/settings/resources-section"
import { TeamMembersTab } from "@/components/settings/team-members-tab"
import { DeleteAccountSection } from "./delete-account-section"
import type { InvitationWithInviter } from "@/lib/queries/invitations"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const timezones = [
  // Americas
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Phoenix",
  "America/Toronto",
  "America/Vancouver",
  "America/Mexico_City",
  "America/Sao_Paulo",
  "America/Argentina/Buenos_Aires",
  "America/Bogota",
  "America/Santiago",
  // Europe
  "Europe/London",
  "Europe/Dublin",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Rome",
  "Europe/Amsterdam",
  "Europe/Zurich",
  "Europe/Stockholm",
  "Europe/Warsaw",
  "Europe/Lisbon",
  "Europe/Athens",
  "Europe/Istanbul",
  "Europe/Moscow",
  // Middle East
  "Asia/Dubai",
  "Asia/Riyadh",
  "Asia/Qatar",
  "Asia/Kuwait",
  "Asia/Muscat",
  "Asia/Tehran",
  "Asia/Jerusalem",
  "Asia/Beirut",
  // South Asia
  "Asia/Kolkata",
  "Asia/Karachi",
  "Asia/Dhaka",
  "Asia/Colombo",
  // East & Southeast Asia
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Hong_Kong",
  "Asia/Seoul",
  "Asia/Singapore",
  "Asia/Kuala_Lumpur",
  "Asia/Bangkok",
  "Asia/Jakarta",
  "Asia/Manila",
  // Africa
  "Africa/Cairo",
  "Africa/Lagos",
  "Africa/Johannesburg",
  "Africa/Nairobi",
  "Africa/Casablanca",
  // Oceania
  "Australia/Sydney",
  "Australia/Melbourne",
  "Australia/Perth",
  "Pacific/Auckland",
]

const currencies = [
  "USD", "EUR", "GBP", "CAD", "AUD", "AED",
  "SAR", "QAR", "KWD", "BHD", "OMR", "INR",
  "PKR", "BDT", "JPY", "CNY", "KRW", "SGD",
  "MYR", "THB", "IDR", "PHP", "BRL", "MXN",
  "ZAR", "EGP", "NGN", "KES", "MAD", "TRY",
  "CHF", "SEK", "NOK", "DKK", "PLN", "NZD",
]

function SettingRow({
  label,
  description,
  children,
}: {
  label: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between py-4 border-b last:border-b-0">
      <div className="space-y-0.5">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </div>
  )
}

interface Resource {
  id: string
  name: string
  type: string
  description: string
  capacity: number
  isActive: boolean
  serviceIds: string[]
  createdAt: Date
}

interface ServiceOption {
  id: string
  name: string
  category: string
}

interface TeamMember {
  staffId: string
  userId: string
  name: string
  email: string
  role: string
  avatarUrl?: string | null
}

interface SettingsClientProps {
  resources: Resource[]
  services: ServiceOption[]
  // Real persisted form templates (from getFormTemplates). The query types
  // `fields` loosely (JSON column), so we narrow to FormTemplateItem when
  // handing off to FormsSection below.
  formTemplates: Array<Omit<FormTemplateItem, "fields"> & { fields: Record<string, unknown>[] }>;
  initialBusiness: {
    name: string
    phone: string | null
    email: string | null
    timezone: string
    currency: string
  } | null
  initialLocation: {
    addressLine1: string
    city: string
    state: string | null
    postalCode: string | null
  } | null
  role: string
  currentUserId: string
  invitations: InvitationWithInviter[]
  teamMembers: TeamMember[]
  bookingSettings: BookingSettings
  businessSlug: string
  onlinePresenceSettings: OnlinePresenceSettings
  paymentSettings: PaymentSettings
  notificationSettings: NotificationSettings
  billing: BillingState
  // The ?tab= query param (validated below) so a deep link / gate redirect lands
  // on the right tab. The ?billing= return marker from Stripe Checkout.
  initialTab?: string
  billingResult?: string
}

// All Tabs values rendered below. "team" is admin/owner-only (guarded).
const SETTINGS_TABS = [
  "general",
  "resources",
  "billing",
  "integrations",
  "security",
  "booking",
  "payments",
  "notifications",
  "online-presence",
  "forms",
  "team",
] as const

// SAL subscription billing state for the salon-as-payer. `hasSubscription` is
// the linchpin of safe-by-default gating: a salon that never subscribed sits at
// status "active" with hasSubscription=false and is offered the plan (never
// gated).
interface BillingState {
  status: string
  hasSubscription: boolean
  hasCustomer: boolean
  billingExempt: boolean
  tier: string
}

export default function SettingsClient({ resources, services, formTemplates, initialBusiness, initialLocation, role, currentUserId, invitations, teamMembers, bookingSettings, notificationSettings, businessSlug, onlinePresenceSettings, paymentSettings, billing, initialTab, billingResult }: SettingsClientProps) {
  const isAdminOrOwner = role === "owner" || role === "admin"

  // Honor the ?tab= deep link / gate redirect target. Validate against the known
  // tab set and fall back to "general"; "team" is admin/owner-only, so a non-priv
  // deep link to it also falls back (its TabsTrigger/Content aren't rendered).
  const resolvedInitialTab =
    initialTab &&
    (SETTINGS_TABS as readonly string[]).includes(initialTab) &&
    (initialTab !== "team" || isAdminOrOwner)
      ? initialTab
      : "general"
  const [activeTab, setActiveTab] = useState(resolvedInitialTab)

  // Acknowledge the Stripe Checkout return (?billing=success|cancelled) with a
  // toast on mount, then strip the marker params so a refresh doesn't re-fire it.
  useEffect(() => {
    if (billingResult === "success") {
      toast.success("Subscription active", {
        description: "Your SAL subscription is set up. Welcome aboard!",
      })
    } else if (billingResult === "cancelled") {
      toast("Checkout cancelled", {
        description: "No charge was made. You can set up billing anytime.",
      })
    }
    if (billingResult) {
      const url = new URL(window.location.href)
      url.searchParams.delete("billing")
      url.searchParams.delete("session_id")
      window.history.replaceState({}, "", url.toString())
    }
    // Run once on mount for the initial query params.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [theme, setTheme] = useState<"light" | "dark" | "system">(() => {
    if (typeof window === "undefined") return "light"
    return (localStorage.getItem("sal-theme") as "light" | "dark" | "system") || "light"
  })
  // Controlled state for General settings
  const [businessName, setBusinessName] = useState(initialBusiness?.name || "")
  const [businessPhone, setBusinessPhone] = useState(initialBusiness?.phone || "")
  const [businessEmail, setBusinessEmail] = useState(initialBusiness?.email || "")
  const [businessAddress, setBusinessAddress] = useState(initialLocation?.addressLine1 || "")
  const [businessCity, setBusinessCity] = useState(initialLocation?.city || "")
  const [businessState, setBusinessState] = useState(initialLocation?.state || "")
  const [businessZip, setBusinessZip] = useState(initialLocation?.postalCode || "")
  const [timezone, setTimezone] = useState(initialBusiness?.timezone || "America/New_York")
  const [currency, setCurrency] = useState(initialBusiness?.currency || "USD")
  const [isSaving, setIsSaving] = useState(false)

  // Apply theme to document and persist
  useEffect(() => {
    localStorage.setItem("sal-theme", theme)
    const root = document.documentElement
    if (theme === "dark") {
      root.classList.add("dark")
    } else if (theme === "light") {
      root.classList.remove("dark")
    } else {
      // system preference
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
      if (prefersDark) {
        root.classList.add("dark")
      } else {
        root.classList.remove("dark")
      }
    }
  }, [theme])

  async function handleSaveSettings() {
    setIsSaving(true)
    const result = await updateBusinessSettings({
      name: businessName,
      phone: businessPhone,
      email: businessEmail,
      address: businessAddress,
      city: businessCity,
      state: businessState,
      zipCode: businessZip,
      timezone,
      currency,
    })

    if (result.success) {
      toast.success("Settings saved successfully", {
        description: `Business: ${businessName}, Theme: ${theme}, Timezone: ${timezone}`,
      })
    } else {
      toast.error(`Failed to save settings: ${result.error}`)
    }
    setIsSaving(false)
  }

  const isOwner = role === "owner"
  const [billingLoading, setBillingLoading] = useState(false)

  // Start the SAL subscription checkout ($1,500 setup + $497/mo). The server
  // route resolves the business from the session — we send no ids the browser
  // could forge. On success we hand off to Stripe-hosted Checkout.
  async function handleStartCheckout() {
    setBillingLoading(true)
    try {
      const res = await fetch("/api/stripe/create-subscription-checkout", {
        method: "POST",
      })
      const data = await res.json()
      if (res.ok && data.url) {
        window.location.href = data.url as string
      } else {
        toast.error(data.error || "Could not start checkout")
      }
    } catch {
      toast.error("Could not start checkout")
    } finally {
      setBillingLoading(false)
    }
  }

  // Open the Stripe Customer Portal (update card, view invoices, cancel).
  async function handleOpenPortal() {
    setBillingLoading(true)
    try {
      const res = await fetch("/api/stripe/billing-portal", { method: "POST" })
      const data = await res.json()
      if (res.ok && data.url) {
        window.location.href = data.url as string
      } else {
        toast.error(data.error || "Could not open billing portal")
      }
    } catch {
      toast.error("Could not open billing portal")
    } finally {
      setBillingLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-cream">
      <Header title="Settings" subtitle="Manage your business preferences" />

      <div className="p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="flex w-full max-w-5xl overflow-x-auto gap-1 h-auto flex-wrap">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="resources">Resources</TabsTrigger>
            <TabsTrigger value="billing">Billing</TabsTrigger>
            <TabsTrigger value="integrations">Integrations</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="booking">Booking</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="online-presence">Online Presence</TabsTrigger>
            <TabsTrigger value="forms">Forms</TabsTrigger>
            {isAdminOrOwner && <TabsTrigger value="team">Team</TabsTrigger>}
          </TabsList>

          {/* General Settings */}
          <TabsContent value="general">
            <div className="grid gap-6 max-w-4xl">
              {/* Business Profile */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 font-heading">
                      <Building2 className="w-5 h-5 text-sal-500" />
                      Business Profile
                    </CardTitle>
                    <CardDescription>
                      Your business information visible to clients
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center gap-6">
                      <Avatar className="w-24 h-24">
                        <AvatarImage src="/logos/sal-icon.svg" />
                        <AvatarFallback className="bg-sal-100 text-sal-600 text-2xl">
                          S
                        </AvatarFallback>
                      </Avatar>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Button variant="outline" disabled>
                            <Upload className="w-4 h-4 mr-2" />
                            Upload Logo
                          </Button>
                          <Badge variant="secondary">Coming soon</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Custom logo uploads are coming soon.
                        </p>
                      </div>
                    </div>

                    <Separator />

                    <div className="grid gap-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Business Name</label>
                          <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Phone</label>
                          <Input value={businessPhone} onChange={(e) => setBusinessPhone(e.target.value)} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Email</label>
                        <Input type="email" value={businessEmail} onChange={(e) => setBusinessEmail(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          Address
                        </label>
                        <Input value={businessAddress} onChange={(e) => setBusinessAddress(e.target.value)} />
                        <div className="grid grid-cols-3 gap-4">
                          <Input placeholder="City" value={businessCity} onChange={(e) => setBusinessCity(e.target.value)} />
                          <Input placeholder="State" value={businessState} onChange={(e) => setBusinessState(e.target.value)} />
                          <Input placeholder="ZIP" value={businessZip} onChange={(e) => setBusinessZip(e.target.value)} />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Localization */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 font-heading">
                      <Globe className="w-5 h-5 text-sal-500" />
                      Localization
                    </CardTitle>
                    <CardDescription>
                      Set your timezone, currency, and language preferences
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Timezone</label>
                        <Select value={timezone} onValueChange={setTimezone}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {timezones.map((tz) => (
                              <SelectItem key={tz} value={tz}>
                                {tz.replace("_", " ")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Currency</label>
                        <Select value={currency} onValueChange={setCurrency}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {currencies.map((curr) => (
                              <SelectItem key={curr} value={curr}>
                                {curr}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2">
                          Language
                          <Badge variant="secondary">Coming soon</Badge>
                        </label>
                        <Select value="en" disabled>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="en">English</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Translations coming soon.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Appearance */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 font-heading">
                      <Palette className="w-5 h-5 text-sal-500" />
                      Appearance
                    </CardTitle>
                    <CardDescription>
                      Customize how SAL looks for you
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <SettingRow label="Theme" description="Select your preferred theme">
                      <div className="flex gap-2">
                        {[
                          { value: "light", icon: Sun, label: "Light" },
                          { value: "dark", icon: Moon, label: "Dark" },
                          { value: "system", icon: Smartphone, label: "System" },
                        ].map((option) => (
                          <Button
                            key={option.value}
                            variant={theme === option.value ? "default" : "outline"}
                            size="sm"
                            onClick={() => setTheme(option.value as typeof theme)}
                            className="gap-2"
                          >
                            <option.icon className="w-4 h-4" />
                            {option.label}
                          </Button>
                        ))}
                      </div>
                    </SettingRow>
                  </CardContent>
                </Card>
              </motion.div>

              <div className="flex justify-end">
                <Button onClick={handleSaveSettings} disabled={isSaving}>
                  <Save className="w-4 h-4 mr-2" />
                  {isSaving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Resources */}
          <TabsContent value="resources">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
              <ResourcesSection resources={resources} services={services} />
            </motion.div>
          </TabsContent>

          {/* Billing \u2014 real SAL subscription state ($1,500 setup + $497/mo).
              Driven entirely by props from the server (subscriptionStatus +
              stripeSubscriptionId + billingExempt). Owner-only action buttons. */}
          <TabsContent value="billing">
            <div className="max-w-4xl space-y-6">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2 font-heading">
                          <CreditCard className="w-5 h-5 text-sal-500" />
                          SAL Subscription
                        </CardTitle>
                        <CardDescription>
                          Your SAL platform plan and billing
                        </CardDescription>
                      </div>
                      {billing.billingExempt ? (
                        <Badge className="bg-sal-500/10 text-sal-700 dark:text-sal-300 border-sal-500/30">
                          Founding beta \u2014 billing waived
                        </Badge>
                      ) : billing.hasSubscription && billing.status === "active" ? (
                        <Badge className="bg-gradient-to-r from-sal-500 to-sal-600 text-white">
                          Pro \u2014 active
                        </Badge>
                      ) : billing.hasSubscription && billing.status === "past_due" ? (
                        <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30">
                          Past due
                        </Badge>
                      ) : billing.hasSubscription && billing.status === "paused" ? (
                        <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30">
                          Paused
                        </Badge>
                      ) : billing.hasSubscription && billing.status === "cancelled" ? (
                        <Badge variant="secondary">Cancelled</Badge>
                      ) : (
                        <Badge variant="secondary">No plan</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Plan price line \u2014 always the founder's Grand Slam Offer. */}
                    <div className="flex flex-wrap items-end gap-2">
                      <span className="text-4xl font-heading font-bold">$497</span>
                      <span className="text-muted-foreground mb-1">/month</span>
                      <span className="text-muted-foreground mb-1">
                        + $1,500 one-time setup
                      </span>
                    </div>

                    {/* (E) billingExempt \u2014 beta waiver overrides everything. */}
                    {billing.billingExempt ? (
                      <p className="text-sm text-muted-foreground">
                        Your account is a founding beta \u2014 billing is waived. You have
                        full access at no charge. Thank you for helping build SAL.
                      </p>
                    ) : billing.hasSubscription && billing.status === "active" ? (
                      /* (B) active subscription. */
                      <>
                        <p className="text-sm text-muted-foreground">
                          Your subscription is active. Your card is billed $497 monthly;
                          manage your payment method, view invoices, or cancel anytime
                          from the billing portal.
                        </p>
                        {isOwner ? (
                          <Button onClick={handleOpenPortal} disabled={billingLoading}>
                            {billingLoading ? "Opening..." : "Manage billing"}
                          </Button>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            Only the business owner can manage billing.
                          </p>
                        )}
                      </>
                    ) : billing.hasSubscription && billing.status === "past_due" ? (
                      /* (C) past due \u2014 payment failed, full access retained. */
                      <>
                        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300">
                          Your last payment failed. Update your card to keep your
                          subscription active.
                        </div>
                        {isOwner ? (
                          <Button onClick={handleOpenPortal} disabled={billingLoading}>
                            {billingLoading ? "Opening..." : "Update payment method"}
                          </Button>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            Only the business owner can update billing.
                          </p>
                        )}
                      </>
                    ) : billing.hasSubscription && billing.status === "paused" ? (
                      /* (C2) paused \u2014 temporary hold, full access retained. */
                      <>
                        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300">
                          Your subscription is paused. It will resume automatically;
                          manage it anytime from the billing portal.
                        </div>
                        {isOwner ? (
                          <Button onClick={handleOpenPortal} disabled={billingLoading}>
                            {billingLoading ? "Opening..." : "Manage billing"}
                          </Button>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            Only the business owner can manage billing.
                          </p>
                        )}
                      </>
                    ) : billing.hasSubscription && billing.status === "cancelled" ? (
                      /* (D) cancelled \u2014 had a subscription, must resubscribe. */
                      <>
                        <p className="text-sm text-muted-foreground">
                          Your subscription has ended. Resubscribe to restore full
                          access to SAL.
                        </p>
                        {isOwner ? (
                          <Button onClick={handleStartCheckout} disabled={billingLoading}>
                            {billingLoading ? "Starting..." : "Resubscribe"}
                          </Button>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            Only the business owner can manage billing.
                          </p>
                        )}
                      </>
                    ) : (
                      /* (A) never subscribed \u2014 offer card. NOT gated; full access. */
                      <>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                          <li className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-sal-500" />
                            Complete done-for-you setup ($1,500 one-time)
                          </li>
                          <li className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-sal-500" />
                            Unlimited appointments &amp; staff
                          </li>
                          <li className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-sal-500" />
                            Online booking, payments, and reminders
                          </li>
                          <li className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-sal-500" />
                            Priority support
                          </li>
                        </ul>
                        {isOwner ? (
                          <Button onClick={handleStartCheckout} disabled={billingLoading}>
                            {billingLoading ? "Starting..." : "Set up billing"}
                          </Button>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            Only the business owner can set up billing.
                          </p>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </TabsContent>

          {/* Integrations */}
          <TabsContent value="integrations">
            <div className="max-w-4xl">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="font-heading">Integrations</CardTitle>
                    <CardDescription>
                      Connect SAL with third-party services
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="w-12 h-12 rounded-full bg-sal-500/10 flex items-center justify-center mb-4">
                        <Globe className="w-6 h-6 text-sal-500" />
                      </div>
                      <p className="font-medium text-foreground">Coming soon</p>
                      <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                        Integrations with calendars, email marketing, and social
                        tools are on the way. We&apos;ll let you know when they&apos;re ready.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </TabsContent>

          {/* Security */}
          <TabsContent value="security">
            <div className="max-w-4xl space-y-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 font-heading">
                      <Lock className="w-5 h-5 text-sal-500" />
                      Security Settings
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    <SettingRow
                      label="Two-Factor Authentication"
                      description="Add an extra layer of security to your account"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">Coming soon</Badge>
                        <Button variant="outline" size="sm" disabled>
                          Enable
                        </Button>
                      </div>
                    </SettingRow>
                    <SettingRow
                      label="Change Password"
                      description="Update your password regularly"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">Coming soon</Badge>
                        <Button variant="outline" size="sm" disabled>
                          Update
                        </Button>
                      </div>
                    </SettingRow>
                    <SettingRow
                      label="Active Sessions"
                      description="Manage devices where you're logged in"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">Coming soon</Badge>
                        <Button variant="outline" size="sm" disabled>
                          View All
                        </Button>
                      </div>
                    </SettingRow>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <Card className="border-red-200">
                  <CardHeader>
                    <CardTitle className="text-red-600 font-heading">Danger Zone</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <DeleteAccountSection role={role} businessName={businessName} />
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </TabsContent>

          {/* Booking Settings */}
          <TabsContent value="booking">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
              <BookingSettingsTab initialSettings={bookingSettings} />
            </motion.div>
          </TabsContent>

          {/* Payments Settings */}
          <TabsContent value="payments">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
              <PaymentsSettingsTab initialSettings={paymentSettings} />
            </motion.div>
          </TabsContent>

          {/* Notifications */}
          <TabsContent value="notifications">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
              <NotificationsSettingsTab initialSettings={notificationSettings} />
            </motion.div>
          </TabsContent>

          {/* Online Presence */}
          <TabsContent value="online-presence">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
              <OnlinePresenceTab
                businessSlug={businessSlug}
                initialSettings={onlinePresenceSettings}
              />
            </motion.div>
          </TabsContent>

          {/* Client Forms */}
          <TabsContent value="forms">
            <div className="max-w-4xl">
              <FormsSection templates={formTemplates as unknown as FormTemplateItem[]} />
            </div>
          </TabsContent>

          {/* Team Members */}
          {isAdminOrOwner && (
            <TabsContent value="team">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
                <TeamMembersTab
                  invitations={invitations}
                  teamMembers={teamMembers}
                  currentUserId={currentUserId}
                  currentUserRole={role}
                />
              </motion.div>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  )
}
