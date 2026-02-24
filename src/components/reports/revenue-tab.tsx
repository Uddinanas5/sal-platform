"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { DollarSign, TrendingUp, Receipt, ArrowUpRight } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { LazyAreaChart as AreaChartComponent } from "@/components/charts/lazy"
import { LazyBarChart as BarChartComponent } from "@/components/charts/lazy"
import { LazyPieChart as PieChartComponent } from "@/components/charts/lazy"
import { formatCurrency } from "@/lib/utils"

interface RevenueTabProps {
  summary: {
    totalRevenue: number
    revenueGrowth: number
    averageTicket: number
    ticketGrowth: number
  }
  revenueByMonth: { month: string; revenue: number }[]
  revenueByCategory: { name: string; value: number; color: string }[]
  revenueByPaymentMethod: { name: string; value: number; color: string }[]
}

export function RevenueTab({
  summary,
  revenueByMonth,
  revenueByCategory,
  revenueByPaymentMethod,
}: RevenueTabProps) {
  const summaryCards = [
    {
      title: "Total Revenue",
      value: summary.totalRevenue,
      growth: summary.revenueGrowth,
      icon: DollarSign,
      format: formatCurrency,
    },
    {
      title: "Average Ticket",
      value: summary.averageTicket,
      growth: summary.ticketGrowth,
      icon: Receipt,
      format: formatCurrency,
    },
    {
      title: "Revenue Growth",
      value: summary.revenueGrowth,
      growth: summary.revenueGrowth,
      icon: TrendingUp,
      format: (v: number) => `${v.toFixed(1)}%`,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {summaryCards.map((card, index) => {
          const Icon = card.icon
          return (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="border-cream-200">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground font-medium">{card.title}</p>
                      <p className="text-2xl font-heading font-bold text-foreground">
                        {card.format(card.value)}
                      </p>
                      <div className="flex items-center gap-1 text-sm text-sal-600">
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        <span className="font-medium">+{card.growth}%</span>
                        <span className="text-muted-foreground/70">vs last month</span>
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-sal-100">
                      <Icon className="w-5 h-5 text-sal-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {/* Revenue Area Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <AreaChartComponent
          data={revenueByMonth}
          dataKey="revenue"
          xAxisKey="month"
          title="Revenue Trend"
          description="Monthly revenue over the last 6 months"
          height={320}
          color="#059669"
          gradientId="revenueTabGradient"
          formatValue={(v) => formatCurrency(v)}
          className="border-cream-200"
        />
      </motion.div>

      {/* Revenue Breakdown Row */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        <BarChartComponent
          data={revenueByCategory}
          dataKey="value"
          xAxisKey="name"
          title="Revenue by Category"
          description="Breakdown by service type"
          height={300}
          colors={revenueByCategory.map((c) => c.color)}
          formatValue={(v) => formatCurrency(v)}
          className="border-cream-200"
        />
        <PieChartComponent
          data={revenueByPaymentMethod}
          title="Payment Methods"
          description="How clients pay"
          height={300}
          innerRadius={55}
          outerRadius={95}
          showLegend={true}
          formatValue={(v) => formatCurrency(v)}
          className="border-cream-200"
        />
      </motion.div>
    </div>
  )
}
