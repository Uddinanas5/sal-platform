import path from "path"
import { fileURLToPath } from "url"
import { withSentryConfig } from "@sentry/nextjs"
import { buildSecurityHeaders } from "./src/lib/security-headers.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const isDev = process.env.NODE_ENV === "development"

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // Security response headers (Gate G.4). Policy lives in a pure, unit-tested
  // module so a regression (dropped HSTS/X-Frame-Options, loosened CSP) fails a
  // test — see tests/security-headers.test.ts.
  async headers() {
    return buildSecurityHeaders(isDev)
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
