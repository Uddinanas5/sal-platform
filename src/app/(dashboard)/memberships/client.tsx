"use client"

import React from "react"
import { motion } from "framer-motion"
import { Gift, DollarSign } from "lucide-react"
import { Header } from "@/components/dashboard/header"
import { GiftCardsTab } from "@/components/memberships/gift-cards-tab"
import { formatCurrency } from "@/lib/utils"
import type { GiftCard } from "@/data/mock-memberships"

interface ClientOption {
  id: string
  name: string
}

interface MembershipsClientProps {
  stats: {
    totalGiftCardsSold: number
    outstandingGiftCardBalance: number
  }
  giftCards: GiftCard[]
  clients: ClientOption[]
}

export function MembershipsClient(props: MembershipsClientProps) {
  const { stats, giftCards, clients } = props

  return (
    <div className="min-h-screen bg-cream">
      <Header title="Gift Cards" subtitle="Issue and track gift cards" />

      <div className="p-6 space-y-6">
        {/* Gift-card stats */}
        <div className="grid grid-cols-2 gap-4 max-w-lg">
          {[
            {
              label: "Gift Cards Sold",
              value: stats.totalGiftCardsSold,
              icon: Gift,
              color: "text-emerald-400",
              bg: "bg-emerald-500/10",
            },
            {
              label: "Outstanding Balance",
              value: formatCurrency(stats.outstandingGiftCardBalance),
              icon: DollarSign,
              color: "text-amber-400",
              bg: "bg-amber-500/10",
            },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="glass-tile rounded-tile p-4 card-warm transition-shadow"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${stat.bg}`}>
                  <stat.icon className={`w-4 h-4 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground font-medium">{stat.label}</p>
                  <p className="text-lg font-heading font-bold text-foreground">{stat.value}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <GiftCardsTab
            giftCards={giftCards}
            stats={{
              totalGiftCardsSold: stats.totalGiftCardsSold,
              outstandingGiftCardBalance: stats.outstandingGiftCardBalance,
            }}
            clients={clients}
          />
        </motion.div>
      </div>
    </div>
  )
}
