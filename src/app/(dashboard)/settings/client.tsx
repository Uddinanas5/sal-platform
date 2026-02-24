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
import { Header } from "@/components/dashboard/header"
import { BookingSettingsTab } from "@/components/settings/booking-settings-tab"
import { PaymentsSettingsTab } from "@/components/settings/payments-settings-tab"
import { NotificationsSettingsTab } from "@/components/settings/notifications-settings-tab"
import { OnlinePresenceTab } from "@/components/settings/online-presence-tab"
import { FormsSection } from "@/components/settings/forms-section"
import { ResourcesSection } from "@/components/settings/resources-section"
import { TeamMembersTab } from "@/components/settings/team-members-tab"
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
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Asia/Dubai",
  "Asia/Tokyo",
]

const currencies = ["USD", "EUR", "GBP", "CAD", "AUD", "AED"]

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
}

export default function SettingsClient({ resources, services, initialBusiness, initialLocation, role, currentUserId, invitations, teamMembers }: SettingsClientProps) {
  const isOwner = role === "owner"
  const isAdminOrOwner = role === "owner" || role === "admin"
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
  const [language, setLanguage] = useState("en")
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

  return (
    <div className="min-h-screen bg-cream">
      <Header title="Settings" subtitle="Manage your business preferences" />

      <div className="p-6">
        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="flex w-full max-w-5xl overflow-x-auto">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="resources">Resources</TabsTrigger>
            {isOwner && <TabsTrigger value="billing">Billing</TabsTrigger>}
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
                        <Button variant="outline">
                          <Upload className="w-4 h-4 mr-2" />
                          Upload Logo
                        </Button>
                        <p className="text-xs text-muted-foreground">
                          PNG, JPG up to 2MB. Recommended 200x200px
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
                        <label className="text-sm font-medium">Language</label>
                        <Select value={language} onValueChange={setLanguage}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="en">English</SelectItem>
                            <SelectItem value="es">{`Espa\u00f1ol`}</SelectItem>
                            <SelectItem value="fr">{`Fran\u00e7ais`}</SelectItem>
                          </SelectContent>
                        </Select>
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

          {/* Billing */}
          <TabsContent value="billing">
            <div className="max-w-4xl space-y-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2 font-heading">
                          <CreditCard className="w-5 h-5 text-sal-500" />
                          Current Plan
                        </CardTitle>
                        <CardDescription>
                          Your subscription details
                        </CardDescription>
                      </div>
                      <Badge className="bg-gradient-to-r from-sal-500 to-sal-600 text-white">
                        Pro Plan
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-end gap-2 mb-4">
                      <span className="text-4xl font-heading font-bold">$49</span>
                      <span className="text-muted-foreground mb-1">/month</span>
                    </div>
                    <ul className="space-y-2 text-sm text-muted-foreground mb-6">
                      <li className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-sal-500" />
                        Unlimited appointments
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-sal-500" />
                        Up to 10 staff members
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-sal-500" />
                        AI-powered insights
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-sal-500" />
                        Priority support
                      </li>
                    </ul>
                    <div className="flex gap-3">
                      <Button variant="outline">Change Plan</Button>
                      <Button variant="ghost" className="text-red-500 hover:text-red-600">
                        Cancel Subscription
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="font-heading">Payment Method</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between p-4 rounded-lg bg-cream-100">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-8 bg-gradient-to-br from-blue-600 to-blue-800 rounded flex items-center justify-center text-white text-xs font-bold">
                          VISA
                        </div>
                        <div>
                          <p className="font-medium">{"\u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 4242"}</p>
                          <p className="text-sm text-muted-foreground">Expires 12/26</p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">Update</Button>
                    </div>
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
                    <CardTitle className="font-heading">Connected Services</CardTitle>
                    <CardDescription>
                      Manage your integrations with third-party services
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {[
                      { name: "Google Calendar", status: "connected", icon: "\uD83D\uDCC5" },
                      { name: "Stripe", status: "connected", icon: "\uD83D\uDCB3" },
                      { name: "Mailchimp", status: "disconnected", icon: "\uD83D\uDCE7" },
                      { name: "Instagram", status: "disconnected", icon: "\uD83D\uDCF8" },
                    ].map((integration) => (
                      <div
                        key={integration.name}
                        className="flex items-center justify-between p-4 rounded-lg border border-cream-200"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{integration.icon}</span>
                          <div>
                            <p className="font-medium">{integration.name}</p>
                            <Badge
                              variant={
                                integration.status === "connected"
                                  ? "success"
                                  : "secondary"
                              }
                              className="mt-1"
                            >
                              {integration.status}
                            </Badge>
                          </div>
                        </div>
                        <Button
                          variant={
                            integration.status === "connected"
                              ? "outline"
                              : "default"
                          }
                          size="sm"
                        >
                          {integration.status === "connected"
                            ? "Disconnect"
                            : "Connect"}
                        </Button>
                      </div>
                    ))}
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
                      <Button variant="outline" size="sm">
                        Enable
                      </Button>
                    </SettingRow>
                    <SettingRow
                      label="Change Password"
                      description="Update your password regularly"
                    >
                      <Button variant="outline" size="sm">
                        Update
                      </Button>
                    </SettingRow>
                    <SettingRow
                      label="Active Sessions"
                      description="Manage devices where you're logged in"
                    >
                      <Button variant="outline" size="sm">
                        View All
                      </Button>
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
                    <p className="text-sm text-muted-foreground mb-4">
                      Once you delete your account, there is no going back. Please be certain.
                    </p>
                    <Button variant="destructive">Delete Account</Button>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </TabsContent>

          {/* Booking Settings */}
          <TabsContent value="booking">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
              <BookingSettingsTab />
            </motion.div>
          </TabsContent>

          {/* Payments Settings */}
          <TabsContent value="payments">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
              <PaymentsSettingsTab />
            </motion.div>
          </TabsContent>

          {/* Notifications */}
          <TabsContent value="notifications">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
              <NotificationsSettingsTab />
            </motion.div>
          </TabsContent>

          {/* Online Presence */}
          <TabsContent value="online-presence">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
              <OnlinePresenceTab />
            </motion.div>
          </TabsContent>

          {/* Client Forms */}
          <TabsContent value="forms">
            <div className="max-w-4xl">
              <FormsSection templates={[]} />
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
