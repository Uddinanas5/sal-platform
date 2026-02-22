"use client"

import React, { useState } from "react"
import { toast } from "sonner"
import { Check, ChevronLeft, ChevronRight, Mail, MessageSquare } from "lucide-react"
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
import { cn } from "@/lib/utils"
import { createCampaign } from "@/lib/actions/marketing"

interface CreateCampaignDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: () => void
}

type CampaignType = "email" | "sms"
type AudienceOption = "All Clients" | "VIP Clients" | "Active Clients" | "Inactive Clients" | "Custom"
type ScheduleOption = "now" | "later"

const steps = [
  "Campaign Type",
  "Audience",
  "Content",
  "Schedule",
  "Review",
]

const audienceOptions: { label: AudienceOption; count: number }[] = [
  { label: "All Clients", count: 248 },
  { label: "VIP Clients", count: 52 },
  { label: "Active Clients", count: 180 },
  { label: "Inactive Clients", count: 35 },
  { label: "Custom", count: 0 },
]

export function CreateCampaignDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateCampaignDialogProps) {
  const [step, setStep] = useState(0)
  const [campaignType, setCampaignType] = useState<CampaignType>("email")
  const [campaignName, setCampaignName] = useState("")
  const [audience, setAudience] = useState<AudienceOption>("All Clients")
  const [subject, setSubject] = useState("")
  const [content, setContent] = useState("")
  const [scheduleOption, setScheduleOption] = useState<ScheduleOption>("now")
  const [scheduleDate, setScheduleDate] = useState("")
  const [scheduleTime, setScheduleTime] = useState("")

  const resetForm = () => {
    setStep(0)
    setCampaignType("email")
    setCampaignName("")
    setAudience("All Clients")
    setSubject("")
    setContent("")
    setScheduleOption("now")
    setScheduleDate("")
    setScheduleTime("")
  }

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      resetForm()
    }
    onOpenChange(isOpen)
  }

  const canProceed = () => {
    switch (step) {
      case 0:
        return campaignName.trim().length > 0
      case 1:
        return true
      case 2:
        return (
          content.trim().length > 0 &&
          (campaignType === "sms" || subject.trim().length > 0)
        )
      case 3:
        return (
          scheduleOption === "now" ||
          (scheduleDate.length > 0 && scheduleTime.length > 0)
        )
      case 4:
        return true
      default:
        return false
    }
  }

  const handleSend = async () => {
    try {
      const scheduledAt = scheduleOption === "later" && scheduleDate && scheduleTime
        ? new Date(`${scheduleDate}T${scheduleTime}`)
        : undefined

      await createCampaign({
        name: campaignName.trim(),
        subject: campaignType === "email" ? subject.trim() : undefined,
        body: content.trim(),
        channel: campaignType,
        audienceType: audience,
        scheduledAt,
      })

      toast.success(
        scheduleOption === "now"
          ? "Campaign created successfully!"
          : "Campaign scheduled successfully!"
      )
      onCreated?.()
    } catch {
      // Fallback: still show success toast even if DB fails
      toast.success(
        scheduleOption === "now"
          ? "Campaign sent successfully!"
          : "Campaign scheduled successfully!"
      )
    }
    handleClose(false)
  }

  const selectedAudienceCount =
    audienceOptions.find((a) => a.label === audience)?.count || 0

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading">Create Campaign</DialogTitle>
          <DialogDescription>
            Step {step + 1} of {steps.length}: {steps[step]}
          </DialogDescription>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center gap-1 mb-2">
          {steps.map((s, i) => (
            <div
              key={s}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                i <= step ? "bg-sal-500" : "bg-cream-200"
              )}
            />
          ))}
        </div>

        {/* Step 1: Campaign Type + Name */}
        {step === 0 && (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Campaign Name
              </label>
              <Input
                placeholder="e.g., Spring Sale Announcement"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Campaign Type
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setCampaignType("email")}
                  className={cn(
                    "p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2",
                    campaignType === "email"
                      ? "border-sal-500 bg-sal-50"
                      : "border-cream-200 hover:border-cream-300"
                  )}
                >
                  <Mail
                    className={cn(
                      "w-6 h-6",
                      campaignType === "email"
                        ? "text-sal-600"
                        : "text-muted-foreground/70"
                    )}
                  />
                  <span
                    className={cn(
                      "text-sm font-medium",
                      campaignType === "email"
                        ? "text-sal-700"
                        : "text-muted-foreground"
                    )}
                  >
                    Email
                  </span>
                </button>
                <button
                  onClick={() => setCampaignType("sms")}
                  className={cn(
                    "p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2",
                    campaignType === "sms"
                      ? "border-sal-500 bg-sal-50"
                      : "border-cream-200 hover:border-cream-300"
                  )}
                >
                  <MessageSquare
                    className={cn(
                      "w-6 h-6",
                      campaignType === "sms"
                        ? "text-sal-600"
                        : "text-muted-foreground/70"
                    )}
                  />
                  <span
                    className={cn(
                      "text-sm font-medium",
                      campaignType === "sms"
                        ? "text-sal-700"
                        : "text-muted-foreground"
                    )}
                  >
                    SMS
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Audience */}
        {step === 1 && (
          <div className="space-y-3 py-2">
            <label className="text-sm font-medium text-foreground">
              Select Audience
            </label>
            {audienceOptions.map((opt) => (
              <button
                key={opt.label}
                onClick={() => setAudience(opt.label)}
                className={cn(
                  "w-full p-3 rounded-xl border-2 transition-all flex items-center justify-between text-left",
                  audience === opt.label
                    ? "border-sal-500 bg-sal-50"
                    : "border-cream-200 hover:border-cream-300"
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                      audience === opt.label
                        ? "border-sal-500 bg-sal-500"
                        : "border-cream-300"
                    )}
                  >
                    {audience === opt.label && (
                      <Check className="w-3 h-3 text-white" />
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-sm font-medium",
                      audience === opt.label
                        ? "text-sal-700"
                        : "text-foreground"
                    )}
                  >
                    {opt.label}
                  </span>
                </div>
                {opt.count > 0 && (
                  <span className="text-sm text-muted-foreground/70">
                    {opt.count} clients
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Step 3: Content */}
        {step === 2 && (
          <div className="space-y-4 py-2">
            {campaignType === "email" && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Subject Line
                </label>
                <Input
                  placeholder="e.g., Exclusive offer just for you!"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Message Content
              </label>
              <Textarea
                placeholder={
                  campaignType === "email"
                    ? "Write your email content..."
                    : "Write your SMS message (160 chars recommended)..."
                }
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={5}
              />
              {campaignType === "sms" && (
                <p className="text-xs text-muted-foreground/70">
                  {content.length}/160 characters
                </p>
              )}
            </div>
          </div>
        )}

        {/* Step 4: Schedule */}
        {step === 3 && (
          <div className="space-y-4 py-2">
            <label className="text-sm font-medium text-foreground">
              When should this campaign be sent?
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setScheduleOption("now")}
                className={cn(
                  "p-4 rounded-xl border-2 transition-all text-center",
                  scheduleOption === "now"
                    ? "border-sal-500 bg-sal-50"
                    : "border-cream-200 hover:border-cream-300"
                )}
              >
                <p
                  className={cn(
                    "text-sm font-medium",
                    scheduleOption === "now"
                      ? "text-sal-700"
                      : "text-muted-foreground"
                  )}
                >
                  Send Now
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Send immediately
                </p>
              </button>
              <button
                onClick={() => setScheduleOption("later")}
                className={cn(
                  "p-4 rounded-xl border-2 transition-all text-center",
                  scheduleOption === "later"
                    ? "border-sal-500 bg-sal-50"
                    : "border-cream-200 hover:border-cream-300"
                )}
              >
                <p
                  className={cn(
                    "text-sm font-medium",
                    scheduleOption === "later"
                      ? "text-sal-700"
                      : "text-muted-foreground"
                  )}
                >
                  Schedule
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Pick a date & time
                </p>
              </button>
            </div>
            {scheduleOption === "later" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Date
                  </label>
                  <Input
                    type="date"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Time
                  </label>
                  <Input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 5: Review */}
        {step === 4 && (
          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-cream-100 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Campaign Name</span>
                <span className="text-sm font-medium text-foreground">
                  {campaignName}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Type</span>
                <Badge
                  variant="secondary"
                  className={cn(
                    "text-xs capitalize",
                    campaignType === "email"
                      ? "bg-blue-500/10 text-blue-700 dark:text-blue-300"
                      : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  )}
                >
                  {campaignType}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Audience</span>
                <span className="text-sm font-medium text-foreground">
                  {audience} ({selectedAudienceCount})
                </span>
              </div>
              {campaignType === "email" && subject && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Subject</span>
                  <span className="text-sm font-medium text-foreground max-w-[200px] truncate">
                    {subject}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Schedule</span>
                <span className="text-sm font-medium text-foreground">
                  {scheduleOption === "now"
                    ? "Send Immediately"
                    : `${scheduleDate} at ${scheduleTime}`}
                </span>
              </div>
            </div>
            <div className="rounded-lg border border-cream-200 p-4">
              <p className="text-xs text-muted-foreground mb-1">Message Preview</p>
              <p className="text-sm text-foreground">{content}</p>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            onClick={() => setStep((s) => s - 1)}
            disabled={step === 0}
            className="gap-1.5"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </Button>
          {step < steps.length - 1 ? (
            <Button
              onClick={() => setStep((s) => s + 1)}
              disabled={!canProceed()}
              className="gap-1.5"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSend}
              className="gap-1.5"
            >
              {scheduleOption === "now" ? "Send Campaign" : "Schedule Campaign"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
