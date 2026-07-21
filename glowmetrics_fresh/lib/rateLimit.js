// Lightweight best-effort per-user rate limiter for API routes.
//
// This is in-memory, so it only limits requests handled by the same warm
// serverless instance — it is NOT a substitute for a real distributed
// limiter under sustained abuse. For Creator Profile Studio it's the
// second line of defense; the primary abuse control is the hard free-tier
// generation cap enforced against the database (see FREE_TIER_LIMITS).
const buckets = new Map()

const MAX_BUCKETS = 5000

/**
 * @param {string} key - unique per user+route, e.g. `${userId}:bio-generate`
 * @param {{ windowMs: number, max: number }} opts
 * @returns {{ allowed: boolean, retryAfterMs: number }}
 */
export function checkRateLimit(key, { windowMs = 60_000, max = 6 } = {}) {
  const now = Date.now()

  if (buckets.size > MAX_BUCKETS) {
    for (const [k, v] of buckets) {
      if (now - v.windowStart > windowMs) buckets.delete(k)
    }
  }

  let bucket = buckets.get(key)
  if (!bucket || now - bucket.windowStart > windowMs) {
    bucket = { windowStart: now, count: 0 }
    buckets.set(key, bucket)
  }

  bucket.count += 1

  if (bucket.count > max) {
    return { allowed: false, retryAfterMs: windowMs - (now - bucket.windowStart) }
  }
  return { allowed: true, retryAfterMs: 0 }
}
