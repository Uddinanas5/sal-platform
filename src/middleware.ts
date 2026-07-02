import { type NextRequest, NextResponse } from "next/server"
import NextAuth from "next-auth"
import { authConfig } from "@/lib/auth.config"
import { STAFF_BLOCKED_ROUTES, STAFF_LIST_BLOCKED_ROUTES } from "@/lib/permissions"
import { rateLimit } from "@/lib/rate-limit"

// Forward the request pathname to Server Components via a request header. Next
// 14 does not expose the current path to a layout server component, but the
// SAL billing gate in (dashboard)/layout.tsx needs it to allow /settings
// through (so a cancelled salon can resubscribe instead of redirect-looping).
function continueWithPathname(req: NextRequest): Response {
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set("x-pathname", req.nextUrl.pathname)
  // Stamp a request id (reuse an upstream one if present) so structured logs +
  // the response can be correlated for a single request.
  const requestId = req.headers.get("x-request-id") || crypto.randomUUID()
  requestHeaders.set("x-request-id", requestId)
  const res = NextResponse.next({ request: { headers: requestHeaders } })
  res.headers.set("x-request-id", requestId)
  return res
}

const { auth } = NextAuth(authConfig)

const publicRoutes = [
  /^\/$/,
  /^\/login$/,
  /^\/register$/,
  /^\/book\/.*/,
  /^\/embed\.js$/,
  /^\/r\/.*/, // public review capture (emailed link) — the live funnel
  /^\/terms$/,
  /^\/privacy$/,
  /^\/forgot-password$/,
  /^\/reset-password$/,
  /^\/accept-invitation$/,
  /^\/api\/auth\/.*/,
  /^\/_next\/.*/,
  /^\/favicon\.ico$/,
  /^\/api\/availability$/,
  /^\/api\/booking-qr$/,
  /^\/api\/cron\/.*/,
  /^\/api\/bookings(\/.*)?$/,
  /^\/api\/health$/,
  /^\/api\/stripe\/webhook$/,
  /^\/.well-known\/.*/,
  /^\/api\/oauth\/.*/,
  /^\/api\/v1\/.*/,
  // Sentry tunnel (next.config tunnelRoute) — client error envelopes POST here
  // same-origin so the strict CSP/adblockers don't drop them. Must stay public.
  /^\/monitoring(\/.*)?$/,
  /^\/oauth\/authorize$/,
  // Stripe calls this server-to-server with no session — authenticated by signature verification in the route
  /^\/api\/stripe\/webhook$/,
]

// Bearer-or-session gate used by /api/v1/* and /api/mcp. Handled outside the
// auth() HOC so NextAuth doesn't mint csrf / callback-url cookies on
// unauthenticated 401 responses (the HOC appends those regardless of what the
// inner middleware returns), and so OPTIONS gets 401'd at the edge instead of
// leaking Allow headers from the route handler.
function handleBearerOrSession(req: NextRequest): Response | undefined {
  // OPTIONS is always 401'd: these endpoints are programmatic (no real browser
  // CORS preflight), and Next's auto-OPTIONS would otherwise leak Allow headers
  // listing every exported HTTP method on the route.
  if (req.method === "OPTIONS") {
    return Response.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
      { status: 401 }
    )
  }
  const hasBearer = req.headers.get("authorization")?.startsWith("Bearer ")
  const hasSessionCookie = req.cookies
    .getAll()
    .some((c) => c.name.includes("authjs.session-token"))
  if (!hasBearer && !hasSessionCookie) {
    return Response.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
      { status: 401 }
    )
  }
}

const authMiddleware = auth((req) => {
  const { pathname } = req.nextUrl

  const isPublic = publicRoutes.some((pattern) => pattern.test(pathname))

  if (isPublic) return

  if (!req.auth) {
    const loginUrl = new URL("/login", req.nextUrl.origin)
    loginUrl.searchParams.set("callbackUrl", pathname)
    return Response.redirect(loginUrl)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const businessId = (req.auth as any).user?.businessId
  if (!businessId && pathname !== "/onboarding") {
    return Response.redirect(new URL("/onboarding", req.nextUrl.origin))
  }

  // Role-based route guard
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userRole = (req.auth as any).user?.role as string | undefined
  if (userRole === "client") {
    return Response.redirect(new URL("/login", req.nextUrl.origin))
  }
  if (userRole === "staff") {
    const isBlocked = STAFF_BLOCKED_ROUTES.some(
      (r) => pathname === r || pathname.startsWith(r + "/")
    )
    if (isBlocked) {
      return Response.redirect(new URL("/dashboard", req.nextUrl.origin))
    }
    // Block staff from list pages but allow sub-routes (e.g. /staff is blocked, /staff/[id] is allowed)
    const isListBlocked = STAFF_LIST_BLOCKED_ROUTES.some(
      (r) => pathname === r
    )
    if (isListBlocked) {
      return Response.redirect(new URL("/dashboard", req.nextUrl.origin))
    }
  }

  // Authenticated request is allowed through — continue, attaching x-pathname so
  // server components (the billing gate) can read the current path.
  return continueWithPathname(req)
})

// IP-based throttle for the programmatic API surface. This is the single
// chokepoint in front of /api/v1, /api/mcp and /api/oauth, so one check here
// protects the whole surface (expensive checkout transactions, joined list
// endpoints, unauthenticated OAuth client registration) from a scripted client
// or leaked key hammering it. Distributed via Upstash when configured; otherwise
// best-effort per-instance (documented in docs/PRODUCTION_READINESS.md).
const API_RATE_MAX = 300 // requests
const API_RATE_WINDOW_MS = 60_000 // per minute per IP

function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for")
  if (xff) return xff.split(",")[0].trim()
  return req.headers.get("x-real-ip") || "unknown"
}

async function throttleApi(req: NextRequest, bucket: string): Promise<Response | undefined> {
  const res = await rateLimit(`api:${bucket}:${clientIp(req)}`, API_RATE_MAX, API_RATE_WINDOW_MS)
  if (res.limited) {
    return Response.json(
      { error: { code: "RATE_LIMITED", message: "Too many requests — slow down." } },
      { status: 429, headers: { "Retry-After": String(Math.ceil(res.retryAfterMs / 1000)) } }
    )
  }
}

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (pathname === "/api/v1" || pathname.startsWith("/api/v1/")) {
    return (await throttleApi(req, "v1")) ?? handleBearerOrSession(req)
  }
  if (pathname === "/api/mcp" || pathname.startsWith("/api/mcp/")) {
    return (await throttleApi(req, "mcp")) ?? handleBearerOrSession(req)
  }
  // Unauthenticated OAuth dynamic client registration (RFC 7591): must be open,
  // but a tighter cap stops unbounded oauth_clients row-spam (P3-17).
  if (pathname === "/api/oauth/register") {
    const limited = await rateLimit(`oauth-register:${clientIp(req)}`, 10, 3_600_000)
    if (limited.limited) {
      return Response.json(
        { error: "rate_limited", error_description: "Too many registrations — try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(limited.retryAfterMs / 1000)) } }
      )
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (authMiddleware as any)(req)
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|txt|xml|json|webmanifest|woff|woff2|ttf|otf|map|html)$).*)",
  ],

}
