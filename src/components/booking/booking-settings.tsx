"use client"

import React, { useState } from "react"
import Link from "next/link"
import {
  Globe,
  Copy,
  Check,
  ExternalLink,
  Settings as SettingsIcon,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { Service } from "@/data/mock-data"
import { toast } from "sonner"

interface BookingSettingsProps {
  services?: Service[]
  businessSlug: string
}

export function BookingSettings({ businessSlug }: BookingSettingsProps) {
  const bookingUrl = typeof window !== "undefined"
    ? `${window.location.origin}/book/${businessSlug}`
    : `/book/${businessSlug}`
  const [copied, setCopied] = useState(false)

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(bookingUrl)
    setCopied(true)
    toast.success("Booking URL copied to clipboard", {
      description: "Share this link with your clients so they can book online.",
    })
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-lg font-heading flex items-center gap-2">
          <Globe className="w-5 h-5 text-mint-strong" />
          Booking Settings
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[calc(100vh-260px)]">
          <div className="space-y-6 pr-4">
            {/* Booking URL */}
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Share this link with your clients to let them book appointments online.
              </p>
              <div className="flex items-center gap-2">
                <div
                  className="flex-1 flex items-center gap-2 px-3 py-2 bg-card rounded-lg border border-cream-200 cursor-text select-all min-w-0"
                  onClick={(e) => {
                    const el = e.currentTarget.querySelector("span")
                    if (el) {
                      const range = document.createRange()
                      range.selectNodeContents(el)
                      const sel = window.getSelection()
                      sel?.removeAllRanges()
                      sel?.addRange(range)
                    }
                  }}
                >
                  <Globe className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm text-foreground truncate select-all">
                    {bookingUrl}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyUrl}
                  className="gap-1.5 flex-shrink-0"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-500" />
                      <span className="text-xs">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span className="text-xs">Copy URL</span>
                    </>
                  )}
                </Button>
              </div>
              <a
                href={bookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-mint hover:text-mint-soft transition-colors w-fit"
              >
                <ExternalLink className="w-3 h-3" />
                Open booking page
              </a>
            </div>

            <Separator />

            {/* Pointer to the real booking settings editor */}
            <div className="space-y-3">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  Configure your booking rules
                </p>
                <p className="text-xs text-muted-foreground">
                  Lead time, cancellation policy, deposits, required fields, and
                  which services can be booked online are all managed in Settings.
                </p>
              </div>
              <Button asChild variant="outline" className="w-full">
                <Link href="/settings?tab=booking">
                  <SettingsIcon className="w-4 h-4 mr-2" />
                  Open Booking Settings
                </Link>
              </Button>
            </div>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
