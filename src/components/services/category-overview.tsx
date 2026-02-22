"use client"

import React from "react"
import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"
import type { Service } from "@/data/mock-data"

const categoryColors: Record<string, string> = {
  Hair: "#f97316",
  Wellness: "#10b981",
  Nails: "#ec4899",
  Skincare: "#06b6d4",
  "Brows & Lashes": "#a855f7",
  Body: "#14b8a6",
}

const categoryRevenueContribution: Record<string, number> = {
  Hair: 38,
  Wellness: 22,
  Nails: 15,
  Skincare: 13,
  "Brows & Lashes": 7,
  Body: 5,
}

interface CategoryOverviewProps {
  services: Service[]
}

export function CategoryOverview({ services }: CategoryOverviewProps) {
  const allCategories = Array.from(
    new Set(services.map((s) => s.category))
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-heading">
          Categories Overview
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {allCategories.map((category, index) => {
            const categoryServices = services.filter(
              (s) => s.category === category
            )
            const avgPrice =
              categoryServices.reduce((sum, s) => sum + s.price, 0) /
              categoryServices.length
            const color = categoryColors[category] ?? "#6b7280"
            const revenue = categoryRevenueContribution[category] ?? 0

            return (
              <motion.div
                key={category}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ scale: 1.03 }}
                className="p-4 rounded-xl bg-cream-100 hover:bg-cream-200 transition-colors cursor-pointer relative overflow-hidden"
              >
                {/* Color accent bar */}
                <div
                  className="absolute top-0 left-0 right-0 h-1 rounded-t-xl"
                  style={{ backgroundColor: color }}
                />

                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center mb-3"
                  style={{
                    backgroundColor: `${color}20`,
                  }}
                >
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                </div>

                <h4 className="font-medium text-foreground text-sm">
                  {category}
                </h4>
                <p className="text-xs text-muted-foreground mt-1">
                  {categoryServices.length} service{categoryServices.length !== 1 ? "s" : ""}
                </p>
                <p className="text-sm font-semibold text-foreground mt-2">
                  {formatCurrency(avgPrice)}
                  <span className="text-xs font-normal text-muted-foreground">
                    {" "}avg
                  </span>
                </p>
                <p className="text-xs font-medium mt-1" style={{ color }}>
                  {revenue}% revenue
                </p>
              </motion.div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
