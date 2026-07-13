import { describe, it, expect } from "vitest"
import { buildSecurityHeaders } from "@/lib/security-headers.mjs"

// Gate G.4 — the app's security response headers. These were configured in
// next.config.mjs but nothing guarded them, so a refactor could silently drop
// HSTS / X-Frame-Options or loosen the CSP. This locks the policy: a regression
// fails here instead of shipping to production.

type Header = { key: string; value: string }
type Rule = { source: string; headers: Header[] }

const bookRule = (rules: Rule[]) => rules.find((r) => r.source.startsWith("/book"))!
const appRule = (rules: Rule[]) => rules.find((r) => !r.source.startsWith("/book"))!
const val = (rule: Rule, key: string) =>
  rule.headers.find((h) => h.key.toLowerCase() === key.toLowerCase())?.value

describe("security headers (Gate G.4)", () => {
  it("PRODUCTION sends HSTS; development does not (never pin localhost to HTTPS)", () => {
    const prod = buildSecurityHeaders(false) as Rule[]
    expect(val(bookRule(prod), "Strict-Transport-Security")).toMatch(/max-age=31536000/)
    expect(val(appRule(prod), "Strict-Transport-Security")).toMatch(/max-age=31536000/)

    const dev = buildSecurityHeaders(true) as Rule[]
    expect(val(bookRule(dev), "Strict-Transport-Security")).toBeUndefined()
  })

  it("dashboard/app routes are X-Frame-Options: DENY (anti-clickjacking)", () => {
    const prod = buildSecurityHeaders(false) as Rule[]
    expect(val(appRule(prod), "X-Frame-Options")).toBe("DENY")
  })

  it("the public booking widget stays EMBEDDABLE (frame-ancestors *, no X-Frame DENY)", () => {
    const prod = buildSecurityHeaders(false) as Rule[]
    const book = bookRule(prod)
    expect(val(book, "X-Frame-Options")).toBeUndefined()
    expect(val(book, "Content-Security-Policy")).toContain("frame-ancestors *")
    // ...while the app CSP must NOT be world-embeddable.
    expect(val(appRule(prod), "Content-Security-Policy")).not.toContain("frame-ancestors *")
  })

  it("both route classes set nosniff, a Referrer-Policy, a Permissions-Policy, and a self-default CSP", () => {
    for (const rules of [buildSecurityHeaders(false) as Rule[], buildSecurityHeaders(true) as Rule[]]) {
      for (const rule of [bookRule(rules), appRule(rules)]) {
        expect(val(rule, "X-Content-Type-Options")).toBe("nosniff")
        expect(val(rule, "Referrer-Policy")).toBe("strict-origin-when-cross-origin")
        expect(val(rule, "Permissions-Policy")).toContain("geolocation=()")
        expect(val(rule, "Content-Security-Policy")).toContain("default-src 'self'")
      }
    }
  })

  it("PRODUCTION CSP forbids 'unsafe-eval' (dev-only); Stripe stays allowlisted", () => {
    const prod = buildSecurityHeaders(false) as Rule[]
    for (const rule of [bookRule(prod), appRule(prod)]) {
      const csp = val(rule, "Content-Security-Policy")!
      expect(csp).not.toContain("unsafe-eval")
      expect(csp).toContain("https://js.stripe.com")
    }
    // dev deliberately allows eval (React refresh) — proves the flag actually varies.
    const dev = buildSecurityHeaders(true) as Rule[]
    expect(val(bookRule(dev), "Content-Security-Policy")).toContain("unsafe-eval")
  })
})
