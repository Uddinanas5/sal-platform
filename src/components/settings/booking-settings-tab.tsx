"use client"

import React, { useState } from "react"
import { motion } from "framer-motion"
import {
  CalendarClock,
  Banknote,
  FileText,
  Plus,
  X,
  Save,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

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

export function BookingSettingsTab() {
  const [doubleBooking, setDoubleBooking] = useState(false)
  const [autoConfirm, setAutoConfirm] = useState(true)
  const [requireDeposit, setRequireDeposit] = useState(false)
  const [depositType, setDepositType] = useState<"percentage" | "fixed">("percentage")
  const [depositAmount, setDepositAmount] = useState("25")
  const [applyOverAmount, setApplyOverAmount] = useState("50")
  const [requiredFields, setRequiredFields] = useState({
    phone: true,
    email: true,
    address: false,
    notes: false,
  })
  const [customQuestions, setCustomQuestions] = useState<string[]>([])
  const [newQuestion, setNewQuestion] = useState("")

  const addCustomQuestion = () => {
    if (newQuestion.trim()) {
      setCustomQuestions([...customQuestions, newQuestion.trim()])
      setNewQuestion("")
    }
  }

  const removeQuestion = (index: number) => {
    setCustomQuestions(customQuestions.filter((_, i) => i !== index))
  }

  const handleSave = () => {
    toast.success("Booking settings saved successfully")
  }

  return (
    <div className="grid gap-6 max-w-4xl">
      {/* Booking Rules */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-heading">
              <CalendarClock className="w-5 h-5 text-sal-500" />
              Booking Rules
            </CardTitle>
            <CardDescription>
              Configure how clients can book appointments
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            <SettingRow
              label="Minimum Lead Time"
              description="How far in advance clients must book"
            >
              <Select defaultValue="2h">
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="1h">1 hour</SelectItem>
                  <SelectItem value="2h">2 hours</SelectItem>
                  <SelectItem value="4h">4 hours</SelectItem>
                  <SelectItem value="12h">12 hours</SelectItem>
                  <SelectItem value="24h">24 hours</SelectItem>
                  <SelectItem value="48h">48 hours</SelectItem>
                </SelectContent>
              </Select>
            </SettingRow>

            <SettingRow
              label="Maximum Advance Booking"
              description="How far into the future clients can book"
            >
              <Select defaultValue="1month">
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1week">1 week</SelectItem>
                  <SelectItem value="2weeks">2 weeks</SelectItem>
                  <SelectItem value="1month">1 month</SelectItem>
                  <SelectItem value="2months">2 months</SelectItem>
                  <SelectItem value="3months">3 months</SelectItem>
                </SelectContent>
              </Select>
            </SettingRow>

            <SettingRow
              label="Cancellation Window"
              description="Minimum notice required to cancel without penalty"
            >
              <Select defaultValue="24h">
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="1h">1 hour</SelectItem>
                  <SelectItem value="4h">4 hours</SelectItem>
                  <SelectItem value="12h">12 hours</SelectItem>
                  <SelectItem value="24h">24 hours</SelectItem>
                  <SelectItem value="48h">48 hours</SelectItem>
                </SelectContent>
              </Select>
            </SettingRow>

            <SettingRow
              label="Allow Double Booking"
              description="Allow multiple appointments in the same time slot"
            >
              <Switch
                checked={doubleBooking}
                onCheckedChange={setDoubleBooking}
              />
            </SettingRow>

            <SettingRow
              label="Auto-confirm Bookings"
              description="Automatically confirm new bookings without manual approval"
            >
              <Switch
                checked={autoConfirm}
                onCheckedChange={setAutoConfirm}
              />
            </SettingRow>
          </CardContent>
        </Card>
      </motion.div>

      {/* Deposit Settings */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-heading">
              <Banknote className="w-5 h-5 text-sal-500" />
              Deposit Settings
            </CardTitle>
            <CardDescription>
              Require deposits to reduce no-shows
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            <SettingRow
              label="Require Deposit"
              description="Require a deposit when booking"
            >
              <Switch
                checked={requireDeposit}
                onCheckedChange={setRequireDeposit}
              />
            </SettingRow>

            {requireDeposit && (
              <>
                <div className="py-4 border-b">
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Deposit Amount</Label>
                    <div className="flex items-center gap-3">
                      <Select
                        value={depositType}
                        onValueChange={(v) => setDepositType(v as "percentage" | "fixed")}
                      >
                        <SelectTrigger className="w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percentage">Percentage</SelectItem>
                          <SelectItem value="fixed">Fixed Amount</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="relative">
                        <Input
                          type="number"
                          value={depositAmount}
                          onChange={(e) => setDepositAmount(e.target.value)}
                          className="w-28 pr-8"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                          {depositType === "percentage" ? "%" : "$"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="py-4">
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Apply to Services Over</Label>
                    <div className="relative w-36">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                      <Input
                        type="number"
                        value={applyOverAmount}
                        onChange={(e) => setApplyOverAmount(e.target.value)}
                        className="pl-7"
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Only require deposits for services priced above this amount
                    </p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Booking Form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-heading">
              <FileText className="w-5 h-5 text-sal-500" />
              Booking Form
            </CardTitle>
            <CardDescription>
              Customize the information collected during booking
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <Label className="text-sm font-medium">Required Fields</Label>
              <div className="grid grid-cols-2 gap-4">
                {(
                  [
                    { key: "phone", label: "Phone Number" },
                    { key: "email", label: "Email Address" },
                    { key: "address", label: "Address" },
                    { key: "notes", label: "Notes" },
                  ] as const
                ).map((field) => (
                  <div key={field.key} className="flex items-center gap-3">
                    <Checkbox
                      id={`field-${field.key}`}
                      checked={requiredFields[field.key]}
                      onCheckedChange={(checked) =>
                        setRequiredFields({
                          ...requiredFields,
                          [field.key]: checked === true,
                        })
                      }
                    />
                    <Label htmlFor={`field-${field.key}`} className="cursor-pointer">
                      {field.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <Label className="text-sm font-medium">Custom Questions</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter a custom question..."
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      addCustomQuestion()
                    }
                  }}
                />
                <Button onClick={addCustomQuestion} size="sm" className="shrink-0">
                  <Plus className="w-4 h-4 mr-1" />
                  Add
                </Button>
              </div>
              {customQuestions.length > 0 && (
                <div className="space-y-2">
                  {customQuestions.map((question, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 rounded-lg bg-cream-50 border border-cream-200"
                    >
                      <span className="text-sm">{question}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeQuestion(index)}
                        className="h-8 w-8 p-0 text-muted-foreground/70 hover:text-red-500"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
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
