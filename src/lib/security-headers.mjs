// Security response headers for the whole app (Gate G.4). Extracted from
// next.config.mjs so the exact CSP / HSTS / frame policy is a pure function and
// can be regression-locked by tests — a silent removal of HSTS or X-Frame-Options,
// or a CSP loosening (e.g. adding 'unsafe-eval' in prod), now fails a test instead
// of shipping. next.config.mjs imports and returns this verbatim from headers().
//
// Two route classes:
//   - /book/*  : the public booking widget must stay EMBEDDABLE (frame-ancestors *),
//                so it gets a CSP that allows framing but no X-Frame-Options DENY.
//   - everything else (dashboard/app/api): X-Frame-Options DENY + a stricter CSP
//                (frame-ancestors defaults to 'self') to block clickjacking.
export function buildSecurityHeaders(isDev) {
  const commonHeaders = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-DNS-Prefetch-Control", value: "on" },
    // HSTS only in production — never pin localhost to HTTPS during dev.
    ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]),
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ]
  // 'unsafe-eval' is a DEV-ONLY concession (React refresh); it must never be
  // present in the production script-src.
  const scriptSrc = isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com"
    : "script-src 'self' 'unsafe-inline' https://js.stripe.com"
  const connectSrc = isDev
    ? "connect-src 'self' ws://localhost:3000 http://localhost:3000 https://api.stripe.com https://*.supabase.co"
    : "connect-src 'self' https://api.stripe.com https://*.supabase.co"
  return [
    {
      // Public booking pages stay embeddable (booking widget / embed.js).
      source: "/book/:path*",
      headers: [
        ...commonHeaders,
        {
          key: "Content-Security-Policy",
          value: `default-src 'self'; ${scriptSrc}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; ${connectSrc}; frame-src 'self' https://js.stripe.com https://hooks.stripe.com; frame-ancestors *;`,
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
          value: `default-src 'self'; ${scriptSrc}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; ${connectSrc}; frame-src https://js.stripe.com https://hooks.stripe.com;`,
        },
      ],
    },
  ]
}
