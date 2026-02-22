"use client"

import React from "react"
import { motion } from "framer-motion"
import { CreditCard, Gift, Users, DollarSign, TrendingDown } from "lucide-react"
import { Header } from "@/components/dashboard/header"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { MembershipsTab } from "@/components/memberships/memberships-tab"
import { GiftCardsTab } from "@/components/memberships/gift-cards-tab"
import { formatCurrency } from "@/lib/utils"
import type { GiftCard, Member } from "@/data/mock-memberships"

interface ClientOption {
  id: string
  name: string
}

interface MembershipsClientProps {
  stats: {
    totalMembers: number
    activeMembers: number
    mrr: number
    churnRate: number
    totalGiftCardsSold: number
    outstandingGiftCardBalance: number
  }
  giftCards: GiftCard[]
  clients: ClientOption[]
  members: Member[]
}

export function MembershipsClient(props: MembershipsClientProps) {
  const { stats, giftCards, clients, members } = props

  return (
    <div className="min-h-screen bg-cream">
      <Header
        title="Memberships & Gift Cards"
        subtitle="Manage membership plans, members, and gift cards"
      />

      <div className="p-6 space-y-6">
        {/* Top-level Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              label: "Total Members",
              value: stats.totalMembers,
              icon: Users,
              color: "text-blue-600",
              bg: "bg-blue-500/10",
            },
            {
              label: "Active Members",
              value: stats.activeMembers,
              icon: CreditCard,
              color: "text-emerald-600",
              bg: "bg-emerald-500/10",
            },
            {
              label: "Monthly Revenue",
              value: formatCurrency(stats.mrr),
              icon: DollarSign,
              color: "text-amber-600",
              bg: "bg-amber-500/10",
            },
            {
              label: "Churn Rate",
              value: `${stats.churnRate}%`,
              icon: TrendingDown,
              color: "text-red-600",
              bg: "bg-red-500/10",
            },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              whileHover={{ y: -2, boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}
              className="bg-card rounded-2xl p-4 border border-cream-200 shadow-sm card-warm transition-shadow"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${stat.bg}`}>
                  <stat.icon className={`w-4 h-4 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground font-medium">
                    {stat.label}
                  </p>
                  <p className="text-lg font-heading font-bold text-foreground">
                    {stat.value}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Tabs defaultValue="memberships" className="space-y-6">
            <TabsList>
              <TabsTrigger value="memberships" className="gap-2">
                <CreditCard className="w-4 h-4" />
                Memberships
              </TabsTrigger>
              <TabsTrigger value="gift-cards" className="gap-2">
                <Gift className="w-4 h-4" />
                Gift Cards
              </TabsTrigger>
            </TabsList>

            <TabsContent value="memberships">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
                <MembershipsTab members={members} stats={{ totalMembers: stats.totalMembers, activeMembers: stats.activeMembers, mrr: stats.mrr }} />
              </motion.div>
            </TabsContent>

            <TabsContent value="gift-cards">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
                <GiftCardsTab giftCards={giftCards} stats={{ totalGiftCardsSold: stats.totalGiftCardsSold, outstandingGiftCardBalance: stats.outstandingGiftCardBalance }} clients={clients} />
              </motion.div>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </div>
  )
}
