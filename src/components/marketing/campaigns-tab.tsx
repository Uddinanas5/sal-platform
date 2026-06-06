"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Megaphone, Send, BarChart3 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { CampaignCard } from "@/components/marketing/campaign-card"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { createCampaign, sendCampaign, updateCampaign } from "@/lib/actions/marketing"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

interface CampaignItem {
  id: string
  name: string
  subject: string
  body: string
  channel: string
  status: string
  audienceType: string
  scheduledAt: Date | null
  sentAt: Date | null
  recipientCount: number
  openCount: number
  clickCount: number
  bookingCount: number
  revenue: number
  createdAt: Date
}

interface CampaignStats {
  total: number
  active: number
  sent: number
  openRate: number
}

interface CampaignsTabProps {
  campaigns: CampaignItem[]
  stats: CampaignStats
}

// A campaign can only be edited before it has gone out. Sent/sending campaigns
// reflect what actually shipped and stay view-only (honest).
function isEditable(status: string): boolean {
  return status === "draft" || status === "scheduled"
}

export function CampaignsTab({ campaigns, stats }: CampaignsTabProps) {
  const router = useRouter()
  const [viewCampaign, setViewCampaign] = useState<CampaignItem | null>(null)
  const [editCampaign, setEditCampaign] = useState<CampaignItem | null>(null)
  const [draftName, setDraftName] = useState("")
  const [draftSubject, setDraftSubject] = useState("")
  const [draftBody, setDraftBody] = useState("")
  const [saving, setSaving] = useState(false)
  const [sendingId, setSendingId] = useState<string | null>(null)
  const totalSent = campaigns.reduce((sum, c) => sum + c.recipientCount, 0)

  // Real send via the sendCampaign action (consent-first audience, batched).
  // Confirm first — this emails real clients and cannot be unsent.
  const handleSend = async (campaign: CampaignItem) => {
    if (sendingId) return
    const confirmed = window.confirm(
      `Send "${campaign.name}" to all eligible clients now? This emails real clients and cannot be undone.`
    )
    if (!confirmed) return
    setSendingId(campaign.id)
    try {
      const result = await sendCampaign(campaign.id)
      if (result && "success" in result && result.success === false) {
        toast.error(result.error || "Failed to send campaign")
        return
      }
      const count =
        result && "data" in result && result.data && typeof result.data === "object" && "recipientCount" in result.data
          ? (result.data as { recipientCount: number }).recipientCount
          : undefined
      toast.success(
        count !== undefined
          ? `"${campaign.name}" sent to ${count} client${count === 1 ? "" : "s"}`
          : `"${campaign.name}" sent`
      )
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send campaign")
    } finally {
      setSendingId(null)
    }
  }

  const handleDuplicate = async (campaign: CampaignItem) => {
    try {
      await createCampaign({
        name: `${campaign.name} (Copy)`,
        subject: campaign.subject,
        body: campaign.body,
        channel: campaign.channel as "email" | "sms" | "both",
        audienceType: campaign.audienceType,
      })
      toast.success(`"${campaign.name}" duplicated`)
      router.refresh()
    } catch {
      toast.error("Failed to duplicate campaign")
    }
  }

  // Edit opens a real editor only for unsent campaigns; sent ones fall back to
  // the read-only detail view so the action never silently no-ops.
  const handleEdit = (campaign: CampaignItem) => {
    if (!isEditable(campaign.status)) {
      setViewCampaign(campaign)
      return
    }
    setEditCampaign(campaign)
    setDraftName(campaign.name)
    setDraftSubject(campaign.subject)
    setDraftBody(campaign.body)
  }

  const handleSaveEdit = async () => {
    if (!editCampaign) return
    if (draftName.trim().length === 0) {
      toast.error("Campaign name cannot be empty")
      return
    }
    if (draftBody.trim().length === 0) {
      toast.error("Message content cannot be empty")
      return
    }
    setSaving(true)
    try {
      const result = await updateCampaign(editCampaign.id, {
        name: draftName.trim(),
        subject: draftSubject.trim() || undefined,
        body: draftBody.trim(),
      })
      if (result && "success" in result && result.success === false) {
        toast.error(result.error || "Failed to save campaign")
        return
      }
      toast.success(`"${draftName.trim()}" saved`)
      setEditCampaign(null)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save campaign")
    } finally {
      setSaving(false)
    }
  }

  const statCards = [
    {
      label: "Active Campaigns",
      value: stats.active.toString(),
      icon: Megaphone,
    },
    {
      label: "Total Sent",
      value: totalSent.toLocaleString(),
      icon: Send,
    },
    {
      label: "Avg Open Rate",
      value: `${stats.openRate.toFixed(1)}%`,
      icon: BarChart3,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className="border-cream-200">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="p-3 rounded-xl bg-sal-100">
                  <stat.icon className="w-5 h-5 text-sal-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-xl font-heading font-bold text-foreground">
                    {stat.value}
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Campaign Cards Grid */}
      {campaigns.length === 0 ? (
        <EmptyState
          icon={<Megaphone className="w-7 h-7 text-sal-600" />}
          title="No campaigns yet"
          description="Create your first marketing campaign to reach your clients."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {campaigns.map((campaign, index) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              index={index}
              onView={setViewCampaign}
              onEdit={handleEdit}
              onDuplicate={handleDuplicate}
              onSend={handleSend}
              sending={sendingId === campaign.id}
            />
          ))}
        </div>
      )}

      {/* Campaign Detail Dialog */}
      {viewCampaign && (
        <Dialog open={!!viewCampaign} onOpenChange={(open) => { if (!open) setViewCampaign(null) }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{viewCampaign.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {viewCampaign.subject && (
                <div>
                  <p className="text-xs text-muted-foreground">Subject</p>
                  <p className="text-sm font-medium">{viewCampaign.subject}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">Message</p>
                <p className="text-sm whitespace-pre-wrap bg-cream-100 rounded-lg p-3 mt-1">{viewCampaign.body}</p>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-card border border-cream-200 rounded-lg p-3">
                  <p className="text-lg font-bold">{viewCampaign.recipientCount}</p>
                  <p className="text-xs text-muted-foreground">Recipients</p>
                </div>
                <div className="bg-card border border-cream-200 rounded-lg p-3">
                  <p className="text-lg font-bold">{viewCampaign.openCount}</p>
                  <p className="text-xs text-muted-foreground">Opens</p>
                </div>
                <div className="bg-card border border-cream-200 rounded-lg p-3">
                  <p className="text-lg font-bold">{viewCampaign.clickCount}</p>
                  <p className="text-xs text-muted-foreground">Clicks</p>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Campaign Edit Dialog (draft / scheduled only) */}
      {editCampaign && (
        <Dialog open={!!editCampaign} onOpenChange={(open) => { if (!open) setEditCampaign(null) }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-heading">Edit Campaign</DialogTitle>
              <DialogDescription>
                Update this campaign before it is sent. Audience: {editCampaign.audienceType}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Campaign Name</label>
                <Input
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  placeholder="e.g., Spring Sale Announcement"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Subject Line</label>
                <Input
                  value={draftSubject}
                  onChange={(e) => setDraftSubject(e.target.value)}
                  placeholder="e.g., Exclusive offer just for you!"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Message Content</label>
                <Textarea
                  value={draftBody}
                  onChange={(e) => setDraftBody(e.target.value)}
                  rows={6}
                  placeholder="Write your email content..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditCampaign(null)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
