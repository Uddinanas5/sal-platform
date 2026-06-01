import type { NextRequest } from "next/server"
import NextAuth from "next-auth"
import { authConfig } from "@/lib/auth.config"
import { STAFF_BLOCKED_ROUTES, STAFF_LIST_BLOCKED_ROUTES } from "@/lib/permissions"

const { auth } = NextAuth(authConfig)

const publicRoutes = [
  /^\/$/,
  /^\/login$/,
  /^\/register$/,
  /^\/book\/.*/,
  /^\/terms$/,
  /^\/privacy$/,
  /^\/forgot-password$/,
  /^\/reset-password$/,
  /^\/accept-invitation$/,
  /^\/api\/auth\/.*/,
  /^\/_next\/.*/,
  /^\/favicon\.ico$/,
  /^\/api\/availability$/,
  /^\/api\/bookings(\/.*)?$/,
  /^\/api\/health$/,
  /^\/api\/stripe\/webhook$/,
  /^\/.well-known\/.*/,
  /^\/api\/oauth\/.*/,
  /^\/api\/v1\/.*/,
  /^\/oauth\/authorize$/,
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
})

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (pathname === "/api/v1" || pathname.startsWith("/api/v1/")) {
    return handleBearerOrSession(req)
  }
  if (pathname === "/api/mcp" || pathname.startsWith("/api/mcp/")) {
    return handleBearerOrSession(req)
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (authMiddleware as any)(req)
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|txt|xml|json|webmanifest|woff|woff2|ttf|otf|map|html)$).*)",
  ],

}
