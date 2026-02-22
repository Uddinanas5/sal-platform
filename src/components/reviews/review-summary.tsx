"use client"

import React from "react"
import { motion } from "framer-motion"
import { TrendingUp, MessageSquare } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { StarRating } from "@/components/reviews/star-rating"

interface ReviewSummaryStats {
  averageRating: number
  totalReviews: number
  fiveStarCount: number
  fourStarCount: number
  threeStarCount: number
  twoStarCount: number
  oneStarCount: number
  responseRate: number
  ratingTrend: { month: string; rating: number }[]
}

interface ReviewSummaryProps {
  stats?: ReviewSummaryStats
}

const defaultStats: ReviewSummaryStats = {
  averageRating: 0,
  totalReviews: 0,
  fiveStarCount: 0,
  fourStarCount: 0,
  threeStarCount: 0,
  twoStarCount: 0,
  oneStarCount: 0,
  responseRate: 0,
  ratingTrend: [],
}

export function ReviewSummary({ stats = defaultStats }: ReviewSummaryProps) {
  const {
    averageRating,
    totalReviews,
    fiveStarCount,
    fourStarCount,
    threeStarCount,
    twoStarCount,
    oneStarCount,
    responseRate,
    ratingTrend,
  } = stats

  const starBreakdown = [
    { stars: 5, count: fiveStarCount },
    { stars: 4, count: fourStarCount },
    { stars: 3, count: threeStarCount },
    { stars: 2, count: twoStarCount },
    { stars: 1, count: oneStarCount },
  ]

  // Build sparkline path from ratingTrend data
  const minRating = Math.min(...ratingTrend.map((t) => t.rating)) - 0.2
  const maxRating = Math.max(...ratingTrend.map((t) => t.rating)) + 0.2
  const sparklineWidth = 120
  const sparklineHeight = 40
  const points = ratingTrend.map((t, i) => {
    const x = (i / (ratingTrend.length - 1)) * sparklineWidth
    const y =
      sparklineHeight -
      ((t.rating - minRating) / (maxRating - minRating)) * sparklineHeight
    return `${x},${y}`
  })
  const sparklinePath = `M ${points.join(" L ")}`

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Average Rating Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0 }}
      >
        <Card className="border-cream-200 h-full">
          <CardContent className="p-6">
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-5xl font-heading font-bold text-foreground">
                  {averageRating.toFixed(1)}
                </p>
                <div className="mt-2">
                  <StarRating rating={averageRating} size="md" />
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {totalReviews} reviews
                </p>
              </div>
              <div className="flex-1 space-y-2">
                {starBreakdown.map((item, index) => {
                  const pct = totalReviews > 0 ? (item.count / totalReviews) * 100 : 0
                  return (
                    <div key={item.stars} className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground w-8 text-right">
                        {item.stars}
                      </span>
                      <div className="h-2 flex-1 bg-cream-200 dark:bg-muted rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.8, delay: 0.2 + index * 0.1, ease: "easeOut" }}
                          className="h-full rounded-full"
                          style={{
                            backgroundColor: item.stars >= 4 ? "#059669" : item.stars === 3 ? "#f59e0b" : "#ef4444"
                          }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground w-6 text-right">
                        {item.count}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Response Rate Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="border-cream-200 h-full">
          <CardContent className="p-6 flex flex-col items-center justify-center h-full">
            <div className="p-3 rounded-xl bg-sal-100 mb-3">
              <MessageSquare className="w-6 h-6 text-sal-600" />
            </div>
            <p className="text-4xl font-heading font-bold text-foreground">
              {responseRate}%
            </p>
            <p className="text-sm text-muted-foreground mt-1">Response Rate</p>
            <p className="text-xs text-muted-foreground/70 mt-2 text-center">
              {Math.round((responseRate / 100) * totalReviews)} of{" "}
              {totalReviews} reviews responded
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Rating Trend Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="border-cream-200 h-full">
          <CardContent className="p-6 flex flex-col items-center justify-center h-full">
            <div className="p-3 rounded-xl bg-sal-100 mb-3">
              <TrendingUp className="w-6 h-6 text-sal-600" />
            </div>
            <p className="text-sm font-medium text-foreground mb-3">
              Rating Trend
            </p>
            <svg
              width={sparklineWidth}
              height={sparklineHeight}
              viewBox={`0 0 ${sparklineWidth} ${sparklineHeight}`}
              className="overflow-visible"
            >
              <path
                d={sparklinePath}
                fill="none"
                stroke="#059669"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {ratingTrend.map((t, i) => {
                const x = (i / (ratingTrend.length - 1)) * sparklineWidth
                const y =
                  sparklineHeight -
                  ((t.rating - minRating) / (maxRating - minRating)) *
                    sparklineHeight
                return (
                  <circle
                    key={t.month}
                    cx={x}
                    cy={y}
                    r={3}
                    fill="#059669"
                  />
                )
              })}
            </svg>
            <div className="flex justify-between w-full mt-2 px-1">
              {ratingTrend.map((t) => (
                <span key={t.month} className="text-[10px] text-muted-foreground/70">
                  {t.month}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
