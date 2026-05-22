"use client"

import React, { useState } from "react"
import { motion } from "framer-motion"
import { Megaphone, Send, BarChart3 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { CampaignCard } from "@/components/marketing/campaign-card"
import { EmptyState } from "@/components/shared/empty-state"
import { createCampaign } from "@/lib/actions/marketing"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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

export function CampaignsTab({ campaigns, stats }: CampaignsTabProps) {
  const [viewCampaign, setViewCampaign] = useState<CampaignItem | null>(null)
  const totalSent = campaigns.reduce((sum, c) => sum + c.recipientCount, 0)

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
    } catch {
      toast.error("Failed to duplicate campaign")
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
              onEdit={setViewCampaign}
              onDuplicate={handleDuplicate}
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
    </div>
  )
}
