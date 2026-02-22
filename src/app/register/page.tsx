"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { registerBusiness } from "@/lib/actions/register"

export default function RegisterPage() {
  const router = useRouter()
  const [businessName, setBusinessName] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (!agreedToTerms) {
      setError("You must agree to the Terms of Service and Privacy Policy")
      return
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters")
      return
    }

    setLoading(true)

    const result = await registerBusiness({
      businessName,
      firstName,
      lastName,
      email,
      password,
    })

    if (!result.success) {
      setError(result.error)
      setLoading(false)
      return
    }

    // Sign in with the new credentials
    const signInResult = await signIn("credentials", {
      email,
      password,
      redirect: false,
    })

    setLoading(false)

    if (signInResult?.error) {
      setError("Account created but sign-in failed. Please go to the login page.")
      return
    }

    router.push("/onboarding")
    router.refresh()
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
            <h1 className="text-2xl font-heading font-bold text-foreground">Create your account</h1>
            <p className="text-sm text-muted-foreground mt-1">Get started with SAL for your business</p>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="businessName">Business name</Label>
              <Input
                id="businessName"
                type="text"
                placeholder="Your salon or spa name"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="firstName">First name</Label>
                <Input
                  id="firstName"
                  type="text"
                  placeholder="First name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last name</Label>
                <Input
                  id="lastName"
                  type="text"
                  placeholder="Last name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>

            <div className="flex items-start space-x-2">
              <Checkbox
                id="terms"
                checked={agreedToTerms}
                onCheckedChange={(checked) => setAgreedToTerms(checked === true)}
                className="mt-0.5"
              />
              <Label htmlFor="terms" className="text-sm font-normal leading-snug cursor-pointer">
                I agree to the{" "}
                <Link href="/terms" className="text-sal-600 hover:text-sal-700 underline">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="text-sal-600 hover:text-sal-700 underline">
                  Privacy Policy
                </Link>
              </Label>
            </div>

            {error && (
              <p className="text-sm text-red-500 text-center">{error}</p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating account..." : "Create Account"}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <span className="text-sm text-muted-foreground">Already have an account? </span>
            <Link
              href="/login"
              className="text-sm text-sal-600 hover:text-sal-700 font-medium"
            >
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
