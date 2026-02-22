"use client"

import React, { useState } from "react"
import { motion } from "framer-motion"
import {
  Globe,
  Copy,
  Check,
  Clock,
  Ban,
  DollarSign,
  Save,
  ExternalLink,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { Service } from "@/data/mock-data"
import { toast } from "sonner"

function MiniQRCode() {
  // A decorative SVG-based QR code pattern (21x21 grid)
  const grid = [
    [1,1,1,1,1,1,1,0,1,0,1,0,1,0,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,1,0,0,1,0,1,0,0,1,0,0,0,0,0,1],
    [1,0,1,1,1,0,1,0,1,1,0,0,1,0,1,0,1,1,1,0,1],
    [1,0,1,1,1,0,1,0,0,1,1,0,0,0,1,0,1,1,1,0,1],
    [1,0,1,1,1,0,1,0,1,0,1,1,0,0,1,0,1,1,1,0,1],
    [1,0,0,0,0,0,1,0,0,0,0,1,1,0,1,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,0,1,0,1,0,1,0,1,1,1,1,1,1,1],
    [0,0,0,0,0,0,0,0,1,1,0,1,0,0,0,0,0,0,0,0,0],
    [1,0,1,0,1,1,1,1,0,0,1,0,1,1,1,0,1,0,0,1,1],
    [0,1,0,1,0,0,0,1,1,0,0,1,0,1,0,1,0,1,1,0,0],
    [1,0,1,1,0,1,1,0,1,1,1,0,1,0,1,1,0,0,1,0,1],
    [0,1,0,0,1,0,0,1,0,0,1,1,0,1,0,0,1,1,0,1,0],
    [1,1,0,1,0,1,1,0,1,0,0,1,1,0,1,0,1,0,1,1,0],
    [0,0,0,0,0,0,0,0,1,0,1,0,0,1,0,1,0,0,1,0,1],
    [1,1,1,1,1,1,1,0,0,1,1,0,1,0,1,0,0,1,0,1,0],
    [1,0,0,0,0,0,1,0,1,0,0,1,0,1,0,1,1,0,1,1,1],
    [1,0,1,1,1,0,1,0,0,1,1,0,1,1,1,0,0,1,0,0,1],
    [1,0,1,1,1,0,1,0,1,0,1,1,0,0,1,1,0,1,1,0,0],
    [1,0,1,1,1,0,1,0,1,1,0,0,1,0,0,0,1,0,0,1,1],
    [1,0,0,0,0,0,1,0,0,0,1,1,0,1,1,0,1,1,0,1,0],
    [1,1,1,1,1,1,1,0,1,0,1,0,1,0,1,0,0,1,1,0,1],
  ]
  const cellSize = 4.5
  const padding = 4
  const svgSize = 21 * cellSize + padding * 2

  return (
    <svg
      width="104"
      height="104"
      viewBox={`0 0 ${svgSize} ${svgSize}`}
      className="mx-auto"
    >
      {/* Background */}
      <rect x="0" y="0" width={svgSize} height={svgSize} fill="white" rx="4" />

      {/* QR code cells */}
      {grid.map((row, y) =>
        row.map((cell, x) => {
          // Leave space for center logo
          const centerStart = 8
          const centerEnd = 12
          if (x >= centerStart && x <= centerEnd && y >= centerStart && y <= centerEnd) {
            return null
          }
          return cell === 1 ? (
            <rect
              key={`${x}-${y}`}
              x={x * cellSize + padding}
              y={y * cellSize + padding}
              width={cellSize}
              height={cellSize}
              fill="#1a1a1a"
              rx={0.8}
            />
          ) : null
        })
      )}

      {/* Center SAL accent circle */}
      <circle
        cx={svgSize / 2}
        cy={svgSize / 2}
        r={cellSize * 2.8}
        fill="white"
        stroke="#e5e7eb"
        strokeWidth="0.5"
      />
      <circle
        cx={svgSize / 2}
        cy={svgSize / 2}
        r={cellSize * 2.2}
        fill="#059669"
      />
      {/* S letter in the center */}
      <text
        x={svgSize / 2}
        y={svgSize / 2 + 3.5}
        textAnchor="middle"
        fill="white"
        fontSize="10"
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
      >
        S
      </text>
    </svg>
  )
}

interface BookingSettingsProps {
  services?: Service[]
}

export function BookingSettings({ services = [] }: BookingSettingsProps) {
  const [bookingEnabled, setBookingEnabled] = useState(true)
  const [leadTime, setLeadTime] = useState("1h")
  const [cancellationPolicy, setCancellationPolicy] = useState("24h")
  const [depositRequired, setDepositRequired] = useState(false)
  const [depositAmount, setDepositAmount] = useState("20")
  const [serviceToggles, setServiceToggles] = useState<Record<string, boolean>>(
    () => {
      const toggles: Record<string, boolean> = {}
      services.forEach((s) => {
        toggles[s.id] = true
      })
      return toggles
    }
  )

  const bookingUrl = "https://book.meetsal.com/luxe-salon"
  const [copied, setCopied] = useState(false)

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(bookingUrl)
    setCopied(true)
    toast.success("Booking URL copied to clipboard", {
      description: "Share this link with your clients so they can book online.",
    })
    setTimeout(() => setCopied(false), 2000)
  }

  const handleToggleService = (serviceId: string) => {
    setServiceToggles((prev) => ({
      ...prev,
      [serviceId]: !prev[serviceId],
    }))
  }

  const handleSave = () => {
    toast.success("Booking settings saved", {
      description: "Your online booking configuration has been updated.",
    })
  }

  const categories = Array.from(new Set(services.map((s) => s.category)))

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-lg font-heading flex items-center gap-2">
          <Globe className="w-5 h-5 text-sal-500" />
          Booking Settings
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[calc(100vh-260px)]">
          <div className="space-y-6 pr-4">
            {/* Online Booking Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-sm font-medium">Online Booking</Label>
                <p className="text-xs text-muted-foreground">
                  Allow clients to book appointments online
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "text-xs font-semibold px-2 py-0.5 rounded-full",
                    bookingEnabled
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-cream-100 text-muted-foreground"
                  )}
                >
                  {bookingEnabled ? "Enabled" : "Disabled"}
                </span>
                <Switch
                  checked={bookingEnabled}
                  onCheckedChange={setBookingEnabled}
                />
              </div>
            </div>

            <Separator />

            {/* Booking URL with QR Code */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Booking URL</Label>
              <div className="flex gap-4">
                {/* QR Code */}
                <div className="flex-shrink-0">
                  <div className="w-[120px] h-[120px] rounded-xl border border-cream-200 bg-white p-2 flex items-center justify-center shadow-sm">
                    <MiniQRCode />
                  </div>
                </div>
                {/* URL and actions */}
                <div className="flex-1 flex flex-col justify-center gap-2">
                  <p className="text-xs text-muted-foreground">
                    Share this link with your clients to let them book appointments online.
                  </p>
                  <div className="flex items-center gap-2">
                    <div
                      className="flex-1 flex items-center gap-2 px-3 py-2 bg-card rounded-lg border border-cream-200 cursor-text select-all"
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
                    className="inline-flex items-center gap-1 text-xs text-sal-600 hover:text-sal-700 transition-colors w-fit"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Open booking page
                  </a>
                </div>
              </div>
            </div>

            <Separator />

            {/* Lead Time */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground/70" />
                Lead Time
              </Label>
              <p className="text-xs text-muted-foreground">
                Minimum time before an appointment can be booked
              </p>
              <Select value={leadTime} onValueChange={setLeadTime}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No minimum</SelectItem>
                  <SelectItem value="1h">1 hour</SelectItem>
                  <SelectItem value="2h">2 hours</SelectItem>
                  <SelectItem value="4h">4 hours</SelectItem>
                  <SelectItem value="24h">24 hours</SelectItem>
                  <SelectItem value="48h">48 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Cancellation Policy */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Ban className="w-4 h-4 text-muted-foreground/70" />
                Cancellation Policy
              </Label>
              <p className="text-xs text-muted-foreground">
                How far in advance clients must cancel
              </p>
              <Select
                value={cancellationPolicy}
                onValueChange={setCancellationPolicy}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No policy</SelectItem>
                  <SelectItem value="1h">1 hour before</SelectItem>
                  <SelectItem value="4h">4 hours before</SelectItem>
                  <SelectItem value="24h">24 hours before</SelectItem>
                  <SelectItem value="48h">48 hours before</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Deposit Required */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-muted-foreground/70" />
                    Deposit Required
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Require a deposit when booking
                  </p>
                </div>
                <Switch
                  checked={depositRequired}
                  onCheckedChange={setDepositRequired}
                />
              </div>
              {depositRequired && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-2"
                >
                  <span className="text-sm text-muted-foreground">$</span>
                  <Input
                    type="number"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="w-24"
                    min="0"
                    step="5"
                  />
                  <span className="text-sm text-muted-foreground">deposit per booking</span>
                </motion.div>
              )}
            </div>

            <Separator />

            {/* Services Available Online */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">
                Services Available Online
              </Label>
              <p className="text-xs text-muted-foreground">
                Toggle which services can be booked online
              </p>
              <div className="space-y-4">
                {categories.map((category) => {
                  const categoryServices = services.filter(
                    (s) => s.category === category
                  )
                  return (
                    <div key={category} className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">
                        {category}
                      </p>
                      {categoryServices.map((service) => (
                        <div
                          key={service.id}
                          className="flex items-center justify-between py-1.5"
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: service.color }}
                            />
                            <span className="text-sm text-foreground">
                              {service.name}
                            </span>
                          </div>
                          <Switch
                            checked={serviceToggles[service.id] ?? true}
                            onCheckedChange={() =>
                              handleToggleService(service.id)
                            }
                          />
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Save Button */}
            <Button className="w-full" onClick={handleSave}>
              <Save className="w-4 h-4 mr-2" />
              Save Settings
            </Button>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
