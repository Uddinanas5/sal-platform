/**
 * Rate limiter with two backends behind ONE async signature:
 *
 *  - Upstash Redis sliding-window (distributed, correct across serverless
 *    containers/regions) when UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 *    are configured.
 *  - In-memory per-process fallback otherwise (dev/CI/tests, or until the
 *    founder provisions Upstash). NOTE: the in-memory path is best-effort only —
 *    on Vercel each container has its own Map, so it does NOT enforce a global
 *    limit. That is exactly why Upstash is wired for production.
 *
 * Callers `await rateLimit(...)` and get the same result shape from either path.
 */

import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

export type RateLimitResult =
  | { limited: true; retryAfterMs: number }
  | { limited: false; remaining: number }

// ── In-memory fallback ──────────────────────────────────────────────────────
type RateLimitEntry = { count: number; resetAt: number }
const store = new Map<string, RateLimitEntry>()

// Sweep expired entries; unref so this timer never keeps the process alive
// (matters for short-lived CLIs and the test runner).
const sweep = setInterval(() => {
  const now = Date.now()
  store.forEach((entry, key) => {
    if (now > entry.resetAt) store.delete(key)
  })
}, 5 * 60 * 1000)
;(sweep as { unref?: () => void }).unref?.()

function inMemoryRateLimit(key: string, maxAttempts: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const entry = store.get(key)
  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { limited: false, remaining: maxAttempts - 1 }
  }
  entry.count++
  if (entry.count > maxAttempts) {
    return { limited: true, retryAfterMs: entry.resetAt - now }
  }
  return { limited: false, remaining: maxAttempts - entry.count }
}

// ── Upstash backend (lazy) ──────────────────────────────────────────────────
let _redis: Redis | null | undefined // undefined = unchecked, null = not configured
function getRedis(): Redis | null {
  if (_redis !== undefined) return _redis
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  _redis = url && token ? new Redis({ url, token }) : null
  return _redis
}

// One Ratelimit per (maxAttempts, windowMs) — the call sites use distinct limits.
const limiters = new Map<string, Ratelimit>()
function getLimiter(maxAttempts: number, windowMs: number): Ratelimit | null {
  const redis = getRedis()
  if (!redis) return null
  const cacheKey = `${maxAttempts}:${windowMs}`
  let limiter = limiters.get(cacheKey)
  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(maxAttempts, `${windowMs} ms`),
      prefix: "sal-rl",
      analytics: false,
    })
    limiters.set(cacheKey, limiter)
  }
  return limiter
}

/**
 * Check if a request should be rate limited.
 * @param key - Unique identifier (e.g., "login:user@example.com")
 * @param maxAttempts - Max attempts within the window
 * @param windowMs - Time window in milliseconds
 */
export async function rateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number
): Promise<RateLimitResult> {
  const limiter = getLimiter(maxAttempts, windowMs)
  if (!limiter) return inMemoryRateLimit(key, maxAttempts, windowMs)
  try {
    const { success, remaining, reset } = await limiter.limit(key)
    if (!success) return { limited: true, retryAfterMs: Math.max(0, reset - Date.now()) }
    return { limited: false, remaining }
  } catch {
    // Upstash unreachable: fall back to in-memory rather than hard-blocking auth
    // /booking on a Redis hiccup. Best-effort beats a total outage.
    return inMemoryRateLimit(key, maxAttempts, windowMs)
  }
}
