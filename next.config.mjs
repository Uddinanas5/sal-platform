import path from "path"
import { fileURLToPath } from "url"
import { withSentryConfig } from "@sentry/nextjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const isDev = process.env.NODE_ENV === "development"

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  async headers() {
    const commonHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-DNS-Prefetch-Control", value: "on" },
      ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]),
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ]
    const scriptSrc = isDev
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com"
      : "script-src 'self' 'unsafe-inline' https://js.stripe.com"
    const connectSrc = isDev
      ? "connect-src 'self' ws://localhost:3000 http://localhost:3000 https://api.stripe.com https://*.supabase.co"
      : "connect-src 'self' https://api.stripe.com https://*.supabase.co"
    return [
      {
        // Public booking pages stay embeddable (booking widget / embed.js)
        source: "/book/:path*",
        headers: [
          ...commonHeaders,
          {
            key: "Content-Security-Policy",
            value: `default-src 'self'; ${scriptSrc}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; ${connectSrc}; frame-src 'self' https://js.stripe.com https://hooks.stripe.com; frame-ancestors *;`
          },
        ],
      },
      {
        source: "/((?!book(?:/|$)).*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          ...commonHeaders,
          {
            key: "Content-Security-Policy",
            value: `default-src 'self'; ${scriptSrc}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; ${connectSrc}; frame-src https://js.stripe.com https://hooks.stripe.com;`
          },
        ],
      },
    ]
  },
  webpack: (config) => {
    config.resolve.alias["@/generated/prisma"] = path.resolve(
      __dirname,
      "prisma/generated/prisma/client/client.ts"
    )
    return config
  },
  experimental: {
    serverComponentsExternalPackages: ["@prisma/adapter-pg"],
    // Required on Next 14.2 to load instrumentation.ts (Sentry init per runtime).
    instrumentationHook: true,
  },
}

export default withSentryConfig(nextConfig, {
  org: "meetsalai",
  project: "javascript-nextjs",
  // Quiet build logs unless in CI; only uploads source maps when SENTRY_AUTH_TOKEN
  // is present (otherwise it's skipped — errors still report, just less symbolicated).
  silent: !process.env.CI,
  // Same-origin tunnel so the strict CSP/adblockers don't drop client errors.
  tunnelRoute: "/monitoring",
  widenClientFileUpload: true,
  // Don't fail the build if Sentry's source-map upload has no auth token.
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
})
