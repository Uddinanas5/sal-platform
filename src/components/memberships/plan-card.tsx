"use client"

import React from "react"
import { motion } from "framer-motion"
import { Check, Users, Pencil, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"
import type { MembershipPlan } from "@/data/mock-memberships"

interface PlanCardProps {
  plan: MembershipPlan
  index?: number
  onEdit?: (plan: MembershipPlan) => void
  onViewMembers?: (plan: MembershipPlan) => void
}

export function PlanCard({ plan, index = 0, onEdit, onViewMembers }: PlanCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      whileHover={{ y: -4, boxShadow: "0 12px 40px rgba(0,0,0,0.08)" }}
      className="bg-card rounded-2xl border border-cream-200 shadow-sm overflow-hidden card-warm"
    >
      {/* Top colored bar */}
      <div className="h-2" style={{ backgroundColor: plan.color }} />

      <div className="p-5 space-y-4">
        {/* Plan name & price */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-heading font-bold text-foreground">
              {plan.name}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">{plan.description}</p>
          </div>
          <Badge
            variant="secondary"
            className="text-xs"
            style={{
              backgroundColor: `${plan.color}15`,
              color: plan.color,
              borderColor: `${plan.color}30`,
            }}
          >
            {plan.discount}% off
          </Badge>
        </div>

        {/* Price */}
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-heading font-bold text-foreground">
            {formatCurrency(plan.price)}
          </span>
          <span className="text-sm text-muted-foreground/70">
            /{plan.interval === "monthly" ? "mo" : "yr"}
          </span>
        </div>

        {/* Features */}
        <ul className="space-y-2">
          {plan.features.map((feature, i) => (
            <li key={i} className="flex items-start gap-2">
              <Check
                className="w-4 h-4 mt-0.5 flex-shrink-0"
                style={{ color: plan.color }}
              />
              <span className="text-xs text-muted-foreground">{feature}</span>
            </li>
          ))}
        </ul>

        {/* Member count */}
        <div className="flex items-center gap-2 pt-2 border-t border-cream-200">
          <Users className="w-4 h-4 text-muted-foreground/70" />
          <span className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">
              {plan.memberCount}
            </span>{" "}
            members
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onEdit?.(plan)}
          >
            <Pencil className="w-3.5 h-3.5 mr-1.5" />
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-1"
            onClick={() => onViewMembers?.(plan)}
          >
            <Eye className="w-3.5 h-3.5 mr-1.5" />
            View Members
          </Button>
        </div>
      </div>
    </motion.div>
  )
}
