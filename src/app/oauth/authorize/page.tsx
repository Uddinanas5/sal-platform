import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { OAuthConsentClient } from "./client"

type SearchParams = Promise<{
  client_id?: string
  redirect_uri?: string
  response_type?: string
  scope?: string
  state?: string
  code_challenge?: string
  code_challenge_method?: string
}>

export default async function OAuthAuthorizePage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const {
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: responseType,
    scope,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: codeChallengeMethod,
  } = params

  // Validate required params
  if (!clientId || !redirectUri || !responseType || !codeChallenge) {
    return (
      <ErrorPage message="Missing required OAuth parameters (client_id, redirect_uri, response_type, code_challenge)." />
    )
  }

  if (responseType !== "code") {
    return <ErrorPage message="Unsupported response_type. Only 'code' is supported." />
  }

  if (codeChallengeMethod && codeChallengeMethod !== "S256") {
    return (
      <ErrorPage message="Unsupported code_challenge_method. Only 'S256' is supported." />
    )
  }

  // Look up client
  const client = await prisma.oAuthClient.findUnique({
    where: { clientId },
  })

  if (!client) {
    return <ErrorPage message="Unknown client_id." />
  }

  // Validate redirect_uri
  if (!client.redirectUris.includes(redirectUri)) {
    return <ErrorPage message="Invalid redirect_uri for this client." />
  }

  // Check if user is logged in
  const session = await auth()
  if (!session?.user) {
    // Redirect to login, preserving the full OAuth URL as callbackUrl
    const currentUrl = new URL("/oauth/authorize", process.env.NEXTAUTH_URL || "http://localhost:3000")
    for (const [key, value] of Object.entries(params)) {
      if (value) currentUrl.searchParams.set(key, value)
    }
    const loginUrl = new URL("/login", process.env.NEXTAUTH_URL || "http://localhost:3000")
    loginUrl.searchParams.set("callbackUrl", currentUrl.toString())
    redirect(loginUrl.toString())
  }

  const user = session.user as { id?: string; name?: string; businessId?: string }
  if (!user.businessId) {
    return <ErrorPage message="You must complete onboarding before authorizing applications." />
  }

  // Render consent screen
  return (
    <OAuthConsentClient
      clientName={client.clientName}
      scope={scope ?? "mcp"}
      clientId={clientId}
      redirectUri={redirectUri}
      state={state ?? ""}
      codeChallenge={codeChallenge}
      codeChallengeMethod={codeChallengeMethod ?? "S256"}
    />
  )
}

function ErrorPage({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-cream p-4">
      <div className="w-full max-w-md bg-white rounded-xl border border-cream-200 p-8 text-center">
        <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h1 className="text-lg font-heading font-bold text-foreground mb-2">Authorization Error</h1>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  )
}
