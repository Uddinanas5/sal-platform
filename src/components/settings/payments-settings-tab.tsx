"use client"

import React, { useState } from "react"
import { motion } from "framer-motion"
import {
  Wallet,
  Receipt,
  HandCoins,
  Percent,
  Save,
} from "lucide-react"
import { toast } from "sonner"
import { TAX_RATE } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { StripeConnectSection } from "./stripe-connect-section"

interface PaymentsSettingsTabProps {
  businessId?: string
  businessName?: string
  businessEmail?: string
  stripeAccountId?: string | null
  stripeAccountStatus?: string | null
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between py-4 border-b last:border-b-0">
      <div className="space-y-0.5">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </div>
  )
}

export function PaymentsSettingsTab({
  businessId = "",
  businessName = "Your Business",
  businessEmail = "",
  stripeAccountId = null,
  stripeAccountStatus = null,
}: PaymentsSettingsTabProps = {}) {
  const [paymentMethods, setPaymentMethods] = useState({
    cash: true,
    card: true,
    giftCards: false,
    splitPayment: false,
  })
  const [taxRate, setTaxRate] = useState(String(TAX_RATE * 100))
  const [taxName, setTaxName] = useState("Sales Tax")
  const [taxOnProducts, setTaxOnProducts] = useState(true)
  const [taxOnServices, setTaxOnServices] = useState(true)
  const [enableTipping, setEnableTipping] = useState(true)
  const [tipAmounts, setTipAmounts] = useState(["15", "18", "20"])
  const [customTip, setCustomTip] = useState(true)
  const [autoSendReceipt, setAutoSendReceipt] = useState(true)
  const [receiptChannel, setReceiptChannel] = useState("email")
  const [receiptFooter, setReceiptFooter] = useState(
    "Thank you for choosing SAL Beauty Studio! We look forward to seeing you again."
  )

  const handleSave = () => {
    toast.success("Payment settings saved successfully")
  }

  return (
    <div className="grid gap-6 max-w-4xl">
      {/* Stripe Connect */}
      {businessId && (
        <StripeConnectSection
          businessId={businessId}
          businessName={businessName}
          businessEmail={businessEmail}
          stripeAccountId={stripeAccountId}
          stripeAccountStatus={stripeAccountStatus}
        />
      )}

      {/* Payment Methods */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-heading">
              <Wallet className="w-5 h-5 text-sal-500" />
              Payment Methods
            </CardTitle>
            <CardDescription>
              Choose which payment methods to accept
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            <SettingRow
              label="Cash"
              description="Accept cash payments at checkout"
            >
              <Switch
                checked={paymentMethods.cash}
                onCheckedChange={(v) =>
                  setPaymentMethods({ ...paymentMethods, cash: v })
                }
              />
            </SettingRow>
            <SettingRow
              label="Credit / Debit Card"
              description="Accept card payments via your payment processor"
            >
              <Switch
                checked={paymentMethods.card}
                onCheckedChange={(v) =>
                  setPaymentMethods({ ...paymentMethods, card: v })
                }
              />
            </SettingRow>
            <SettingRow
              label="Gift Cards"
              description="Allow clients to pay with gift cards"
            >
              <Switch
                checked={paymentMethods.giftCards}
                onCheckedChange={(v) =>
                  setPaymentMethods({ ...paymentMethods, giftCards: v })
                }
              />
            </SettingRow>
            <SettingRow
              label="Split Payment"
              description="Allow clients to split payment across multiple methods"
            >
              <Switch
                checked={paymentMethods.splitPayment}
                onCheckedChange={(v) =>
                  setPaymentMethods({ ...paymentMethods, splitPayment: v })
                }
              />
            </SettingRow>
          </CardContent>
        </Card>
      </motion.div>

      {/* Tax Settings */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-heading">
              <Percent className="w-5 h-5 text-sal-500" />
              Tax Settings
            </CardTitle>
            <CardDescription>
              Configure tax rates for your business
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tax Rate</Label>
                <div className="relative">
                  <Input
                    type="number"
                    step="0.001"
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                    className="pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    %
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Tax Name</Label>
                <Input
                  value={taxName}
                  onChange={(e) => setTaxName(e.target.value)}
                  placeholder="e.g., Sales Tax"
                />
              </div>
            </div>

            <div className="space-y-1">
              <SettingRow
                label="Apply Tax to Products"
                description="Charge tax on retail product sales"
              >
                <Switch
                  checked={taxOnProducts}
                  onCheckedChange={setTaxOnProducts}
                />
              </SettingRow>
              <SettingRow
                label="Apply Tax to Services"
                description="Charge tax on service appointments"
              >
                <Switch
                  checked={taxOnServices}
                  onCheckedChange={setTaxOnServices}
                />
              </SettingRow>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Tipping */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-heading">
              <HandCoins className="w-5 h-5 text-sal-500" />
              Tipping
            </CardTitle>
            <CardDescription>
              Configure tipping options for your clients
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            <SettingRow
              label="Enable Tipping"
              description="Allow clients to add tips during checkout"
            >
              <Switch
                checked={enableTipping}
                onCheckedChange={setEnableTipping}
              />
            </SettingRow>

            {enableTipping && (
              <>
                <div className="py-4 border-b">
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Suggested Tip Amounts</Label>
                    <div className="flex items-center gap-3">
                      {tipAmounts.map((amount, index) => (
                        <div key={index} className="relative">
                          <Input
                            type="number"
                            value={amount}
                            onChange={(e) => {
                              const updated = [...tipAmounts]
                              updated[index] = e.target.value
                              setTipAmounts(updated)
                            }}
                            className="w-24 pr-8"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                            %
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <SettingRow
                  label="Allow Custom Tip"
                  description="Let clients enter a custom tip amount"
                >
                  <Switch
                    checked={customTip}
                    onCheckedChange={setCustomTip}
                  />
                </SettingRow>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Receipts */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-heading">
              <Receipt className="w-5 h-5 text-sal-500" />
              Receipts
            </CardTitle>
            <CardDescription>
              Configure how receipts are sent to clients
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            <SettingRow
              label="Auto-send Receipt"
              description="Automatically send a receipt after payment"
            >
              <Switch
                checked={autoSendReceipt}
                onCheckedChange={setAutoSendReceipt}
              />
            </SettingRow>

            {autoSendReceipt && (
              <>
                <SettingRow
                  label="Receipt Channel"
                  description="How receipts are delivered to clients"
                >
                  <Select value={receiptChannel} onValueChange={setReceiptChannel}>
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="sms">SMS</SelectItem>
                      <SelectItem value="both">Both</SelectItem>
                    </SelectContent>
                  </Select>
                </SettingRow>

                <div className="py-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Receipt Footer Message</Label>
                    <Textarea
                      value={receiptFooter}
                      onChange={(e) => setReceiptFooter(e.target.value)}
                      placeholder="Add a custom message to the bottom of receipts..."
                      rows={3}
                    />
                    <p className="text-xs text-muted-foreground">
                      This message will appear at the bottom of every receipt
                    </p>
                  </div>
                </div>
              </>
            )}
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
