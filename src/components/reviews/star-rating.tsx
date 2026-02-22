"use client"

import React from "react"
import { Star } from "lucide-react"
import { cn } from "@/lib/utils"

interface StarRatingProps {
  rating: number
  size?: "sm" | "md" | "lg"
  showValue?: boolean
}

const sizeMap = {
  sm: "w-3.5 h-3.5",
  md: "w-5 h-5",
  lg: "w-6 h-6",
}

const textSizeMap = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
}

export function StarRating({ rating, size = "md", showValue = false }: StarRatingProps) {
  const iconSize = sizeMap[size]
  const textSize = textSizeMap[size]

  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => {
          const filled = rating >= star
          const halfFilled = !filled && rating >= star - 0.5

          return (
            <div key={star} className="relative">
              {/* Empty star (background) */}
              <Star
                className={cn(iconSize, "text-muted-foreground/50 fill-muted-foreground/50")}
              />
              {/* Filled or half-filled overlay */}
              {(filled || halfFilled) && (
                <div
                  className="absolute inset-0 overflow-hidden"
                  style={{ width: filled ? "100%" : "50%" }}
                >
                  <Star
                    className={cn(iconSize, "text-amber-400 fill-amber-400")}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
      {showValue && (
        <span className={cn("font-medium text-foreground ml-1", textSize)}>
          {rating.toFixed(1)}
        </span>
      )}
    </div>
  )
}
