"use client"

import React, { useState } from "react"
import { motion } from "framer-motion"
import { Plus } from "lucide-react"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { CampaignsTab } from "@/components/marketing/campaigns-tab"
import { DealsTab } from "@/components/marketing/deals-tab"
import { AutomatedMessagesTab } from "@/components/marketing/automated-messages-tab"
import { CreateCampaignDialog } from "@/components/marketing/create-campaign-dialog"

export interface CampaignItem {
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

export interface DealItem {
  id: string
  name: string
  description: string
  discountType: string
  discountValue: number
  code: string
  status: string
  appliesTo: string
  serviceIds: string[]
  usageLimit: number | null
  usageCount: number
  validFrom: Date
  validUntil: Date
  createdAt: Date
}

export interface MessageItem {
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

export interface CampaignStats {
  total: number
  active: number
  sent: number
  openRate: number
}

interface MarketingClientProps {
  campaigns: CampaignItem[]
  deals: DealItem[]
  automatedMessages: MessageItem[]
  campaignStats: CampaignStats
}

export function MarketingClient({ campaigns, deals, automatedMessages, campaignStats }: MarketingClientProps) {
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <div className="min-h-screen bg-cream">
      <Header title="Marketing" subtitle="Campaigns, deals & automation" />

      <div className="p-6 space-y-6">
        {/* Top Action Bar */}
        <div className="flex items-center justify-between">
          <div />
          <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus className="w-4 h-4" />
            Create Campaign
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="campaigns" className="space-y-6">
          <TabsList>
            <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
            <TabsTrigger value="deals">Deals & Promotions</TabsTrigger>
            <TabsTrigger value="automated">Automated Messages</TabsTrigger>
          </TabsList>

          <TabsContent value="campaigns">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
              <CampaignsTab campaigns={campaigns} stats={campaignStats} />
            </motion.div>
          </TabsContent>

          <TabsContent value="deals">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
              <DealsTab deals={deals} />
            </motion.div>
          </TabsContent>

          <TabsContent value="automated">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
              <AutomatedMessagesTab messages={automatedMessages} />
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Create Campaign Dialog */}
      <CreateCampaignDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}
