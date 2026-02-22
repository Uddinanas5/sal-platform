"use client"

import React from "react"
import { motion } from "framer-motion"
import {
  Trophy,
  Star,
  Gift,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { formatDate } from "@/lib/utils"
import { type Client } from "@/data/mock-data"
import { toast } from "sonner"

interface ClientLoyaltyTabProps {
  client: Client
}

interface PointsHistoryEntry {
  id: string
  date: Date
  description: string
  points: number
  type: "earned" | "redeemed" | "bonus"
}

interface Reward {
  id: string
  name: string
  pointsCost: number
  description: string
}

const tiers = [
  { name: "Bronze", minPoints: 0, maxPoints: 200, color: "bg-amber-700" },
  { name: "Silver", minPoints: 200, maxPoints: 500, color: "bg-slate-400" },
  { name: "Gold", minPoints: 500, maxPoints: 1000, color: "bg-yellow-500" },
  { name: "Platinum", minPoints: 1000, maxPoints: Infinity, color: "bg-purple-500" },
]

const rewards: Reward[] = [
  { id: "r1", name: "$10 Off Any Service", pointsCost: 200, description: "Get $10 off your next service appointment" },
  { id: "r2", name: "$25 Off Any Service", pointsCost: 500, description: "Get $25 off your next service appointment" },
  { id: "r3", name: "Free Blowout & Style", pointsCost: 700, description: "Enjoy a complimentary blowout and styling session" },
  { id: "r4", name: "Free Deep Tissue Massage", pointsCost: 1000, description: "Redeem for a full 60-minute therapeutic massage" },
  { id: "r5", name: "VIP Package", pointsCost: 1500, description: "Full day of pampering: haircut, massage, facial, and manicure" },
]

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getPointsHistory(clientId: string, points: number): PointsHistoryEntry[] {
  const entries: PointsHistoryEntry[] = [
    { id: "ph1", date: new Date("2026-02-14"), description: "Visit - Classic Haircut", points: 45, type: "earned" },
    { id: "ph2", date: new Date("2026-02-10"), description: "Visit - Color Treatment", points: 150, type: "earned" },
    { id: "ph3", date: new Date("2026-02-01"), description: "Redeemed: $10 Off Service", points: -200, type: "redeemed" },
    { id: "ph4", date: new Date("2026-01-28"), description: "Visit - Deep Tissue Massage", points: 95, type: "earned" },
    { id: "ph5", date: new Date("2026-01-15"), description: "Birthday Bonus", points: 100, type: "bonus" },
    { id: "ph6", date: new Date("2026-01-10"), description: "Referral Bonus - New Client", points: 50, type: "bonus" },
    { id: "ph7", date: new Date("2025-12-28"), description: "Visit - Highlights", points: 120, type: "earned" },
    { id: "ph8", date: new Date("2025-12-20"), description: "Holiday Double Points Promo", points: 85, type: "bonus" },
    { id: "ph9", date: new Date("2025-12-15"), description: "Visit - Facial Treatment", points: 85, type: "earned" },
    { id: "ph10", date: new Date("2025-12-01"), description: "Redeemed: $25 Off Service", points: -500, type: "redeemed" },
  ]
  return entries
}

function getCurrentTier(points: number) {
  for (let i = tiers.length - 1; i >= 0; i--) {
    if (points >= tiers[i].minPoints) return tiers[i]
  }
  return tiers[0]
}

function getNextTier(points: number) {
  for (const tier of tiers) {
    if (points < tier.minPoints) return tier
  }
  return null
}

function getTierProgress(points: number): number {
  const current = getCurrentTier(points)
  const next = getNextTier(points)
  if (!next) return 100
  const range = next.minPoints - current.minPoints
  const progress = points - current.minPoints
  return Math.min(Math.round((progress / range) * 100), 100)
}

export function ClientLoyaltyTab({ client }: ClientLoyaltyTabProps) {
  const points = client.loyaltyPoints || 0
  const currentTier = getCurrentTier(points)
  const nextTier = getNextTier(points)
  const progress = getTierProgress(points)
  const history = getPointsHistory(client.id, points)

  const handleRedeem = (reward: Reward) => {
    if (points >= reward.pointsCost) {
      toast.success(`Redeemed "${reward.name}" for ${reward.pointsCost} points`)
    } else {
      toast.error(`Not enough points. Need ${reward.pointsCost - points} more points.`)
    }
  }

  return (
    <div className="space-y-6">
      {/* Points Balance & Tier */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="border-cream-200 overflow-hidden">
            <div className="bg-gradient-to-br from-sal-500 to-sal-700 p-6 text-white">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Trophy className="w-5 h-5" />
                  <span className="text-sm font-medium opacity-90">Points Balance</span>
                </div>
                <Badge className={`${currentTier.color} text-white border-0`}>
                  {currentTier.name}
                </Badge>
              </div>
              <p className="text-4xl font-heading font-bold mb-1">
                {points.toLocaleString()}
              </p>
              <p className="text-sm opacity-80">loyalty points</p>
            </div>
            <CardContent className="p-4">
              {nextTier ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {nextTier.minPoints - points} points to {nextTier.name}
                    </span>
                    <span className="font-medium">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                  <div className="flex items-center justify-between text-xs text-muted-foreground/70">
                    <span>{currentTier.name}</span>
                    <span>{nextTier.name}</span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-sal-600">
                  <Sparkles className="w-4 h-4" />
                  <span className="font-medium">You have reached the highest tier!</span>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Tier Progress */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Card className="border-cream-200 h-full">
            <CardHeader>
              <CardTitle className="text-lg font-heading flex items-center gap-2">
                <Star className="w-4 h-4" />
                Tier Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {tiers.map((tier) => {
                  const isCurrentTier = tier.name === currentTier.name
                  const isAchieved = points >= tier.minPoints
                  return (
                    <div key={tier.name} className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          isAchieved ? tier.color : "bg-cream-200"
                        }`}
                      >
                        {isAchieved ? (
                          <Trophy className="w-4 h-4 text-white" />
                        ) : (
                          <Trophy className="w-4 h-4 text-muted-foreground/70" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-sm font-medium ${
                              isCurrentTier ? "text-sal-600" : isAchieved ? "text-foreground" : "text-muted-foreground/70"
                            }`}
                          >
                            {tier.name}
                          </span>
                          {isCurrentTier && (
                            <Badge variant="default" className="text-xs">
                              Current
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {tier.maxPoints === Infinity
                            ? `${tier.minPoints.toLocaleString()}+ points`
                            : `${tier.minPoints.toLocaleString()} - ${tier.maxPoints.toLocaleString()} points`}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Points History & Rewards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Points History */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-2"
        >
          <Card className="border-cream-200">
            <CardHeader>
              <CardTitle className="text-lg font-heading flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Points History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {history.map((entry, i) => (
                  <div key={entry.id}>
                    {i > 0 && <Separator className="mb-3" />}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2 rounded-lg ${
                            entry.type === "earned"
                              ? "bg-emerald-500/10"
                              : entry.type === "redeemed"
                              ? "bg-red-500/10"
                              : "bg-amber-500/10"
                          }`}
                        >
                          {entry.type === "earned" ? (
                            <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                          ) : entry.type === "redeemed" ? (
                            <ArrowDownRight className="w-4 h-4 text-red-600" />
                          ) : (
                            <Gift className="w-4 h-4 text-amber-600" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{entry.description}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(entry.date)}</p>
                        </div>
                      </div>
                      <span
                        className={`text-sm font-semibold ${
                          entry.points > 0 ? "text-emerald-600" : "text-red-600"
                        }`}
                      >
                        {entry.points > 0 ? "+" : ""}
                        {entry.points}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Available Rewards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <Card className="border-cream-200">
            <CardHeader>
              <CardTitle className="text-lg font-heading flex items-center gap-2">
                <Gift className="w-4 h-4" />
                Available Rewards
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {rewards.map((reward) => {
                  const canRedeem = points >= reward.pointsCost
                  return (
                    <div
                      key={reward.id}
                      className={`p-3 rounded-lg border transition-colors ${
                        canRedeem
                          ? "border-sal-200 bg-sal-50/50 hover:bg-sal-50"
                          : "border-cream-200 bg-cream-50 opacity-60"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{reward.name}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">{reward.description}</p>
                      <div className="flex items-center justify-between">
                        <Badge variant={canRedeem ? "default" : "secondary"} className="text-xs">
                          {reward.pointsCost} pts
                        </Badge>
                        <Button
                          size="sm"
                          variant={canRedeem ? "default" : "outline"}
                          className="h-7 text-xs"
                          disabled={!canRedeem}
                          onClick={() => handleRedeem(reward)}
                        >
                          Redeem
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
