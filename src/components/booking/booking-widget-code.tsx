"use client"

import React from "react"
import { motion } from "framer-motion"
import { Code2, Copy, ExternalLink } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

export function BookingWidgetCode({ businessSlug }: { businessSlug: string }) {
  const bookingUrl = typeof window !== "undefined"
    ? `${window.location.origin}/book/${businessSlug}`
    : `/book/${businessSlug}`
  const embedScriptUrl = typeof window !== "undefined"
    ? `${window.location.origin}/embed.js`
    : "/embed.js"

  const embedCode = `<script
  src="${embedScriptUrl}"
  data-slug="${businessSlug}"
  data-mode="inline"
></script>`

  const buttonCode = `<script
  src="${embedScriptUrl}"
  data-slug="${businessSlug}"
  data-mode="popup"
  data-text="Book now"
></script>`

  const linkCode = `<a href="${bookingUrl}">Book now</a>`

  const handleCopyEmbed = () => {
    navigator.clipboard.writeText(embedCode)
    toast.success("Embed code copied", {
      description: "Paste this HTML into your website to add the booking widget.",
    })
  }

  const handleCopyButton = () => {
    navigator.clipboard.writeText(buttonCode)
    toast.success("Button code copied", {
      description: "Paste this HTML to add a booking button to your website.",
    })
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(linkCode)
    toast.success("Fallback link copied", {
      description: "Use this when a website builder blocks third-party scripts.",
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-heading flex items-center gap-2">
          <Code2 className="w-5 h-5 text-mint-strong" />
          Embed Widget
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Iframe embed */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">Inline Widget Code</p>
          <div className="relative">
            <pre className="bg-[rgba(2,17,11,0.6)] border border-white/10 text-mint-soft font-mono p-4 rounded-lg text-xs overflow-x-auto leading-relaxed">
              <code>{embedCode}</code>
            </pre>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyEmbed}
              className="absolute top-2 right-2 text-muted-foreground/70 hover:text-white hover:bg-white/10"
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Button embed */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">Popup Button Code</p>
          <div className="relative">
            <pre className="bg-[rgba(2,17,11,0.6)] border border-white/10 text-mint-soft font-mono p-4 rounded-lg text-xs overflow-x-auto leading-relaxed">
              <code>{buttonCode}</code>
            </pre>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyButton}
              className="absolute top-2 right-2 text-muted-foreground/70 hover:text-white hover:bg-white/10"
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">Fallback Link</p>
          <div className="relative">
            <pre className="bg-[rgba(2,17,11,0.6)] border border-white/10 text-mint-soft font-mono p-4 rounded-lg text-xs overflow-x-auto leading-relaxed">
              <code>{linkCode}</code>
            </pre>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyLink}
              className="absolute top-2 right-2 text-muted-foreground/70 hover:text-white hover:bg-white/10"
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Preview */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">Button Preview</p>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-center p-6 bg-cream-100 rounded-xl border border-cream-200"
          >
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              className="inline-flex items-center gap-2 px-6 py-3 bg-sal-500 text-white rounded-lg font-semibold text-sm hover:bg-sal-600 transition-colors shadow-md shadow-sal-500/20"
            >
              <ExternalLink className="w-4 h-4" />
              Book Now
            </a>
          </motion.div>
        </div>
      </CardContent>
    </Card>
  )
}
