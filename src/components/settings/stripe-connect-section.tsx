"use client"

import React, { useState } from "react"
import { motion } from "framer-motion"
import {
  CreditCard,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  Shield,
  Zap,
  Wallet,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface StripeConnectSectionProps {
  stripeAccountId?: string | null
  stripeAccountStatus?: string | null
  businessId: string
  businessName: string
  businessEmail: string
}

export function StripeConnectSection({
  stripeAccountId,
  stripeAccountStatus,
  businessId,
  businessName,
  businessEmail,
}: StripeConnectSectionProps) {
  const [isConnecting, setIsConnecting] = useState(false)
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false)

  const isConnected = stripeAccountId && stripeAccountStatus === "active"
  const isPending = stripeAccountId && stripeAccountStatus === "pending"
  const isRestricted = stripeAccountId && stripeAccountStatus === "restricted"

  const handleConnect = async () => {
    setIsConnecting(true)
    try {
      const response = await fetch("/api/stripe/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, businessName, email: businessEmail }),
      })

      if (!response.ok) {
        throw new Error("Failed to create Stripe account")
      }

      const { onboardingUrl } = await response.json()
      window.location.href = onboardingUrl
    } catch (error) {
      console.error("Error connecting Stripe:", error)
      toast.error("Failed to start Stripe onboarding. Please try again.")
    } finally {
      setIsConnecting(false)
    }
  }

  const handleOpenDashboard = async () => {
    if (!stripeAccountId) return

    setIsLoadingDashboard(true)
    try {
      const response = await fetch("/api/stripe/dashboard-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: stripeAccountId }),
      })

      if (!response.ok) {
        throw new Error("Failed to create dashboard link")
      }

      const { url } = await response.json()
      window.open(url, "_blank")
    } catch (error) {
      console.error("Error opening dashboard:", error)
      toast.error("Failed to open Stripe dashboard. Please try again.")
    } finally {
      setIsLoadingDashboard(false)
    }
  }

  const getStatusBadge = () => {
    if (isConnected) {
      return (
        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Connected
        </Badge>
      )
    }
    if (isPending) {
      return (
        <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          Pending Verification
        </Badge>
      )
    }
    if (isRestricted) {
      return (
        <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
          <AlertCircle className="w-3 h-3 mr-1" />
          Action Required
        </Badge>
      )
    }
    return (
      <Badge variant="outline" className="text-muted-foreground">
        Not Connected
      </Badge>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-gradient-to-r from-[#635bff]/5 to-[#00d4ff]/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#635bff] rounded-lg">
                <CreditCard className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="font-heading flex items-center gap-2">
                  Stripe Connect
                  {getStatusBadge()}
                </CardTitle>
                <CardDescription>
                  Accept card payments and manage payouts securely
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {!stripeAccountId ? (
            // Not connected - show connect CTA
            <div className="space-y-6">
              <div className="grid md:grid-cols-3 gap-4">
                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                  <Shield className="w-5 h-5 text-sal-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Secure Payments</p>
                    <p className="text-xs text-muted-foreground">
                      PCI-DSS Level 1 compliant payment processing
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                  <Zap className="w-5 h-5 text-sal-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Fast Payouts</p>
                    <p className="text-xs text-muted-foreground">
                      Get paid directly to your bank account
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                  <Wallet className="w-5 h-5 text-sal-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">All Payment Types</p>
                    <p className="text-xs text-muted-foreground">
                      Cards, Apple Pay, Google Pay & more
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border rounded-lg bg-card">
                <div>
                  <p className="font-medium">Ready to accept payments?</p>
                  <p className="text-sm text-muted-foreground">
                    Connect your Stripe account in just a few minutes
                  </p>
                </div>
                <Button
                  onClick={handleConnect}
                  disabled={isConnecting}
                  className="bg-[#635bff] hover:bg-[#5851e6] text-white shrink-0"
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      Connect with Stripe
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                By connecting, you agree to Stripe&apos;s{" "}
                <a
                  href="https://stripe.com/legal/connect-account"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground"
                >
                  Connected Account Agreement
                </a>
              </p>
            </div>
          ) : isConnected ? (
            // Connected - show status and dashboard link
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg bg-green-50/50 border-green-200">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                  <div>
                    <p className="font-medium text-green-900">
                      Payments are active
                    </p>
                    <p className="text-sm text-green-700">
                      You can accept card payments from clients
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={handleOpenDashboard}
                  disabled={isLoadingDashboard}
                  className="shrink-0"
                >
                  {isLoadingDashboard ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      Open Stripe Dashboard
                      <ExternalLink className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg border bg-muted/30">
                  <p className="text-xs text-muted-foreground">Account ID</p>
                  <p className="text-sm font-mono">{stripeAccountId}</p>
                </div>
                <div className="p-3 rounded-lg border bg-muted/30">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className="text-sm font-medium text-green-600">Active</p>
                </div>
              </div>
            </div>
          ) : isPending || isRestricted ? (
            // Pending or restricted - show action required
            <div className="space-y-4">
              <div className={`flex items-center justify-between p-4 border rounded-lg ${
                isPending ? "bg-yellow-50/50 border-yellow-200" : "bg-red-50/50 border-red-200"
              }`}>
                <div className="flex items-center gap-3">
                  <AlertCircle className={`w-8 h-8 ${isPending ? "text-yellow-600" : "text-red-600"}`} />
                  <div>
                    <p className={`font-medium ${isPending ? "text-yellow-900" : "text-red-900"}`}>
                      {isPending ? "Verification in progress" : "Action required"}
                    </p>
                    <p className={`text-sm ${isPending ? "text-yellow-700" : "text-red-700"}`}>
                      {isPending
                        ? "Stripe is reviewing your information"
                        : "Please complete the required information"}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={handleConnect}
                  disabled={isConnecting}
                  className={isPending ? "bg-yellow-600 hover:bg-yellow-700" : "bg-red-600 hover:bg-red-700"}
                >
                  {isConnecting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      {isPending ? "Check Status" : "Complete Setup"}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </motion.div>
  )
}
