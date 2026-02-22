"use client"

import React, { useState } from "react"
import { motion } from "framer-motion"
import {
  Mail,
  MessageSquare,
  BellRing,
  Save,
  Info,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

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

const defaultEmailTemplates = {
  bookingConfirmation: `Hi {client_name},

Your appointment has been confirmed!

Service: {service_name}
Date: {date}
Time: {time}
Stylist: {staff_name}

We look forward to seeing you at {salon_name}.

Best regards,
{salon_name} Team`,
  appointmentReminder: `Hi {client_name},

This is a friendly reminder about your upcoming appointment.

Service: {service_name}
Date: {date}
Time: {time}
Stylist: {staff_name}

If you need to reschedule, please contact us as soon as possible.

See you soon!
{salon_name}`,
  cancellationNotice: `Hi {client_name},

Your appointment has been cancelled.

Service: {service_name}
Date: {date}
Time: {time}

If this was a mistake or you'd like to rebook, please visit our booking page or give us a call.

{salon_name} Team`,
  followUp: `Hi {client_name},

Thank you for visiting {salon_name}! We hope you loved your {service_name}.

We'd really appreciate it if you could take a moment to leave us a review. Your feedback helps us improve!

See you next time!
{salon_name} Team`,
}

const defaultSmsTemplates = {
  bookingConfirmation: `Hi {client_name}! Your {service_name} appointment is confirmed for {date} at {time} with {staff_name}. See you at {salon_name}!`,
  appointmentReminder: `Reminder: {client_name}, you have a {service_name} appointment tomorrow at {time} with {staff_name} at {salon_name}. Reply C to cancel.`,
  cancellationNotice: `Hi {client_name}, your {service_name} appointment on {date} at {time} has been cancelled. Visit us to rebook! - {salon_name}`,
  followUp: `Hi {client_name}! Thanks for visiting {salon_name}. How was your {service_name}? We'd love your feedback! Reply to rate 1-5.`,
}

function SmsTemplateField({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const charCount = value.length
  const segments = Math.ceil(charCount / 160)

  return (
    <div className="space-y-2">
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="font-mono text-sm"
      />
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Use merge fields like {"{client_name}"}, {"{service_name}"}, etc.
        </p>
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-medium ${
              charCount > 160 ? "text-amber-600" : "text-muted-foreground"
            }`}
          >
            {charCount} / 160 characters
          </span>
          {segments > 1 && (
            <Badge variant="secondary" className="text-xs">
              {segments} segments
            </Badge>
          )}
        </div>
      </div>
    </div>
  )
}

export function NotificationsSettingsTab() {
  const [emailTemplates, setEmailTemplates] = useState(defaultEmailTemplates)
  const [smsTemplates, setSmsTemplates] = useState(defaultSmsTemplates)
  const [internalAlerts, setInternalAlerts] = useState({
    newBooking: true,
    cancellation: true,
    lowInventory: false,
    dailySummary: true,
  })

  const handleSave = () => {
    toast.success("Notification settings saved successfully")
  }

  const mergeFields = [
    "{client_name}",
    "{service_name}",
    "{date}",
    "{time}",
    "{staff_name}",
    "{salon_name}",
  ]

  return (
    <div className="grid gap-6 max-w-4xl">
      {/* Email Notifications */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-heading">
              <Mail className="w-5 h-5 text-sal-500" />
              Email Notifications
            </CardTitle>
            <CardDescription>
              Customize email templates sent to your clients
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-2 p-3 rounded-lg bg-sal-50 border border-sal-200">
              <Info className="w-4 h-4 text-sal-600 mt-0.5 shrink-0" />
              <div className="text-sm text-sal-700">
                <p className="font-medium mb-1">Available Merge Fields</p>
                <div className="flex flex-wrap gap-1.5">
                  {mergeFields.map((field) => (
                    <Badge
                      key={field}
                      variant="secondary"
                      className="font-mono text-xs bg-white"
                    >
                      {field}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="booking-confirmation">
                <AccordionTrigger className="text-sm font-medium">
                  Booking Confirmation
                </AccordionTrigger>
                <AccordionContent>
                  <Textarea
                    value={emailTemplates.bookingConfirmation}
                    onChange={(e) =>
                      setEmailTemplates({
                        ...emailTemplates,
                        bookingConfirmation: e.target.value,
                      })
                    }
                    rows={10}
                    className="font-mono text-sm"
                  />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="appointment-reminder">
                <AccordionTrigger className="text-sm font-medium">
                  Appointment Reminder
                </AccordionTrigger>
                <AccordionContent>
                  <Textarea
                    value={emailTemplates.appointmentReminder}
                    onChange={(e) =>
                      setEmailTemplates({
                        ...emailTemplates,
                        appointmentReminder: e.target.value,
                      })
                    }
                    rows={10}
                    className="font-mono text-sm"
                  />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="cancellation-notice">
                <AccordionTrigger className="text-sm font-medium">
                  Cancellation Notice
                </AccordionTrigger>
                <AccordionContent>
                  <Textarea
                    value={emailTemplates.cancellationNotice}
                    onChange={(e) =>
                      setEmailTemplates({
                        ...emailTemplates,
                        cancellationNotice: e.target.value,
                      })
                    }
                    rows={10}
                    className="font-mono text-sm"
                  />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="follow-up">
                <AccordionTrigger className="text-sm font-medium">
                  Follow-up / Review Request
                </AccordionTrigger>
                <AccordionContent>
                  <Textarea
                    value={emailTemplates.followUp}
                    onChange={(e) =>
                      setEmailTemplates({
                        ...emailTemplates,
                        followUp: e.target.value,
                      })
                    }
                    rows={8}
                    className="font-mono text-sm"
                  />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      </motion.div>

      {/* SMS Notifications */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-heading">
              <MessageSquare className="w-5 h-5 text-sal-500" />
              SMS Notifications
            </CardTitle>
            <CardDescription>
              Customize SMS templates sent to your clients
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="sms-booking-confirmation">
                <AccordionTrigger className="text-sm font-medium">
                  Booking Confirmation
                </AccordionTrigger>
                <AccordionContent>
                  <SmsTemplateField
                    value={smsTemplates.bookingConfirmation}
                    onChange={(v) =>
                      setSmsTemplates({ ...smsTemplates, bookingConfirmation: v })
                    }
                  />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="sms-appointment-reminder">
                <AccordionTrigger className="text-sm font-medium">
                  Appointment Reminder
                </AccordionTrigger>
                <AccordionContent>
                  <SmsTemplateField
                    value={smsTemplates.appointmentReminder}
                    onChange={(v) =>
                      setSmsTemplates({ ...smsTemplates, appointmentReminder: v })
                    }
                  />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="sms-cancellation-notice">
                <AccordionTrigger className="text-sm font-medium">
                  Cancellation Notice
                </AccordionTrigger>
                <AccordionContent>
                  <SmsTemplateField
                    value={smsTemplates.cancellationNotice}
                    onChange={(v) =>
                      setSmsTemplates({ ...smsTemplates, cancellationNotice: v })
                    }
                  />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="sms-follow-up">
                <AccordionTrigger className="text-sm font-medium">
                  Follow-up / Review Request
                </AccordionTrigger>
                <AccordionContent>
                  <SmsTemplateField
                    value={smsTemplates.followUp}
                    onChange={(v) =>
                      setSmsTemplates({ ...smsTemplates, followUp: v })
                    }
                  />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      </motion.div>

      {/* Internal Alerts */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-heading">
              <BellRing className="w-5 h-5 text-sal-500" />
              Internal Alerts
            </CardTitle>
            <CardDescription>
              Notifications sent to you and your team
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            <SettingRow
              label="New Booking Alert"
              description="Get notified when a new appointment is booked"
            >
              <Switch
                checked={internalAlerts.newBooking}
                onCheckedChange={(v) =>
                  setInternalAlerts({ ...internalAlerts, newBooking: v })
                }
              />
            </SettingRow>
            <SettingRow
              label="Cancellation Alert"
              description="Get notified when an appointment is cancelled"
            >
              <Switch
                checked={internalAlerts.cancellation}
                onCheckedChange={(v) =>
                  setInternalAlerts({ ...internalAlerts, cancellation: v })
                }
              />
            </SettingRow>
            <SettingRow
              label="Low Inventory Alert"
              description="Get notified when product inventory is running low"
            >
              <Switch
                checked={internalAlerts.lowInventory}
                onCheckedChange={(v) =>
                  setInternalAlerts({ ...internalAlerts, lowInventory: v })
                }
              />
            </SettingRow>
            <SettingRow
              label="Daily Summary Email"
              description="Receive a daily summary of appointments and revenue"
            >
              <Switch
                checked={internalAlerts.dailySummary}
                onCheckedChange={(v) =>
                  setInternalAlerts({ ...internalAlerts, dailySummary: v })
                }
              />
            </SettingRow>
          </CardContent>
        </Card>
      </motion.div>

      <div className="flex justify-end">
        <Button onClick={handleSave}>
          <Save className="w-4 h-4 mr-2" />
          Save Changes
        </Button>
      </div>
    </div>
  )
}
