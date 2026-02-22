"use client"

import React from "react"
import { motion } from "framer-motion"
import { Package, Check, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { formatCurrency } from "@/lib/utils"
import { toast } from "sonner"

interface BundleService {
  name: string
  originalPrice: number
}

interface ServiceBundle {
  id: string
  name: string
  description: string
  services: BundleService[]
  bundlePrice: number
  color: string
  popular?: boolean
}

const mockBundles: ServiceBundle[] = [
  {
    id: "b1",
    name: "Hair & Facial Package",
    description: "Complete hair styling with a rejuvenating facial treatment",
    services: [
      { name: "Classic Haircut", originalPrice: 45 },
      { name: "Blowout & Style", originalPrice: 35 },
      { name: "Facial Treatment", originalPrice: 85 },
    ],
    bundlePrice: 139,
    color: "#059669",
    popular: true,
  },
  {
    id: "b2",
    name: "Full Pamper Package",
    description: "Head-to-toe pampering for the ultimate relaxation experience",
    services: [
      { name: "Deep Tissue Massage", originalPrice: 95 },
      { name: "Manicure & Pedicure", originalPrice: 65 },
      { name: "Facial Treatment", originalPrice: 85 },
      { name: "Eyebrow Wax & Shape", originalPrice: 20 },
    ],
    bundlePrice: 219,
    color: "#8b5cf6",
  },
  {
    id: "b3",
    name: "Color & Care Bundle",
    description: "Premium color treatment with deep conditioning and styling",
    services: [
      { name: "Color Treatment", originalPrice: 150 },
      { name: "Blowout & Style", originalPrice: 35 },
    ],
    bundlePrice: 159,
    color: "#ec4899",
  },
]

export function ServiceBundles() {
  const handleBookBundle = (bundle: ServiceBundle) => {
    toast.success(`Booking "${bundle.name}" -- redirecting...`)
  }

  const handleCreateBundle = () => {
    toast.info("Bundle creation form coming soon")
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-sal-600" />
            <CardTitle className="text-lg font-heading">
              Service Bundles
            </CardTitle>
          </div>
          <Button variant="outline" size="sm" onClick={handleCreateBundle}>
            Create Bundle
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Bundled packages at special prices
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {mockBundles.map((bundle, index) => {
            const originalTotal = bundle.services.reduce(
              (sum, s) => sum + s.originalPrice,
              0
            )
            const savings = originalTotal - bundle.bundlePrice
            const savingsPercent = Math.round((savings / originalTotal) * 100)

            return (
              <motion.div
                key={bundle.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="relative rounded-xl border border-cream-200 bg-card overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* Color accent */}
                <div
                  className="h-1.5"
                  style={{ backgroundColor: bundle.color }}
                />

                {bundle.popular && (
                  <div className="absolute top-4 right-3">
                    <Badge className="bg-sal-500 text-white text-xs">
                      <Sparkles className="w-3 h-3 mr-1" />
                      Popular
                    </Badge>
                  </div>
                )}

                <div className="p-4">
                  <h4 className="font-semibold text-foreground">
                    {bundle.name}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {bundle.description}
                  </p>

                  <Separator className="my-3" />

                  {/* Included services */}
                  <div className="space-y-1.5 mb-4">
                    {bundle.services.map((service, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between text-sm"
                      >
                        <div className="flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5 text-sal-500" />
                          <span className="text-foreground">{service.name}</span>
                        </div>
                        <span className="text-muted-foreground/70 line-through text-xs">
                          {formatCurrency(service.originalPrice)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Pricing */}
                  <div className="bg-cream-100 rounded-lg p-3 mb-3">
                    <div className="flex items-baseline justify-between">
                      <div>
                        <span className="text-xs text-muted-foreground line-through mr-2">
                          {formatCurrency(originalTotal)}
                        </span>
                        <span className="text-lg font-bold text-foreground">
                          {formatCurrency(bundle.bundlePrice)}
                        </span>
                      </div>
                      <Badge
                        variant="secondary"
                        className="bg-green-100 text-green-700 text-xs"
                      >
                        Save {savingsPercent}%
                      </Badge>
                    </div>
                    <p className="text-xs text-sal-600 font-medium mt-1">
                      You save {formatCurrency(savings)}
                    </p>
                  </div>

                  <Button
                    className="w-full"
                    size="sm"
                    onClick={() => handleBookBundle(bundle)}
                  >
                    Book Bundle
                  </Button>
                </div>
              </motion.div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
