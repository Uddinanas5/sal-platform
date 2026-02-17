"use client"

import React from "react"
import { motion } from "framer-motion"
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface StatsCardProps {
  title: string
  value: string | number
  change?: number
  changeLabel?: string
  icon: LucideIcon
  iconColor?: string
  iconBgColor?: string
  delay?: number
}

export function StatsCard({
  title,
  value,
  change,
  changeLabel,
  icon: Icon,
  iconColor = "text-sal-600",
  iconBgColor = "bg-sal-100",
  delay = 0,
}: StatsCardProps) {
  const isPositive = change && change > 0
  const isNegative = change && change < 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      whileHover={{ y: -2, boxShadow: "0 10px 40px rgba(0,0,0,0.08)" }}
      className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm"
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm text-gray-500 font-medium">{title}</p>
          <motion.p
            initial={{ scale: 0.5 }}
            animate={{ scale: 1 }}
            transition={{ delay: delay + 0.2, type: "spring" }}
            className="text-3xl font-bold text-gray-900"
          >
            {value}
          </motion.p>
          {change !== undefined && (
            <div className="flex items-center gap-1">
              {isPositive && <TrendingUp className="w-4 h-4 text-green-500" />}
              {isNegative && <TrendingDown className="w-4 h-4 text-red-500" />}
              <span
                className={cn(
                  "text-sm font-medium",
                  isPositive && "text-green-600",
                  isNegative && "text-red-600",
                  !isPositive && !isNegative && "text-gray-500"
                )}
              >
                {isPositive && "+"}
                {change}%
              </span>
              {changeLabel && (
                <span className="text-sm text-gray-400">{changeLabel}</span>
              )}
            </div>
          )}
        </div>
        <div className={cn("p-3 rounded-xl", iconBgColor)}>
          <Icon className={cn("w-6 h-6", iconColor)} />
        </div>
      </div>
    </motion.div>
  )
}
