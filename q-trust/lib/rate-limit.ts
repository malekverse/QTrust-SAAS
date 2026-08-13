import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { type NextRequest, NextResponse } from 'next/server'

// Upstash is optional: when the env vars are absent the limiters are null and
// enforceRateLimit() allows all requests (fail-open) so local dev and builds are
// unaffected. Configure in production by setting UPSTASH_REDIS_REST_URL and
// UPSTASH_REDIS_REST_TOKEN (Upstash Redis REST credentials).
const url = process.env.UPSTASH_REDIS_REST_URL
const token = process.env.UPSTASH_REDIS_REST_TOKEN
const redis = url && token ? new Redis({ url, token }) : null

if (!redis && process.env.NODE_ENV === 'production') {
  console.warn(
    '[rate-limit] Upstash is not configured — rate limiting is DISABLED. ' +
      'Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to enable it.'
  )
}

// Login / auth POSTs — strict, keyed by client IP (brute-force protection).
export const loginLimiter = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '1 m'), prefix: 'qtrust:login' })
  : null

// QR check-in — generous (a busy door scans rapidly) but bounds qrUuid
// enumeration, keyed by client IP.
export const checkInLimiter = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(100, '1 m'), prefix: 'qtrust:checkin' })
  : null

// AI assistant chat — cost control, keyed by admin user id.
export const aiLimiter = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, '1 m'), prefix: 'qtrust:ai' })
  : null

// AI assistant chat — hard per-tenant cap (independent of the per-admin limit
// and the monthly quota) so a runaway client or script can't hammer Groq.
export const aiTenantLimiter = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(40, '1 m'), prefix: 'qtrust:ai:tenant' })
  : null

// Best-effort client IP extraction from proxy headers (Vercel sets these).
export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return request.headers.get('x-real-ip') || 'unknown'
}

// Returns a 429 response when the identifier is over the limit, else null.
export async function enforceRateLimit(
  limiter: Ratelimit | null,
  identifier: string
): Promise<NextResponse | null> {
  if (!limiter) return null
  const { success, reset } = await limiter.limit(identifier)
  if (success) return null
  const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000))
  return NextResponse.json(
    { message: 'عدد كبير من الطلبات. يرجى المحاولة بعد قليل.' },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } }
  )
}
