"use client"

import React, { useState } from "react"
import { motion } from "framer-motion"
import { Eye, Pencil, Clock, Mail, MessageSquare } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { toggleAutomatedMessage, updateAutomatedMessage } from "@/lib/actions/marketing"

interface MessageItem {
  id: string
  name: string
  trigger: string
  channel: string
  subject: string
  body: string
  delayHours: number
  isActive: boolean
  sendCount: number
  createdAt: Date
}

const triggerLabels: Record<string, string> = {
  appointment_reminder: "Appointment Reminder",
  follow_up: "Post-Visit Follow Up",
  birthday: "Birthday Greeting",
  no_show: "No-Show Follow Up",
  welcome: "Welcome Message",
  reactivation: "Re-engagement",
  booking_confirmation: "Booking Confirmation",
  thank_you: "Thank You",
  no_show_followup: "No-Show Follow Up",
  rebooking_reminder: "Rebooking Reminder",
  win_back: "Win Back",
  review_request: "Review Request",
}

const triggerDescriptions: Record<string, string> = {
  appointment_reminder:
    "Sent before a scheduled appointment to remind the client.",
  follow_up:
    "Sent after a completed visit to request feedback and reviews.",
  birthday: "Sent on the client's birthday with a special offer.",
  no_show:
    "Sent when a client misses their appointment without cancelling.",
  welcome:
    "Sent when a new client is added to the system for the first time.",
  reactivation:
    "Sent to clients who have not visited in a specified number of days.",
  booking_confirmation: "Sent immediately after a booking is confirmed.",
  thank_you: "Sent after the appointment to thank the client.",
  no_show_followup: "Sent when a client misses their appointment without cancelling.",
  rebooking_reminder: "Sent to remind clients to rebook their next appointment.",
  win_back: "Sent to win back clients who haven't visited recently.",
  review_request: "Sent to request a review after a visit.",
}

const channelBadgeColors: Record<string, string> = {
  email: "bg-blue-400/15 text-blue-300 border border-blue-400/25",
  sms: "bg-emerald-400/15 text-emerald-300 border border-emerald-400/25",
  both: "bg-purple-400/15 text-purple-300 border border-purple-400/25",
}

// Only these three triggers are actually evaluated by the daily automation
// engine (see DAILY_TRIGGERS in src/lib/automation/automated-messages.ts).
// Their activate switch + editable template genuinely change what the engine
// sends, so they stay interactive.
const ENGINE_TRIGGERS = new Set(["birthday", "win_back", "rebooking_reminder"])

// These triggers are NOT run by this engine, but ARE handled elsewhere by the
// appointment lifecycle / reminder cron — their template here is informational
// only (the reminder system, not this row's toggle, controls delivery).
const SYSTEM_HANDLED_TRIGGERS = new Set([
  "appointment_reminder",
  "booking_confirmation",
])

// Anything else listed here has no automation wired yet.
type TriggerStatus = "engine" | "system" | "coming_soon"
function triggerStatus(trigger: string): TriggerStatus {
  if (ENGINE_TRIGGERS.has(trigger)) return "engine"
  if (SYSTEM_HANDLED_TRIGGERS.has(trigger)) return "system"
  return "coming_soon"
}

const statusNote: Record<Exclude<TriggerStatus, "engine">, string> = {
  system: "Sent automatically by the reminder system",
  coming_soon: "Not yet automated — coming soon",
}

function highlightMergeFields(text: string): React.ReactNode[] {
  const parts = text.split(/(\{[^}]+\})/g)
  return parts.map((part, i) => {
    if (part.match(/^\{[^}]+\}$/)) {
      return (
        <span
          key={i}
          className="px-1 py-0.5 rounded bg-sal-100 text-mint-soft text-xs font-mono font-medium"
        >
          {part}
        </span>
      )
    }
    return <span key={i}>{part}</span>
  })
}

function formatDelayHours(hours: number): string {
  if (hours === 0) return "Immediately"
  if (hours < 0) return `${Math.abs(hours)} hours before`
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} after`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? "" : "s"} after`
}

interface AutomatedMessagesTabProps {
  messages: MessageItem[]
}

export function AutomatedMessagesTab({ messages: initialMessages }: AutomatedMessagesTabProps) {
  const [messages, setMessages] = useState<MessageItem[]>(initialMessages)
  const [editMessage, setEditMessage] = useState<MessageItem | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [draftSubject, setDraftSubject] = useState("")
  const [draftBody, setDraftBody] = useState("")
  const [saving, setSaving] = useState(false)

  // The activate/deactivate toggle persists via `toggleAutomatedMessage`. The
  // edit dialog persists subject/body via `updateAutomatedMessage` for email
  // messages — but ONLY for engine-driven triggers, since editing the template
  // of a trigger the engine never sends would be a no-op for clients. SMS rows
  // and non-engine triggers open read-only.
  const editable =
    editMessage?.channel === "email" &&
    !!editMessage &&
    triggerStatus(editMessage.trigger) === "engine"

  const handleToggle = async (messageId: string, checked: boolean) => {
    const msg = messages.find((m) => m.id === messageId)
    if (checked && msg?.channel !== "email") {
      toast.error("SMS automation is disabled for beta")
      return
    }

    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, isActive: checked } : m
      )
    )
    try {
      const result = await toggleAutomatedMessage(messageId, checked)
      if (result?.success === false) throw new Error(result.error)
    } catch (error) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, isActive: !checked } : m
        )
      )
      toast.error(error instanceof Error ? error.message : "Failed to update automation")
      return
    }
    toast.success(
      checked
        ? `"${msg?.name}" activated`
        : `"${msg?.name}" deactivated`
    )
  }

  const handleEdit = (message: MessageItem) => {
    setEditMessage(message)
    setDraftSubject(message.subject)
    setDraftBody(message.body)
    setEditOpen(true)
  }

  const handleSave = async () => {
    if (!editMessage) return
    if (editMessage.channel !== "email") {
      toast.error("SMS automation is disabled for beta")
      return
    }
    if (triggerStatus(editMessage.trigger) !== "engine") {
      toast.error("This message is not editable yet")
      return
    }
    if (draftBody.trim().length === 0) {
      toast.error("Message content cannot be empty")
      return
    }
    setSaving(true)
    try {
      const result = await updateAutomatedMessage(editMessage.id, {
        subject: draftSubject.trim() || undefined,
        body: draftBody.trim(),
      })
      if (result?.success === false) {
        toast.error(result.error || "Failed to save template")
        return
      }
      setMessages((prev) =>
        prev.map((m) =>
          m.id === editMessage.id
            ? { ...m, subject: draftSubject.trim(), body: draftBody.trim() }
            : m
        )
      )
      toast.success(`"${editMessage.name}" template saved`)
      setEditOpen(false)
      setEditMessage(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save template")
    } finally {
      setSaving(false)
    }
  }

  // Only engine-driven triggers can be meaningfully "active" — they're the ones
  // the daily automation actually evaluates and sends.
  const engineMessages = messages.filter((m) => triggerStatus(m.trigger) === "engine")

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {engineMessages.filter((m) => m.isActive).length} of {engineMessages.length}{" "}
        automations active
      </p>

      {/* Message List */}
      <div className="space-y-3">
        {messages.map((message, index) => (
          <motion.div
            key={message.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Card variant="tile" className="hover:shadow-md transition-all">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    {/* Icon */}
                    <div className="p-2.5 rounded-xl bg-sal-100 shrink-0">
                      {message.channel === "email" ? (
                        <Mail className="w-4 h-4 text-mint" />
                      ) : (
                        <MessageSquare className="w-4 h-4 text-mint" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-foreground truncate">
                          {triggerLabels[message.trigger] || message.name}
                        </h3>
                        <Badge
                          variant="secondary"
                          className={`text-xs capitalize shrink-0 ${channelBadgeColors[message.channel] || ""}`}
                        >
                          {message.channel}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-3 h-3 text-muted-foreground/70 shrink-0" />
                        <span className="text-xs text-muted-foreground">
                          {formatDelayHours(message.delayHours)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    {(() => {
                      const status = triggerStatus(message.trigger)
                      const isEngine = status === "engine"
                      // Only engine triggers can be edited/toggled — they're the
                      // only ones whose template + on/off here actually affect
                      // what gets sent. Everything else is preview-only with an
                      // honest status so owners aren't misled.
                      const canEdit = isEngine && message.channel === "email"
                      return (
                        <>
                          {status !== "engine" && (
                            <span className="text-xs text-muted-foreground/80 text-right max-w-[160px]">
                              {statusNote[status]}
                            </span>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(message)}
                            className="gap-1.5"
                          >
                            {canEdit ? (
                              <>
                                <Pencil className="w-3.5 h-3.5" />
                                Edit
                              </>
                            ) : (
                              <>
                                <Eye className="w-3.5 h-3.5" />
                                Preview
                              </>
                            )}
                          </Button>
                          {isEngine ? (
                            <Switch
                              checked={message.isActive}
                              disabled={message.channel !== "email"}
                              onCheckedChange={(checked) =>
                                handleToggle(message.id, checked)
                              }
                            />
                          ) : (
                            <Switch checked={false} disabled aria-label="Not editable" />
                          )}
                        </>
                      )
                    })()}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Edit Dialog */}
      <Dialog
        open={editOpen}
        onOpenChange={(v) => {
          setEditOpen(v)
          if (!v) setEditMessage(null)
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              {editable ? "Edit Template" : "Message Template"}
              {!editable && (
                <Badge variant="secondary" className="text-xs">
                  Preview
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              {editMessage
                ? triggerDescriptions[editMessage.trigger] ||
                  (editable ? "Edit the subject and message content." : "Preview the message template.")
                : "Preview the message template."}
            </DialogDescription>
          </DialogHeader>

          {editMessage && (
            <div className="space-y-4 py-2">
              {/* Template Name (read-only) */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Template Name
                </label>
                <div className="flex items-center h-10 px-3 rounded-lg border border-input bg-cream-50 text-sm text-muted-foreground">
                  {editMessage.name}
                </div>
              </div>

              {/* Trigger + Channel Info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Channel
                  </label>
                  <div className="flex items-center gap-2 h-10 px-3 rounded-lg border border-input bg-cream-50">
                    {editMessage.channel === "email" ? (
                      <Mail className="w-4 h-4 text-muted-foreground/70" />
                    ) : (
                      <MessageSquare className="w-4 h-4 text-muted-foreground/70" />
                    )}
                    <span className="text-sm capitalize text-muted-foreground">
                      {editMessage.channel}
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Delay
                  </label>
                  <div className="flex items-center gap-2 h-10 px-3 rounded-lg border border-input bg-cream-50">
                    <Clock className="w-4 h-4 text-muted-foreground/70" />
                    <span className="text-sm text-muted-foreground">
                      {formatDelayHours(editMessage.delayHours)}
                    </span>
                  </div>
                </div>
              </div>

              {editable ? (
                <>
                  {/* Subject (editable, email only) */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Subject Line
                    </label>
                    <Input
                      value={draftSubject}
                      onChange={(e) => setDraftSubject(e.target.value)}
                      placeholder="e.g., Happy Birthday from {businessName}!"
                    />
                  </div>

                  {/* Content (editable) */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Message Content
                    </label>
                    <Textarea
                      value={draftBody}
                      onChange={(e) => setDraftBody(e.target.value)}
                      rows={6}
                      placeholder="Write your message..."
                    />
                    <p className="text-xs text-muted-foreground">
                      Merge fields like{" "}
                      <span className="px-1 py-0.5 rounded bg-sal-100 text-mint-soft text-xs font-mono">{"{firstName}"}</span>{" "}
                      and{" "}
                      <span className="px-1 py-0.5 rounded bg-sal-100 text-mint-soft text-xs font-mono">{"{businessName}"}</span>{" "}
                      are replaced for each client.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  {/* Subject (read-only preview) */}
                  {editMessage.subject && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">
                        Subject Line
                      </label>
                      <div className="flex items-center min-h-10 px-3 py-2 rounded-lg border border-input bg-cream-50 text-sm text-muted-foreground">
                        {editMessage.subject}
                      </div>
                    </div>
                  )}

                  {/* Content (read-only preview) */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Message Content
                    </label>
                    <div className="rounded-lg bg-cream-100 p-3 text-sm leading-relaxed">
                      {highlightMergeFields(editMessage.body)}
                    </div>
                  </div>

                  {/* Read-only notice — reason depends on why it can't be edited */}
                  <div className="rounded-lg border border-cream-200 bg-cream-50 p-3">
                    <p className="text-xs text-muted-foreground">
                      {editMessage.channel !== "email"
                        ? "SMS automation is disabled for beta, so this template is read-only."
                        : triggerStatus(editMessage.trigger) === "system"
                          ? "This message is sent automatically by the reminder system, so its template is managed there and shown here read-only."
                          : "This automation isn't available yet — coming soon. The template is shown read-only for now."}
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setEditOpen(false)
                setEditMessage(null)
              }}
            >
              {editable ? "Cancel" : "Close"}
            </Button>
            {editable && (
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save Template"}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
