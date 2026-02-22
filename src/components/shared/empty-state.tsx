"use client"

import React from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"

interface EmptyStateProps {
  icon: React.ReactNode
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
  }
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex flex-col items-center justify-center py-16 px-4 text-center"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.35, delay: 0.1, ease: "easeOut" }}
        className="flex h-16 w-16 items-center justify-center rounded-full bg-sal-50 mb-4"
      >
        {icon}
      </motion.div>
      <motion.h3
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.2 }}
        className="text-lg font-heading font-semibold text-foreground mb-2"
      >
        {title}
      </motion.h3>
      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.28 }}
        className="text-sm text-muted-foreground max-w-sm mb-6"
      >
        {description}
      </motion.p>
      {action && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.36 }}
        >
          <Button onClick={action.onClick}>
            {action.label}
          </Button>
        </motion.div>
      )}
    </motion.div>
  )
}
