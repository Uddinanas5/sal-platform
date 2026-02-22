"use client"

import React, { useState } from "react"
import { motion } from "framer-motion"
import {
  Globe,
  QrCode,
  Code2,
  Share2,
  Copy,
  Check,
  Download,
  Printer,
  ExternalLink,
  Save,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

function QrCodePlaceholder() {
  const size = 9
  const pattern = [
    [1,1,1,1,1,1,1,0,1],
    [1,0,0,0,0,0,1,0,0],
    [1,0,1,1,1,0,1,0,1],
    [1,0,1,1,1,0,1,0,0],
    [1,0,1,1,1,0,1,0,1],
    [1,0,0,0,0,0,1,0,1],
    [1,1,1,1,1,1,1,0,1],
    [0,0,0,0,0,0,0,0,0],
    [1,0,1,1,0,1,1,0,1],
  ]

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="w-48 h-48"
      xmlns="http://www.w3.org/2000/svg"
    >
      {pattern.map((row, y) =>
        row.map((cell, x) =>
          cell ? (
            <rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width={1}
              height={1}
              fill="#059669"
            />
          ) : null
        )
      )}
    </svg>
  )
}

export function OnlinePresenceTab() {
  const [slug, setSlug] = useState("sal-salon")
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)
  const [buttonColor, setButtonColor] = useState("#059669")
  const [buttonText, setButtonText] = useState("Book Now")
  const [widgetSize, setWidgetSize] = useState("medium")
  const [socialLinks, setSocialLinks] = useState({
    instagram: "",
    facebook: "",
    tiktok: "",
    website: "",
  })

  const bookingUrl = `https://meetsal.ai/book/${slug}`

  const embedCode = `<iframe
  src="${bookingUrl}?embed=true"
  width="${widgetSize === "small" ? "320" : widgetSize === "medium" ? "480" : "640"}"
  height="${widgetSize === "small" ? "500" : widgetSize === "medium" ? "600" : "700"}"
  frameborder="0"
  style="border: none; border-radius: 12px;"
></iframe>
<a
  href="${bookingUrl}"
  style="display: inline-block; padding: 12px 24px; background: ${buttonColor}; color: white; text-decoration: none; border-radius: 8px; font-family: sans-serif; font-weight: 600;"
>
  ${buttonText}
</a>`

  const copyToClipboard = async (text: string, type: "url" | "code") => {
    try {
      await navigator.clipboard.writeText(text)
      if (type === "url") {
        setCopiedUrl(true)
        setTimeout(() => setCopiedUrl(false), 2000)
      } else {
        setCopiedCode(true)
        setTimeout(() => setCopiedCode(false), 2000)
      }
      toast.success("Copied to clipboard")
    } catch {
      toast.error("Failed to copy to clipboard")
    }
  }

  const handleSave = () => {
    toast.success("Online presence settings saved successfully")
  }

  return (
    <div className="grid gap-6 max-w-4xl">
      {/* Booking Page */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-heading">
              <Globe className="w-5 h-5 text-sal-500" />
              Booking Page
            </CardTitle>
            <CardDescription>
              Your public online booking page
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Booking URL</Label>
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center rounded-lg border bg-cream-50 px-3 py-2">
                  <span className="text-sm text-muted-foreground mr-1">https://meetsal.ai/book/</span>
                  <span className="text-sm font-medium text-foreground">{slug}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(bookingUrl, "url")}
                >
                  {copiedUrl ? (
                    <Check className="w-4 h-4 mr-1" />
                  ) : (
                    <Copy className="w-4 h-4 mr-1" />
                  )}
                  {copiedUrl ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Custom Slug</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">meetsal.ai/book/</span>
                <Input
                  value={slug}
                  onChange={(e) =>
                    setSlug(
                      e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9-]/g, "-")
                    )
                  }
                  className="max-w-xs"
                  placeholder="your-salon-name"
                />
              </div>
            </div>

            <Button variant="outline" size="sm">
              <ExternalLink className="w-4 h-4 mr-2" />
              Preview Booking Page
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      {/* QR Code */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-heading">
              <QrCode className="w-5 h-5 text-sal-500" />
              QR Code
            </CardTitle>
            <CardDescription>
              Let clients scan to access your booking page
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-8">
              <div className="p-4 bg-white rounded-xl border-2 border-cream-200 shadow-sm">
                <QrCodePlaceholder />
              </div>
              <div className="space-y-4 flex-1">
                <p className="text-sm text-muted-foreground">
                  Display this QR code in your salon, on business cards, or in
                  marketing materials. Clients can scan it to instantly access
                  your booking page.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toast.success("QR code downloaded")}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toast.success("Sent to printer")}
                  >
                    <Printer className="w-4 h-4 mr-2" />
                    Print
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Widget Embed */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-heading">
              <Code2 className="w-5 h-5 text-sal-500" />
              Widget Embed
            </CardTitle>
            <CardDescription>
              Add a booking widget to your website
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Embed Code</Label>
              <div className="relative">
                <pre className="p-4 rounded-lg bg-foreground text-green-400 text-xs overflow-x-auto font-mono leading-relaxed">
                  {embedCode}
                </pre>
                <Button
                  variant="secondary"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() => copyToClipboard(embedCode, "code")}
                >
                  {copiedCode ? (
                    <Check className="w-4 h-4 mr-1" />
                  ) : (
                    <Copy className="w-4 h-4 mr-1" />
                  )}
                  {copiedCode ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <Label className="text-sm font-medium">Customization</Label>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Button Color</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={buttonColor}
                      onChange={(e) => setButtonColor(e.target.value)}
                      className="w-10 h-10 rounded-lg border border-cream-200 cursor-pointer"
                    />
                    <Input
                      value={buttonColor}
                      onChange={(e) => setButtonColor(e.target.value)}
                      className="font-mono text-sm"
                      maxLength={7}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Button Text</Label>
                  <Input
                    value={buttonText}
                    onChange={(e) => setButtonText(e.target.value)}
                    placeholder="Book Now"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Widget Size</Label>
                  <Select value={widgetSize} onValueChange={setWidgetSize}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small">Small (320px)</SelectItem>
                      <SelectItem value="medium">Medium (480px)</SelectItem>
                      <SelectItem value="large">Large (640px)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Social Links */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-heading">
              <Share2 className="w-5 h-5 text-sal-500" />
              Social Links
            </CardTitle>
            <CardDescription>
              Connect your social media profiles
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Instagram</Label>
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 text-white shrink-0">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                  </svg>
                </div>
                <Input
                  value={socialLinks.instagram}
                  onChange={(e) =>
                    setSocialLinks({ ...socialLinks, instagram: e.target.value })
                  }
                  placeholder="https://instagram.com/yoursalon"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Facebook</Label>
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-600 text-white shrink-0">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                </div>
                <Input
                  value={socialLinks.facebook}
                  onChange={(e) =>
                    setSocialLinks({ ...socialLinks, facebook: e.target.value })
                  }
                  placeholder="https://facebook.com/yoursalon"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">TikTok</Label>
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-black text-white shrink-0">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
                  </svg>
                </div>
                <Input
                  value={socialLinks.tiktok}
                  onChange={(e) =>
                    setSocialLinks({ ...socialLinks, tiktok: e.target.value })
                  }
                  placeholder="https://tiktok.com/@yoursalon"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Website</Label>
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-foreground/80 text-white shrink-0">
                  <Globe className="w-5 h-5" />
                </div>
                <Input
                  value={socialLinks.website}
                  onChange={(e) =>
                    setSocialLinks({ ...socialLinks, website: e.target.value })
                  }
                  placeholder="https://yoursalon.com"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <div className="flex justify-end">
        <Button onClick={handleSave}>
          <Save className="w-4 h-4 mr-2" />
          Save Changes
        </Button>
      </div>
    </div>
  )
}
