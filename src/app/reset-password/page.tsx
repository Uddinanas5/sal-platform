"use client"

import { useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { resetPassword } from "@/lib/actions/password-reset"
import { ArrowLeft, CheckCircle2, AlertCircle, Eye, EyeOff } from "lucide-react"

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  // If no token, show error state
  if (!token) {
    return (
      <div className="text-center space-y-4">
        <div className="mx-auto w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center">
          <AlertCircle className="w-6 h-6 text-red-600" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">Invalid Reset Link</h2>
        <p className="text-sm text-muted-foreground">
          This password reset link is missing or invalid. Please request a new one.
        </p>
        <Link href="/forgot-password">
          <Button className="w-full">Request New Reset Link</Button>
        </Link>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.")
      return
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    setLoading(true)

    const result = await resetPassword(token!, password)

    setLoading(false)

    if (result.success) {
      setSuccess(true)
      setTimeout(() => {
        router.push("/login")
      }, 3000)
    } else {
      setError(result.error)
    }
  }

  if (success) {
    return (
      <div className="text-center space-y-4">
        <div className="mx-auto w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center">
          <CheckCircle2 className="w-6 h-6 text-emerald-600" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">Password Reset Successful</h2>
        <p className="text-sm text-muted-foreground">
          Your password has been updated. Redirecting you to sign in...
        </p>
        <Link href="/login">
          <Button variant="outline" className="w-full">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go to Sign In
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">New Password</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoFocus
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm New Password</Label>
        <div className="relative">
          <Input
            id="confirmPassword"
            type={showConfirm ? "text" : "password"}
            placeholder="Re-enter your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
          />
          <button
            type="button"
            onClick={() => setShowConfirm(!showConfirm)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            tabIndex={-1}
          >
            {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-500/10 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Resetting..." : "Reset Password"}
      </Button>

      <div className="text-center">
        <Link
          href="/forgot-password"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-sal-600 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" />
          Request a new reset link
        </Link>
      </div>
    </form>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-cream p-4">
      <Card className="w-full max-w-md border-cream-200">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-sal-500 rounded-2xl flex items-center justify-center">
            <svg viewBox="0 0 32 32" className="w-10 h-10 text-white" fill="currentColor">
              <path d="M16 4c-2.5 0-4.5 1.2-5.8 3.1C8.9 8.9 8 11.3 8 14c0 3.5 1.5 6.5 4 8.5V26a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-3.5c2.5-2 4-5 4-8.5 0-2.7-.9-5.1-2.2-6.9C20.5 5.2 18.5 4 16 4z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">
              Reset Password
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Enter your new password below
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-sal-500 border-t-transparent rounded-full animate-spin" />
              </div>
            }
          >
            <ResetPasswordForm />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}
