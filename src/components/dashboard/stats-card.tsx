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
function Sparkline({ data, color = "#4fe6a6", className }: { data: number[]; color?: string; className?: string }) {
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
  iconColor = "text-mint",
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
  // Preserve however many decimal places the formatted value carries
  // (e.g. "$1,234.56" → 2) instead of forcing everything to one digit.
  const decimals = (String(value).replace(/[^0-9.]/g, "").split(".")[1] ?? "").length
  const scale = 10 ** decimals
  const { count, ref: countRef } = useCountUp(
    decimals > 0 ? Math.round(numericValue * scale) : numericValue,
    800,
    (delay + 0.3) * 1000
  )

  const displayCount = (count / scale).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      whileHover={{ y: -4, boxShadow: "0 4px 8px rgba(0, 9, 5, 0.25), 0 26px 52px -16px rgba(0, 9, 5, 0.55)" }}
      onClick={href ? () => router.push(href) : undefined}
      className={cn(
        "group relative overflow-hidden glass-panel rounded-panel p-6 card-warm transition-shadow",
        href && "cursor-pointer"
      )}
    >
      {/* Soft brand wash that warms on hover */}
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-mint/15 blur-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="relative z-10 flex items-start justify-between" ref={countRef}>
        <div className="space-y-2">
          <p className="inline-flex items-center glass-pill px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-faint">{title}</p>
          <motion.p
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: delay + 0.2, type: "spring", stiffness: 200 }}
            className="text-[2rem] leading-none font-heading font-bold tracking-tight text-foreground tabular-nums"
          >
            {prefix}{displayCount}
          </motion.p>
          {change !== undefined && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: delay + 0.5, duration: 0.3 }}
              className="flex items-center gap-2"
            >
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
                  isPositive && "bg-mint/15 text-mint",
                  isNegative && "bg-red-400/15 text-red-300",
                  !isPositive && !isNegative && "bg-white/10 text-ink-soft"
                )}
              >
                {isPositive && <TrendingUp className="w-3 h-3" />}
                {isNegative && <TrendingDown className="w-3 h-3" />}
                {isPositive && "+"}
                {change}%
              </span>
              {changeLabel && (
                <span className="text-xs text-muted-foreground/70">{changeLabel}</span>
              )}
            </motion.div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: delay + 0.1, type: "spring", stiffness: 200 }}
            className={cn(
              "p-3 rounded-2xl ring-1 ring-inset ring-white/10 shadow-inset-hi transition-transform duration-300 group-hover:scale-105",
              iconBgColor
            )}
          >
            <Icon className={cn("w-6 h-6", iconColor)} />
          </motion.div>
          {sparklineData && sparklineData.length > 1 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: delay + 0.6 }}
            >
              <Sparkline data={sparklineData} color={sparklineColor || "#4fe6a6"} />
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
