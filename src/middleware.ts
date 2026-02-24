import NextAuth from "next-auth"
import { authConfig } from "@/lib/auth.config"
import { STAFF_BLOCKED_ROUTES } from "@/lib/permissions"

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
  /^\/api\/services$/,
  /^\/api\/staff$/,
  /^\/api\/bookings(\/.*)?$/,
  /^\/api\/health$/,
]

export default auth((req) => {
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
  }
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
