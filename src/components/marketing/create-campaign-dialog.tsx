"use client"

import React, { useEffect, useState } from "react"
import { toast } from "sonner"
import { Check, ChevronLeft, ChevronRight, Mail } from "lucide-react"
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
import { createCampaign, getCampaignAudienceCounts } from "@/lib/actions/marketing"

interface CreateCampaignDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: () => void
}

type CampaignType = "email"
type AudienceOption = "All Clients" | "VIP Clients" | "Active Clients" | "Inactive Clients" | "Custom"
type ScheduleOption = "now" | "later"

const steps = [
  "Campaign Type",
  "Audience",
  "Content",
  "Schedule",
  "Review",
]

// Audience counts are loaded live per-business from getCampaignAudienceCounts
// (consent-first, the same where-clauses the real sender uses). "Custom" sends
// to all consented clients, so it is labelled honestly and shows no count.
type AudienceCountKey = "all" | "vip" | "active" | "inactive"
const audienceOptions: { label: AudienceOption; countKey: AudienceCountKey | null }[] = [
  { label: "All Clients", countKey: "all" },
  { label: "VIP Clients", countKey: "vip" },
  { label: "Active Clients", countKey: "active" },
  { label: "Inactive Clients", countKey: "inactive" },
  { label: "Custom", countKey: null },
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
  const [audienceCounts, setAudienceCounts] = useState<
    Record<AudienceCountKey, number> | null
  >(null)

  // Load real, consent-filtered audience counts when the dialog opens.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    getCampaignAudienceCounts().then((result) => {
      if (cancelled) return
      if (result.success) setAudienceCounts(result.data)
    })
    return () => {
      cancelled = true
    }
  }, [open])

  const countForKey = (key: AudienceCountKey | null): number | null =>
    key && audienceCounts ? audienceCounts[key] : null

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
          subject.trim().length > 0
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

      const result = await createCampaign({
        name: campaignName.trim(),
        subject: campaignType === "email" ? subject.trim() : undefined,
        body: content.trim(),
        channel: campaignType,
        audienceType: audience,
        scheduledAt,
      })

      if (result && "success" in result && result.success === false) {
        toast.error(result.error || "Failed to save campaign")
        return
      }

      // Creating a campaign only SAVES it — emailing is a deliberate, separate
      // step (click Send in the campaigns list). There is no scheduler that
      // auto-sends scheduled campaigns, so even a "scheduled" campaign still
      // needs a manual Send. Be explicit so the operator knows nothing went out.
      toast.success(
        scheduleOption === "now"
          ? "Campaign saved as a draft. Open it in the campaigns list and click Send to email your clients."
          : "Campaign scheduled. Open it in the campaigns list and click Send when you're ready."
      )
      onCreated?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save campaign")
    }
    handleClose(false)
  }

  const selectedAudienceCount = countForKey(
    audienceOptions.find((a) => a.label === audience)?.countKey ?? null
  )

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
              <div className="grid gap-3">
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
                        ? "text-mint"
                        : "text-muted-foreground/70"
                    )}
                  />
                  <span
                    className={cn(
                      "text-sm font-medium",
                      campaignType === "email"
                        ? "text-mint-soft"
                        : "text-muted-foreground"
                    )}
                  >
                    Email
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
            {audienceOptions.map((opt) => {
              const count = countForKey(opt.countKey)
              return (
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
                    <div>
                      <span
                        className={cn(
                          "text-sm font-medium block",
                          audience === opt.label
                            ? "text-mint-soft"
                            : "text-foreground"
                        )}
                      >
                        {opt.label}
                      </span>
                      {opt.countKey === null && (
                        <span className="text-xs text-muted-foreground/70">
                          Sends to all consented clients
                        </span>
                      )}
                    </div>
                  </div>
                  {opt.countKey !== null && (
                    <span className="text-sm text-muted-foreground/70">
                      {count === null
                        ? "…"
                        : `${count} ${count === 1 ? "client" : "clients"}`}
                    </span>
                  )}
                </button>
              )
            })}
            <p className="text-xs text-muted-foreground/70 pt-1">
              Counts reflect clients who have opted in to marketing email.
            </p>
          </div>
        )}

        {/* Step 3: Content */}
        {step === 2 && (
          <div className="space-y-4 py-2">
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
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Message Content
              </label>
              <Textarea
                placeholder="Write your email content..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={5}
              />
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
                      ? "text-mint-soft"
                      : "text-muted-foreground"
                  )}
                >
                  Save as Draft
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Saved to your campaigns list
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
                      ? "text-mint-soft"
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
                    "bg-blue-500/10 text-blue-300"
                  )}
                >
                  {campaignType}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Audience</span>
                <span className="text-sm font-medium text-foreground">
                  {selectedAudienceCount === null
                    ? audience
                    : `${audience} (${selectedAudienceCount})`}
                </span>
              </div>
              {subject && (
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
                    ? "Save as Draft"
                    : `${scheduleDate} at ${scheduleTime}`}
                </span>
              </div>
            </div>
            <div className="rounded-lg border border-cream-200 p-4">
              <p className="text-xs text-muted-foreground mb-1">Message Preview</p>
              <p className="text-sm text-foreground">{content}</p>
            </div>
            <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 dark:border-amber-500/30 dark:bg-amber-500/10 p-3">
              <p className="text-xs text-amber-300">
                This campaign will be saved to your campaigns list. No emails are
                sent yet — open it there and click Send to email your clients.
              </p>
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
              {scheduleOption === "now" ? "Save Campaign" : "Schedule Campaign"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
