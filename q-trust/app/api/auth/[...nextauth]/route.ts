import { handlers } from '@/lib/auth'
import type { NextRequest } from 'next/server'
import { loginLimiter, enforceRateLimit, getClientIp } from '@/lib/rate-limit'

export const GET = handlers.GET

// Rate-limit auth POSTs (sign-in/callback) by client IP to blunt brute-force attempts.
export async function POST(request: NextRequest) {
  const limited = await enforceRateLimit(loginLimiter, `auth:${getClientIp(request)}`)
  if (limited) return limited
  return handlers.POST(request)
}
