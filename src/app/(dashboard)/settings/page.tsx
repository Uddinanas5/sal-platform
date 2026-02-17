"use client"

import React, { useState } from "react"
import { motion } from "framer-motion"
import {
  Building2,
  Bell,
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
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Switch } from "@/components/ui/switch"
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
  "Asia/Tokyo",
]

const currencies = ["USD", "EUR", "GBP", "CAD", "AUD"]

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
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {description && (
          <p className="text-sm text-gray-500">{description}</p>
        )}
      </div>
      {children}
    </div>
  )
}

export default function SettingsPage() {
  const [theme, setTheme] = useState<"light" | "dark" | "system">("light")
  const [notifications, setNotifications] = useState({
    email: true,
    sms: true,
    push: true,
    marketing: false,
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Settings" subtitle="Manage your business preferences" />

      <div className="p-6">
        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="grid w-full max-w-2xl grid-cols-5">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="billing">Billing</TabsTrigger>
            <TabsTrigger value="integrations">Integrations</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
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
                    <CardTitle className="flex items-center gap-2">
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
                        <p className="text-xs text-gray-500">
                          PNG, JPG up to 2MB. Recommended 200x200px
                        </p>
                      </div>
                    </div>

                    <Separator />

                    <div className="grid gap-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Business Name</label>
                          <Input defaultValue="SAL Beauty Studio" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Phone</label>
                          <Input defaultValue="+1 (555) 123-4567" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Email</label>
                        <Input type="email" defaultValue="hello@salonsal.com" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          Address
                        </label>
                        <Input defaultValue="123 Beauty Street, Suite 100" />
                        <div className="grid grid-cols-3 gap-4">
                          <Input placeholder="City" defaultValue="New York" />
                          <Input placeholder="State" defaultValue="NY" />
                          <Input placeholder="ZIP" defaultValue="10001" />
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
                    <CardTitle className="flex items-center gap-2">
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
                        <Select defaultValue="America/New_York">
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
                        <Select defaultValue="USD">
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
                        <Select defaultValue="en">
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="en">English</SelectItem>
                            <SelectItem value="es">Español</SelectItem>
                            <SelectItem value="fr">Français</SelectItem>
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
                    <CardTitle className="flex items-center gap-2">
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
                <Button>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Notifications */}
          <TabsContent value="notifications">
            <div className="max-w-4xl">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Bell className="w-5 h-5 text-sal-500" />
                      Notification Preferences
                    </CardTitle>
                    <CardDescription>
                      Choose how you want to be notified
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    <SettingRow
                      label="Email Notifications"
                      description="Receive booking confirmations and reminders via email"
                    >
                      <Switch
                        checked={notifications.email}
                        onCheckedChange={(v) =>
                          setNotifications({ ...notifications, email: v })
                        }
                      />
                    </SettingRow>
                    <SettingRow
                      label="SMS Notifications"
                      description="Get text messages for new bookings"
                    >
                      <Switch
                        checked={notifications.sms}
                        onCheckedChange={(v) =>
                          setNotifications({ ...notifications, sms: v })
                        }
                      />
                    </SettingRow>
                    <SettingRow
                      label="Push Notifications"
                      description="Receive push notifications on your devices"
                    >
                      <Switch
                        checked={notifications.push}
                        onCheckedChange={(v) =>
                          setNotifications({ ...notifications, push: v })
                        }
                      />
                    </SettingRow>
                    <SettingRow
                      label="Marketing Emails"
                      description="Receive tips, product updates and news"
                    >
                      <Switch
                        checked={notifications.marketing}
                        onCheckedChange={(v) =>
                          setNotifications({ ...notifications, marketing: v })
                        }
                      />
                    </SettingRow>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
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
                        <CardTitle className="flex items-center gap-2">
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
                      <span className="text-4xl font-bold">$49</span>
                      <span className="text-gray-500 mb-1">/month</span>
                    </div>
                    <ul className="space-y-2 text-sm text-gray-600 mb-6">
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
                    <CardTitle>Payment Method</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-8 bg-gradient-to-br from-blue-600 to-blue-800 rounded flex items-center justify-center text-white text-xs font-bold">
                          VISA
                        </div>
                        <div>
                          <p className="font-medium">•••• •••• •••• 4242</p>
                          <p className="text-sm text-gray-500">Expires 12/26</p>
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
                    <CardTitle>Connected Services</CardTitle>
                    <CardDescription>
                      Manage your integrations with third-party services
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {[
                      { name: "Google Calendar", status: "connected", icon: "📅" },
                      { name: "Stripe", status: "connected", icon: "💳" },
                      { name: "Mailchimp", status: "disconnected", icon: "📧" },
                      { name: "Instagram", status: "disconnected", icon: "📸" },
                    ].map((integration) => (
                      <div
                        key={integration.name}
                        className="flex items-center justify-between p-4 rounded-lg border"
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
                    <CardTitle className="flex items-center gap-2">
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
                    <CardTitle className="text-red-600">Danger Zone</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-4">
                      Once you delete your account, there is no going back. Please be certain.
                    </p>
                    <Button variant="destructive">Delete Account</Button>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
