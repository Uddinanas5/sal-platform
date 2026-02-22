"use client"

import React from "react"
import { motion } from "framer-motion"
import { MessageSquare } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { StarRating } from "@/components/reviews/star-rating"
import { formatRelativeDate, getInitials } from "@/lib/utils"
import type { Review } from "@/data/mock-reviews"

interface ReviewCardProps {
  review: Review
  index: number
  onReply: (review: Review) => void
}

const sourceColors: Record<string, string> = {
  Google: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  Yelp: "bg-red-500/10 text-red-700 dark:text-red-300",
  Website: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  App: "bg-purple-500/10 text-purple-700 dark:text-purple-300",
}

export function ReviewCard({ review, index, onReply }: ReviewCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="bg-card rounded-2xl p-5 border border-cream-200 shadow-sm hover:shadow-md transition-all card-warm"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10 ring-2 ring-sal-100">
            <AvatarImage src={review.clientAvatar} />
            <AvatarFallback className="bg-gradient-to-br from-sal-400 to-sal-600 text-white font-semibold text-sm">
              {getInitials(review.clientName)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold text-foreground">
              {review.clientName}
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              <StarRating rating={review.rating} size="sm" />
              <span className="text-xs text-muted-foreground/70">
                {formatRelativeDate(review.date)}
              </span>
              <Badge
                variant="secondary"
                className={`text-xs ${sourceColors[review.source] || ""}`}
              >
                {review.source}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Service + Staff */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs text-muted-foreground">
          {review.serviceName}
        </span>
        <span className="text-xs text-muted-foreground/70">|</span>
        <span className="text-xs text-muted-foreground">
          with {review.staffName}
        </span>
      </div>

      {/* Comment */}
      <p className="text-sm text-foreground leading-relaxed">
        {review.comment}
      </p>

      {/* Response Section */}
      {review.response ? (
        <div className="mt-4 ml-4 pl-4 border-l-2 border-sal-200 space-y-1">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold text-sal-700">
              Response from SAL
            </p>
            {review.responseDate && (
              <span className="text-xs text-muted-foreground/70">
                {formatRelativeDate(review.responseDate)}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{review.response}</p>
        </div>
      ) : (
        <div className="mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onReply(review)}
            className="gap-1.5"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Reply
          </Button>
        </div>
      )}
    </motion.div>
  )
}
