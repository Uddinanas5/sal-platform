"use client"

import React, { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { AlertTriangle, X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface LowStockAlertProps {
  lowStockCount: number
  onViewLowStock: () => void
}

export function LowStockAlert({ lowStockCount, onViewLowStock }: LowStockAlertProps) {
  const [dismissed, setDismissed] = useState(false)
  const count = lowStockCount

  if (dismissed || count === 0) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="relative overflow-hidden rounded-xl bg-gradient-to-r from-amber-50 to-amber-100 border border-amber-200 p-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-200/60">
              <AlertTriangle className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-900">
                Low Stock Warning
              </p>
              <p className="text-sm text-amber-700">
                {count} product{count !== 1 ? "s are" : " is"} running low on
                stock
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onViewLowStock}
              className="border-amber-300 bg-amber-200/50 text-amber-900 hover:bg-amber-200 hover:text-amber-900"
            >
              View Low Stock
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDismissed(true)}
              className="h-8 w-8 text-amber-600 hover:text-amber-900 hover:bg-amber-200/50"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
