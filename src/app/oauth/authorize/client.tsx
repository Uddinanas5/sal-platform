"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { approveOAuthConsent } from "@/lib/actions/oauth"

interface OAuthConsentProps {
  clientName: string
  scope: string
  clientId: string
  redirectUri: string
  state: string
  codeChallenge: string
  codeChallengeMethod: string
}

export function OAuthConsentClient({
  clientName,
  scope,
  clientId,
  redirectUri,
  state,
  codeChallenge,
  codeChallengeMethod,
}: OAuthConsentProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleApprove() {
    setLoading(true)
    setError("")
    const result = await approveOAuthConsent({
      clientId,
      redirectUri,
      state,
      codeChallenge,
      codeChallengeMethod,
      scope,
    })

    if (!result.success) {
      setError(result.error)
      setLoading(false)
      return
    }

    // Redirect to the client with the authorization code
    window.location.href = result.data.redirectUrl
  }

  function handleDeny() {
    const url = new URL(redirectUri)
    url.searchParams.set("error", "access_denied")
    url.searchParams.set("error_description", "User denied the authorization request")
    if (state) url.searchParams.set("state", state)
    window.location.href = url.toString()
  }

  const scopeDescriptions: Record<string, string> = {
    mcp: "Access your salon data through AI assistants (read and manage appointments, clients, services, and more)",
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
              Authorize {clientName}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              This application wants to access your SAL account
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg bg-cream-50 border border-cream-200 p-4">
            <p className="text-sm font-medium text-foreground mb-2">
              This will allow {clientName} to:
            </p>
            <ul className="space-y-2">
              {scope.split(" ").map((s) => (
                <li key={s} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <svg
                    className="w-4 h-4 text-sal-600 mt-0.5 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  {scopeDescriptions[s] ?? s}
                </li>
              ))}
            </ul>
          </div>

          {error && (
            <p className="text-sm text-red-500 text-center bg-red-50 p-2 rounded-lg" role="alert">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleDeny}
              disabled={loading}
            >
              Deny
            </Button>
            <Button
              className="flex-1"
              onClick={handleApprove}
              disabled={loading}
            >
              {loading ? "Authorizing..." : "Approve"}
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            You can revoke access at any time from your settings.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
