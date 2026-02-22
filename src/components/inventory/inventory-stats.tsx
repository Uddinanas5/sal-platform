"use client"

import React from "react"
import { motion } from "framer-motion"
import { Package, AlertTriangle, DollarSign, Tag } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"
import type { Product } from "@/data/mock-products"

interface InventoryStatsProps {
  products: Product[]
  categories: string[]
}

export function InventoryStats({ products, categories }: InventoryStatsProps) {
  const totalProducts = products.length
  const lowStockCount = products.filter((p) => p.stockLevel <= p.reorderLevel).length
  const inStockCount = totalProducts - lowStockCount
  const inStockPct = totalProducts > 0 ? Math.round((inStockCount / totalProducts) * 100) : 0
  const totalValue = products.reduce(
    (sum, p) => sum + p.retailPrice * p.stockLevel,
    0
  )
  const categoryCount = categories.length

  const stats = [
    {
      title: "Total Products",
      value: totalProducts.toString(),
      icon: Package,
      iconColor: "text-sal-600",
      iconBgColor: "bg-sal-100",
    },
    {
      title: "Low Stock",
      value: lowStockCount.toString(),
      icon: AlertTriangle,
      iconColor: "text-amber-600 dark:text-amber-400",
      iconBgColor: "bg-amber-500/10",
    },
    {
      title: "Total Inventory Value",
      value: formatCurrency(totalValue),
      icon: DollarSign,
      iconColor: "text-sal-600",
      iconBgColor: "bg-sal-100",
    },
    {
      title: "Categories",
      value: categoryCount.toString(),
      icon: Tag,
      iconColor: "text-blue-600 dark:text-blue-400",
      iconBgColor: "bg-blue-500/10",
    },
  ]

  return (
    <div className="space-y-4">
      {/* Compact health summary */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-center gap-3 text-sm"
      >
        <span className="flex items-center gap-1.5 bg-sal-500/10 text-sal-700 dark:text-sal-300 px-3 py-1 rounded-full font-medium">
          <Package className="h-3.5 w-3.5" />
          {inStockPct}% in stock
        </span>
        {lowStockCount > 0 && (
          <span className="flex items-center gap-1.5 bg-amber-500/10 text-amber-700 dark:text-amber-300 px-3 py-1 rounded-full font-medium">
            <AlertTriangle className="h-3.5 w-3.5" />
            {lowStockCount} low stock
          </span>
        )}
        <span className="text-muted-foreground/70 text-xs">
          {totalProducts} products across {categoryCount} categories
        </span>
      </motion.div>

    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <motion.div
          key={stat.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
        >
          <Card className="border-cream-200">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div
                  className={`flex items-center justify-center w-12 h-12 rounded-xl ${stat.iconBgColor}`}
                >
                  <stat.icon className={`w-6 h-6 ${stat.iconColor}`} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-heading font-bold text-foreground">
                    {stat.value}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
    </div>
  )
}
