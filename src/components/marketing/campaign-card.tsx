"use client"

import React from "react"
import { motion } from "framer-motion"
import { Copy, Eye, Pencil, Users } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatDate } from "@/lib/utils"
import { toast } from "sonner"

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

interface CampaignCardProps {
  campaign: CampaignItem
  index: number
}

const typeBadgeColors: Record<string, string> = {
  email: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  sms: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  push: "bg-purple-500/10 text-purple-700 dark:text-purple-300",
  both: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
}

const statusDotColors: Record<string, string> = {
  draft: "bg-muted-foreground/40",
  scheduled: "bg-blue-500",
  active: "bg-emerald-500",
  sent: "bg-emerald-500",
  completed: "bg-muted-foreground/40",
  paused: "bg-amber-500",
}

const statusBadgeColors: Record<string, string> = {
  draft: "bg-cream-100 text-foreground dark:bg-muted",
  scheduled: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  active: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  sent: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  completed: "bg-cream-100 text-muted-foreground dark:bg-muted",
  paused: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
}

export function CampaignCard({ campaign, index }: CampaignCardProps) {
  const openRate = campaign.recipientCount > 0
    ? Math.round((campaign.openCount / campaign.recipientCount) * 1000) / 10
    : 0
  const clickRate = campaign.recipientCount > 0
    ? Math.round((campaign.clickCount / campaign.recipientCount) * 1000) / 10
    : 0

  const dateDisplay = campaign.sentAt
    ? `Completed ${formatDate(campaign.sentAt)}`
    : campaign.scheduledAt
      ? `Scheduled ${formatDate(campaign.scheduledAt)}`
      : `Created ${formatDate(campaign.createdAt)}`

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card className="border-cream-200 hover:shadow-md transition-all relative overflow-hidden cursor-pointer">
        {/* Status Dot */}
        <div className="absolute top-4 right-4">
          <span
            className={`block w-2.5 h-2.5 rounded-full ${statusDotColors[campaign.status] || "bg-muted-foreground/40"} ${
              campaign.status === "active" || campaign.status === "sent" ? "animate-pulse" : ""
            }`}
          />
        </div>

        <CardContent className="p-5">
          {/* Name + Type */}
          <div className="mb-3 pr-6">
            <h3 className="font-semibold text-foreground mb-1.5">
              {campaign.name}
            </h3>
            <div className="flex items-center gap-2">
              <Badge
                variant="secondary"
                className={`text-xs capitalize ${typeBadgeColors[campaign.channel] || ""}`}
              >
                {campaign.channel}
              </Badge>
              <Badge
                variant="secondary"
                className={`text-xs capitalize ${statusBadgeColors[campaign.status] || ""}`}
              >
                {campaign.status}
              </Badge>
            </div>
          </div>

          {/* Audience */}
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-3">
            <Users className="w-3.5 h-3.5 text-muted-foreground/70" />
            <span>
              {campaign.audienceType} ({campaign.recipientCount.toLocaleString()})
            </span>
          </div>

          {/* Metrics (if sent > 0) */}
          {campaign.recipientCount > 0 && (campaign.status === "sent" || campaign.status === "active" || campaign.status === "completed") && (
            <div className="grid grid-cols-3 gap-2 mb-3 p-3 rounded-lg bg-cream-50">
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground">
                  {campaign.recipientCount.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">Sent</p>
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-sal-600">
                  {openRate}%
                </p>
                <p className="text-xs text-muted-foreground">Open Rate</p>
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-sal-600">
                  {clickRate}%
                </p>
                <p className="text-xs text-muted-foreground">Click Rate</p>
              </div>
            </div>
          )}

          {/* Date */}
          <p className="text-xs text-muted-foreground/70 mb-3">{dateDisplay}</p>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => toast.info("Viewing campaign details")}
            >
              <Eye className="w-3.5 h-3.5" />
              View
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => toast.info("Editing campaign")}
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => toast.success("Campaign duplicated")}
            >
              <Copy className="w-3.5 h-3.5" />
              Duplicate
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
