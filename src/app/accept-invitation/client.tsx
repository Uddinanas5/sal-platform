"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { Eye, EyeOff, ShieldAlert, ShieldCheck, CheckCircle2, XCircle, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { acceptInvitation } from "@/lib/actions/invitations"
import type { InvitationState } from "./page"

interface Props {
  state: InvitationState
}

function Logo() {
  return (
    <div className="mx-auto w-16 h-16 bg-sal-500 rounded-2xl flex items-center justify-center">
      <svg viewBox="0 0 32 32" className="w-10 h-10 text-white" fill="currentColor">
        <path d="M16 4c-2.5 0-4.5 1.2-5.8 3.1C8.9 8.9 8 11.3 8 14c0 3.5 1.5 6.5 4 8.5V26a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-3.5c2.5-2 4-5 4-8.5 0-2.7-.9-5.1-2.2-6.9C20.5 5.2 18.5 4 16 4z" />
      </svg>
    </div>
  )
}

function ErrorCard({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ElementType
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-cream p-4">
      <Card className="w-full max-w-md border-cream-200">
        <CardHeader className="text-center space-y-4">
          <Logo />
          <div className="flex justify-center">
            <Icon className="w-12 h-12 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">{title}</h1>
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          </div>
        </CardHeader>
        {action && (
          <CardContent className="flex justify-center">
            {action}
          </CardContent>
        )}
      </Card>
    </div>
  )
}

export default function AcceptInvitationClient({ state }: Props) {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [passwordError, setPasswordError] = useState("")
  const [loading, setLoading] = useState(false)

  if (state.status === "invalid_token") {
    return (
      <ErrorCard
        icon={XCircle}
        title="Invalid Invitation"
        description="This invitation link is invalid or has already been used. Please contact your administrator for a new invitation."
      />
    )
  }

  if (state.status === "expired") {
    return (
      <ErrorCard
        icon={Clock}
        title="Invitation Expired"
        description="This invitation link has expired. Please contact your administrator to send a new invitation."
      />
    )
  }

  if (state.status === "revoked") {
    return (
      <ErrorCard
        icon={XCircle}
        title="Invitation Revoked"
        description="This invitation has been revoked by your administrator. Please contact them if you believe this is an error."
      />
    )
  }

  if (state.status === "already_accepted") {
    return (
      <ErrorCard
        icon={CheckCircle2}
        title="Already Accepted"
        description="This invitation has already been accepted. Sign in to access your account."
        action={
          <Link href="/login">
            <Button>Go to Sign In</Button>
          </Link>
        }
      />
    )
  }

  const { token, email, firstName, businessName, role, isNewUser } = state
  const roleLabel = role === "admin" ? "Admin" : "Staff Member"
  const RoleIcon = role === "admin" ? ShieldAlert : ShieldCheck

  if (!isNewUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream p-4">
        <Card className="w-full max-w-md border-cream-200">
          <CardHeader className="text-center space-y-4">
            <Logo />
            <div className="flex justify-center">
              <CheckCircle2 className="w-12 h-12 text-sal-500" />
            </div>
            <div>
              <h1 className="text-2xl font-heading font-bold text-foreground">
                Join {businessName}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                You&apos;ve been invited as a{" "}
                <span className="font-medium text-foreground">{roleLabel}</span>
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-sal-50 border border-sal-200 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2">
                <RoleIcon className="w-4 h-4 text-sal-600" />
                <span className="text-sm font-medium text-sal-900">{roleLabel} at {businessName}</span>
              </div>
              <p className="text-xs text-sal-700">
                Signing in with your existing account ({email}) will grant you access.
              </p>
            </div>
            <Link href="/login">
              <Button className="w-full">Sign In to Accept</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPasswordError("")

    if (password.length < 8) {
      setPasswordError("Password must be at least 8 characters")
      return
    }
    if (password !== confirmPassword) {
      setPasswordError("Passwords do not match")
      return
    }

    setLoading(true)
    const result = await acceptInvitation({ token, password })
    setLoading(false)

    if (!result.success) {
      toast.error(result.error)
      return
    }

    toast.success("Account created! Sign in with your new credentials.")
    router.push(result.data.redirectUrl)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream p-4">
      <Card className="w-full max-w-md border-cream-200">
        <CardHeader className="text-center space-y-4">
          <Logo />
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">
              Join {businessName}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Hi {firstName}! Create a password to accept your invitation as{" "}
              <span className="font-medium text-foreground">{roleLabel}</span>.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="bg-sal-50 border border-sal-200 rounded-lg p-3 flex items-center gap-2 mb-6">
            <RoleIcon className="w-4 h-4 text-sal-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-sal-900">{businessName}</p>
              <p className="text-xs text-sal-700">{email} &middot; {roleLabel}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Create Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (passwordError) setPasswordError("")
                  }}
                  className={passwordError ? "border-red-500 pr-10" : "pr-10"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type={showPassword ? "text" : "password"}
                placeholder="Repeat your password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value)
                  if (passwordError) setPasswordError("")
                }}
                className={passwordError ? "border-red-500" : ""}
              />
            </div>

            {passwordError && (
              <p className="text-sm text-red-500" role="alert">{passwordError}</p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating account..." : "Create Account & Accept"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
