"use client"

import React, { useState, useMemo } from "react"
import { motion } from "framer-motion"
import { Star, MessageCircle } from "lucide-react"
import { EmptyState } from "@/components/shared/empty-state"
import { Header } from "@/components/dashboard/header"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ReviewSummary } from "@/components/reviews/review-summary"
import { ReviewCard } from "@/components/reviews/review-card"
import { RespondDialog } from "@/components/reviews/respond-dialog"
import { type Review } from "@/data/mock-reviews"

interface ReviewsClientProps {
  initialReviews: Review[]
  stats: {
    averageRating: number
    totalReviews: number
    fiveStarCount: number
    fourStarCount: number
    threeStarCount: number
    twoStarCount: number
    oneStarCount: number
    responseRate: number
    ratingTrend: { month: string; rating: number }[]
  }
}

type SourceFilter = "all" | "Google" | "Yelp" | "Website" | "App"
type RatingFilter = "all" | "5" | "4" | "3" | "2" | "1"
type SortOption = "newest" | "oldest" | "highest" | "lowest"

export function ReviewsClient(props: ReviewsClientProps) {
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all")
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>("all")
  const [sortOption, setSortOption] = useState<SortOption>("newest")
  const [needsResponseOnly, setNeedsResponseOnly] = useState(false)
  const [respondReview, setRespondReview] = useState<Review | null>(null)
  const [respondOpen, setRespondOpen] = useState(false)

  const reviews = useMemo(() => {
    return props.initialReviews.map((r) => ({
      ...r,
      date: new Date(r.date),
      responseDate: r.responseDate ? new Date(r.responseDate) : undefined,
    }))
  }, [props.initialReviews])

  const needsResponseCount = useMemo(
    () => reviews.filter((r) => !r.response).length,
    [reviews]
  )

  const filteredReviews = useMemo(() => {
    let filtered = [...reviews]

    // Filter by needs response
    if (needsResponseOnly) {
      filtered = filtered.filter((r) => !r.response)
    }

    // Filter by source
    if (sourceFilter !== "all") {
      filtered = filtered.filter((r) => r.source === sourceFilter)
    }

    // Filter by rating
    if (ratingFilter !== "all") {
      filtered = filtered.filter(
        (r) => r.rating === parseInt(ratingFilter)
      )
    }

    // Sort
    switch (sortOption) {
      case "newest":
        filtered.sort((a, b) => b.date.getTime() - a.date.getTime())
        break
      case "oldest":
        filtered.sort((a, b) => a.date.getTime() - b.date.getTime())
        break
      case "highest":
        filtered.sort((a, b) => b.rating - a.rating)
        break
      case "lowest":
        filtered.sort((a, b) => a.rating - b.rating)
        break
    }

    return filtered
  }, [sourceFilter, ratingFilter, sortOption, needsResponseOnly, reviews])

  const handleReply = (review: Review) => {
    setRespondReview(review)
    setRespondOpen(true)
  }

  return (
    <div className="min-h-screen bg-cream">
      <Header
        title="Reviews"
        subtitle={`${props.stats.averageRating.toFixed(1)} average rating across ${props.stats.totalReviews} reviews`}
      />

      <div className="p-6 space-y-6">
        {/* Summary Section */}
        <ReviewSummary stats={props.stats} />

        {/* Filter Bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3 flex-wrap">
            {/* Source Filter */}
            <Tabs
              value={sourceFilter}
              onValueChange={(v) => setSourceFilter(v as SourceFilter)}
            >
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="Google">Google</TabsTrigger>
                <TabsTrigger value="Yelp">Yelp</TabsTrigger>
                <TabsTrigger value="Website">Website</TabsTrigger>
                <TabsTrigger value="App">App</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Rating Filter */}
            <Select
              value={ratingFilter}
              onValueChange={(v) => setRatingFilter(v as RatingFilter)}
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="All Ratings" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Ratings</SelectItem>
                <SelectItem value="5">5 Stars</SelectItem>
                <SelectItem value="4">4 Stars</SelectItem>
                <SelectItem value="3">3 Stars</SelectItem>
                <SelectItem value="2">2 Stars</SelectItem>
                <SelectItem value="1">1 Star</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3">
            {/* Needs Response Toggle */}
            <Button
              variant={needsResponseOnly ? "default" : "outline"}
              size="sm"
              className="gap-1.5"
              onClick={() => setNeedsResponseOnly(!needsResponseOnly)}
            >
              <MessageCircle className="w-3.5 h-3.5" />
              Needs Reply
              {needsResponseCount > 0 && (
                <Badge
                  variant={needsResponseOnly ? "secondary" : "default"}
                  className="ml-1 h-5 min-w-[20px] px-1.5 text-[10px]"
                >
                  {needsResponseCount}
                </Badge>
              )}
            </Button>

            {/* Sort */}
            <Select
              value={sortOption}
              onValueChange={(v) => setSortOption(v as SortOption)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="oldest">Oldest</SelectItem>
                <SelectItem value="highest">Highest</SelectItem>
                <SelectItem value="lowest">Lowest</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </motion.div>

        {/* Total Count */}
        <p className="text-sm text-muted-foreground">
          Showing {filteredReviews.length} of {reviews.length} reviews
        </p>

        {/* Review Cards */}
        <div className="space-y-4">
          {filteredReviews.map((review, index) => (
            <ReviewCard
              key={review.id}
              review={review}
              index={index}
              onReply={handleReply}
            />
          ))}
        </div>

        {filteredReviews.length === 0 && (
          <EmptyState
            icon={<Star className="w-8 h-8 text-sal-600" />}
            title="No reviews found"
            description="No reviews match your current filters. Try adjusting the source, rating, or sort options."
          />
        )}
      </div>

      {/* Respond Dialog */}
      <RespondDialog
        review={respondReview}
        open={respondOpen}
        onOpenChange={setRespondOpen}
      />
    </div>
  )
}
