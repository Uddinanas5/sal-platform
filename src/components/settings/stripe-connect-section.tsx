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
        throw new Error("Failed to start SAL Payments setup")
      }

      const { onboardingUrl } = await response.json()
      window.location.href = onboardingUrl
    } catch (error) {
      console.error("Error starting SAL Payments setup:", error)
      toast.error("Failed to start SAL Payments setup. Please try again.")
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
      console.error("Error opening payment dashboard:", error)
      toast.error("Failed to open payment dashboard. Please try again.")
    } finally {
      setIsLoadingDashboard(false)
    }
  }

  const getStatusBadge = () => {
    if (isConnected) {
      return (
        <Badge className="bg-green-400/15 text-green-300 border-green-400/25 hover:bg-green-400/15">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Connected
        </Badge>
      )
    }
    if (isPending) {
      return (
        <Badge className="bg-yellow-400/15 text-yellow-300 border-yellow-400/25 hover:bg-yellow-400/15">
          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          Pending Verification
        </Badge>
      )
    }
    if (isRestricted) {
      return (
        <Badge className="bg-red-400/15 text-red-300 border-red-400/25 hover:bg-red-400/15">
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
        <CardHeader className="border-b bg-gradient-to-r from-sal-500/10 to-emerald-400/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-sal-500 rounded-lg">
                <CreditCard className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="font-heading flex items-center gap-2">
                  SAL Payments
                  {getStatusBadge()}
                </CardTitle>
                <CardDescription>
                  Accept client payments and manage payouts securely
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
                <div className="flex items-start gap-3 p-4 rounded-lg bg-white/[0.06]">
                  <Shield className="w-5 h-5 text-mint-strong mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Secure Payments</p>
                    <p className="text-xs text-muted-foreground">
                      PCI-DSS Level 1 compliant payment processing
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-lg bg-white/[0.06]">
                  <Zap className="w-5 h-5 text-mint-strong mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Fast Payouts</p>
                    <p className="text-xs text-muted-foreground">
                      Get paid directly to your bank account
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-lg bg-white/[0.06]">
                  <Wallet className="w-5 h-5 text-mint-strong mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">All Payment Types</p>
                    <p className="text-xs text-muted-foreground">
                      Cards, Apple Pay, Google Pay & more
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 glass-tile rounded-tile">
                <div>
                  <p className="font-medium">Ready to accept payments?</p>
                  <p className="text-sm text-muted-foreground">
                    Activate payments in just a few minutes
                  </p>
                </div>
                <Button
                  onClick={handleConnect}
                  disabled={isConnecting}
                  className="shrink-0"
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Starting setup...
                    </>
                  ) : (
                    <>
                      Activate SAL Payments
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                SAL Payments is powered by Stripe. By activating payments, you agree to Stripe&apos;s{" "}
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
              <div className="flex items-center justify-between p-4 border rounded-lg bg-green-400/10 border-green-400/25">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-8 h-8 text-green-400" />
                  <div>
                    <p className="font-medium text-green-200">
                      Payments are active
                    </p>
                    <p className="text-sm text-green-300">
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
                      Open payment dashboard
                      <ExternalLink className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg border border-white/10 bg-white/[0.06]">
                  <p className="text-xs text-muted-foreground">Account ID</p>
                  <p className="text-sm font-mono">{stripeAccountId}</p>
                </div>
                <div className="p-3 rounded-lg border border-white/10 bg-white/[0.06]">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className="text-sm font-medium text-green-400">Active</p>
                </div>
              </div>
            </div>
          ) : isPending || isRestricted ? (
            // Pending or restricted - show action required
            <div className="space-y-4">
              <div className={`flex items-center justify-between p-4 border rounded-lg ${
                isPending ? "bg-yellow-400/10 border-yellow-400/25" : "bg-red-400/10 border-red-400/25"
              }`}>
                <div className="flex items-center gap-3">
                  <AlertCircle className={`w-8 h-8 ${isPending ? "text-yellow-400" : "text-red-400"}`} />
                  <div>
                    <p className={`font-medium ${isPending ? "text-yellow-200" : "text-red-200"}`}>
                      {isPending ? "Verification in progress" : "Action required"}
                    </p>
                    <p className={`text-sm ${isPending ? "text-yellow-300" : "text-red-300"}`}>
                      {isPending
                        ? "Your payment setup is being reviewed"
                        : "Please complete the required information"}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={handleConnect}
                  disabled={isConnecting}
                  className={isPending ? "bg-none bg-yellow-600 hover:bg-yellow-700" : "bg-none bg-red-600 hover:bg-red-700"}
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
