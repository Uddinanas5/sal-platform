/**
 * Simple in-memory rate limiter for serverless environments.
 * For production at scale, replace with Redis-backed solution (e.g., @upstash/ratelimit).
 */

type RateLimitEntry = {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  store.forEach((entry, key) => {
    if (now > entry.resetAt) {
      store.delete(key)
    }
  })
}, 5 * 60 * 1000)

/**
 * Check if a request should be rate limited.
 * @param key - Unique identifier (e.g., "login:user@example.com")
 * @param maxAttempts - Max attempts within the window
 * @param windowMs - Time window in milliseconds
 * @returns { limited: true, retryAfterMs } if rate limited, { limited: false, remaining } otherwise
 */
export function rateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number
): { limited: true; retryAfterMs: number } | { limited: false; remaining: number } {
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
