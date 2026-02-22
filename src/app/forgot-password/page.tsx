"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { requestPasswordReset } from "@/lib/actions/password-reset"
import { ArrowLeft, Mail, CheckCircle2 } from "lucide-react"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    const result = await requestPasswordReset(email)

    setLoading(false)

    if (result.success) {
      setSent(true)
    } else {
      setError(result.error)
    }
  }

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
              Forgot Password
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {sent
                ? "Check your inbox for a reset link"
                : "Enter your email to receive a reset link"}
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="text-center space-y-4">
              <div className="mx-auto w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                If an account exists with <strong className="text-foreground">{email}</strong>,
                we&apos;ve sent a password reset link. Please check your email and follow the
                instructions.
              </p>
              <p className="text-xs text-muted-foreground">
                Didn&apos;t receive it? Check your spam folder or try again.
              </p>
              <div className="pt-2 space-y-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setSent(false)
                    setEmail("")
                  }}
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Try a different email
                </Button>
                <Link href="/login" className="block">
                  <Button variant="ghost" className="w-full text-sal-600">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Sign In
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              {error && (
                <p className="text-sm text-red-500 text-center">{error}</p>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Sending..." : "Send Reset Link"}
              </Button>

              <div className="text-center">
                <Link
                  href="/login"
                  className="inline-flex items-center text-sm text-muted-foreground hover:text-sal-600 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                  Back to Sign In
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
