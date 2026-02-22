"use client"

import React, { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { motion, useInView } from "framer-motion"
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react"
import { cn } from "@/lib/utils"

// Hook to animate counting up from 0 to target
function useCountUp(target: number, duration = 1000, delay = 0) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true })

  useEffect(() => {
    if (!isInView) return

    const timeout = setTimeout(() => {
      const startTime = performance.now()
      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime
        const progress = Math.min(elapsed / duration, 1)
        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3)
        setCount(Math.round(eased * target))
        if (progress < 1) {
          requestAnimationFrame(animate)
        }
      }
      requestAnimationFrame(animate)
    }, delay)

    return () => clearTimeout(timeout)
  }, [target, duration, delay, isInView])

  return { count, ref }
}

// Lightweight inline sparkline using SVG
function Sparkline({ data, color = "#059669", className }: { data: number[]; color?: string; className?: string }) {
  if (data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const width = 80
  const height = 28
  const padding = 2

  const points = data.map((v, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2)
    const y = height - padding - ((v - min) / range) * (height - padding * 2)
    return `${x},${y}`
  })

  return (
    <svg width={width} height={height} className={className} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id={`spark-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon
        points={`${points[0].split(",")[0]},${height} ${points.join(" ")} ${points[points.length - 1].split(",")[0]},${height}`}
        fill={`url(#spark-${color.replace("#", "")})`}
      />
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

interface StatsCardProps {
  title: string
  value: string | number
  change?: number
  changeLabel?: string
  icon: LucideIcon
  iconColor?: string
  iconBgColor?: string
  delay?: number
  href?: string
  sparklineData?: number[]
  sparklineColor?: string
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
  href,
  sparklineData,
  sparklineColor,
}: StatsCardProps) {
  const router = useRouter()
  const isPositive = change && change > 0
  const isNegative = change && change < 0

  // Extract numeric value for counting animation
  const numericValue = typeof value === "number"
    ? value
    : parseFloat(String(value).replace(/[^0-9.]/g, "")) || 0
  const prefix = typeof value === "string" ? (value.match(/^[^0-9]*/)?.[0] || "") : ""
  const isDecimal = String(value).includes(".")
  const { count, ref: countRef } = useCountUp(
    isDecimal ? Math.round(numericValue * 10) : numericValue,
    800,
    (delay + 0.3) * 1000
  )

  const displayCount = isDecimal
    ? (count / 10).toFixed(1)
    : count.toLocaleString()

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      whileHover={{ y: -4, boxShadow: "0 12px 40px rgba(5, 150, 105, 0.08)" }}
      onClick={href ? () => router.push(href) : undefined}
      className={cn(
        "bg-card rounded-2xl p-6 border border-cream-200 shadow-sm card-warm transition-shadow",
        href && "cursor-pointer"
      )}
    >
      <div className="flex items-start justify-between" ref={countRef}>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground font-medium">{title}</p>
          <motion.p
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: delay + 0.2, type: "spring", stiffness: 200 }}
            className="text-3xl font-heading font-bold text-foreground"
          >
            {prefix}{displayCount}
          </motion.p>
          {change !== undefined && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: delay + 0.5, duration: 0.3 }}
              className="flex items-center gap-1"
            >
              {isPositive && <TrendingUp className="w-4 h-4 text-sal-500" />}
              {isNegative && <TrendingDown className="w-4 h-4 text-red-500" />}
              <span
                className={cn(
                  "text-sm font-medium",
                  isPositive && "text-sal-600",
                  isNegative && "text-red-600",
                  !isPositive && !isNegative && "text-muted-foreground"
                )}
              >
                {isPositive && "+"}
                {change}%
              </span>
              {changeLabel && (
                <span className="text-sm text-muted-foreground/70">{changeLabel}</span>
              )}
            </motion.div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: delay + 0.1, type: "spring", stiffness: 200 }}
            className={cn("p-3 rounded-xl", iconBgColor)}
          >
            <Icon className={cn("w-6 h-6", iconColor)} />
          </motion.div>
          {sparklineData && sparklineData.length > 1 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: delay + 0.6 }}
            >
              <Sparkline data={sparklineData} color={sparklineColor || "#059669"} />
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
