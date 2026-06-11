"use client"

import React from "react"
import { motion } from "framer-motion"
import {
  Mail,
  MessageSquare,
  BellRing,
  Info,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import type { NotificationSettings } from "@/lib/actions/settings"

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
    <>
      <div className="flex items-center justify-between py-4">
        <div className="space-y-0.5">
          <p className="text-sm font-medium text-foreground">{label}</p>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {children}
      </div>
      <div aria-hidden className="hairline-fade last:hidden" />
    </>
  )
}

const defaultEmailTemplates: NotificationSettings["emailTemplates"] = {
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

const defaultInternalAlerts: NotificationSettings["internalAlerts"] = {
  newBooking: true,
  cancellation: true,
  lowInventory: false,
  dailySummary: true,
}

interface NotificationsSettingsTabProps {
  initialSettings?: NotificationSettings
}

export function NotificationsSettingsTab({ initialSettings }: NotificationsSettingsTabProps) {
  // Templates and internal alerts are read-only for now (see "coming soon"
  // notices below). We display the current/default values without allowing
  // edits, because no send path consumes settings-level customizations yet.
  const emailTemplates = initialSettings?.emailTemplates ?? defaultEmailTemplates
  const internalAlerts = initialSettings?.internalAlerts ?? defaultInternalAlerts

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
              <Mail className="w-5 h-5 text-mint-strong" />
              Email Notifications
            </CardTitle>
            <CardDescription>
              Booking confirmations and cancellation emails are sent automatically using our standard templates.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-400/10 border border-amber-400/30">
              <Info className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <div className="text-sm text-amber-300">
                <p className="font-medium mb-1">Custom email templates — coming soon</p>
                <p>
                  You&apos;ll be able to fully customize the wording of each client
                  email here. For now, the system sends a polished default
                  template for each event below.
                </p>
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
                    rows={10}
                    readOnly
                    disabled
                    className="font-mono text-sm opacity-70"
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
                    rows={10}
                    readOnly
                    disabled
                    className="font-mono text-sm opacity-70"
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
                    rows={10}
                    readOnly
                    disabled
                    className="font-mono text-sm opacity-70"
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
                    rows={8}
                    readOnly
                    disabled
                    className="font-mono text-sm opacity-70"
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
              <MessageSquare className="w-5 h-5 text-mint-strong" />
              SMS Notifications
            </CardTitle>
            <CardDescription>
              SMS delivery requires provider setup and compliance approval before it can be enabled.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-300">
              SMS is disabled for beta. Email confirmations and staff invitations are available now.
            </div>
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
              <BellRing className="w-5 h-5 text-mint-strong" />
              Internal Alerts
            </CardTitle>
            <CardDescription>
              Notifications sent to you and your team
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="flex items-start gap-2 p-3 mb-2 rounded-lg bg-amber-400/10 border border-amber-400/30">
              <Info className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <div className="text-sm text-amber-300">
                <p className="font-medium mb-1">Coming soon</p>
                <p>
                  Configurable team alerts and the daily summary email are on the
                  way. In the meantime, new bookings, payments and low-stock items
                  show up live in your notification bell.
                </p>
              </div>
            </div>
            <SettingRow
              label="New Booking Alert"
              description="Get notified when a new appointment is booked"
            >
              <Switch checked={internalAlerts.newBooking} disabled />
            </SettingRow>
            <SettingRow
              label="Cancellation Alert"
              description="Get notified when an appointment is cancelled"
            >
              <Switch checked={internalAlerts.cancellation} disabled />
            </SettingRow>
            <SettingRow
              label="Low Inventory Alert"
              description="Get notified when product inventory is running low"
            >
              <Switch checked={internalAlerts.lowInventory} disabled />
            </SettingRow>
            <SettingRow
              label="Daily Summary Email"
              description="Receive a daily summary of appointments and revenue"
            >
              <Switch checked={internalAlerts.dailySummary} disabled />
            </SettingRow>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
