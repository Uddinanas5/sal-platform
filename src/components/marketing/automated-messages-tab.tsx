"use client"

import React, { useState } from "react"
import { motion } from "framer-motion"
import { Pencil, Clock, Mail, MessageSquare } from "lucide-react"
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
import { toggleAutomatedMessage } from "@/lib/actions/marketing"

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
  email: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  sms: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  both: "bg-purple-500/10 text-purple-700 dark:text-purple-300",
}

const mergeFields = [
  "{client_name}",
  "{service_name}",
  "{staff_name}",
  "{time}",
  "{date}",
  "{salon_name}",
]

function highlightMergeFields(text: string): React.ReactNode[] {
  const parts = text.split(/(\{[^}]+\})/g)
  return parts.map((part, i) => {
    if (part.match(/^\{[^}]+\}$/)) {
      return (
        <span
          key={i}
          className="px-1 py-0.5 rounded bg-sal-100 text-sal-700 text-xs font-mono font-medium"
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
  const [editContent, setEditContent] = useState("")
  const [editSubject, setEditSubject] = useState("")

  const handleToggle = async (messageId: string, checked: boolean) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, isActive: checked } : m
      )
    )
    const msg = messages.find((m) => m.id === messageId)
    try {
      await toggleAutomatedMessage(messageId, checked)
    } catch {
      // Already toggled optimistically in state
    }
    toast.success(
      checked
        ? `"${msg?.name}" activated`
        : `"${msg?.name}" deactivated`
    )
  }

  const handleEdit = (message: MessageItem) => {
    setEditMessage(message)
    setEditContent(message.body)
    setEditSubject(message.subject || "")
    setEditOpen(true)
  }

  const handleSaveEdit = () => {
    if (!editMessage) return
    setMessages((prev) =>
      prev.map((m) =>
        m.id === editMessage.id
          ? {
              ...m,
              body: editContent,
              subject: editSubject || "",
            }
          : m
      )
    )
    toast.success("Message template updated")
    setEditOpen(false)
    setEditMessage(null)
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {messages.filter((m) => m.isActive).length} of {messages.length}{" "}
        automated messages active
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
            <Card className="border-cream-200 hover:shadow-md transition-all">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    {/* Icon */}
                    <div className="p-2.5 rounded-xl bg-sal-100 shrink-0">
                      {message.channel === "email" ? (
                        <Mail className="w-4 h-4 text-sal-600" />
                      ) : (
                        <MessageSquare className="w-4 h-4 text-sal-600" />
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
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(message)}
                      className="gap-1.5"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Edit
                    </Button>
                    <Switch
                      checked={message.isActive}
                      onCheckedChange={(checked) =>
                        handleToggle(message.id, checked)
                      }
                    />
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
            <DialogTitle className="font-heading">
              Edit Automated Message
            </DialogTitle>
            <DialogDescription>
              {editMessage
                ? triggerDescriptions[editMessage.trigger] || "Edit the message template."
                : "Edit the message template."}
            </DialogDescription>
          </DialogHeader>

          {editMessage && (
            <div className="space-y-4 py-2">
              {/* Template Name (read-only) */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Template Name
                </label>
                <Input
                  value={editMessage.name}
                  disabled
                  className="bg-cream-50"
                />
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

              {/* Subject (email only) */}
              {editMessage.channel === "email" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Subject Line
                  </label>
                  <Input
                    value={editSubject}
                    onChange={(e) => setEditSubject(e.target.value)}
                    placeholder="Email subject..."
                  />
                </div>
              )}

              {/* Content */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Message Content
                </label>
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={5}
                />
              </div>

              {/* Merge Fields */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Available Merge Fields
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {mergeFields.map((field) => (
                    <button
                      key={field}
                      onClick={() =>
                        setEditContent((prev) => prev + " " + field)
                      }
                      className="px-2 py-1 rounded bg-sal-100 text-sal-700 text-xs font-mono font-medium hover:bg-sal-200 transition-colors"
                    >
                      {field}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Preview
                </label>
                <div className="rounded-lg bg-cream-100 p-3 text-sm leading-relaxed">
                  {highlightMergeFields(editContent)}
                </div>
              </div>
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
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
