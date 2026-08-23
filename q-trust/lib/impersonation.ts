import { createHmac, timingSafeEqual } from 'crypto'

// Signed grants for the impersonation flow.
//
// A grant is a short-lived, HMAC-SHA-256 signed JSON blob (base64url) that the
// super-admin console POSTs to the browser, which then hands to
// signIn('impersonate', { grant }). The Credentials provider verifies the
// grant server-side before issuing a session, so the client can't fabricate
// one — the browser only carries an opaque string.

export type GrantPurpose = 'impersonate' | 'restore'

export interface GrantPayload {
  purpose: GrantPurpose
  // For 'impersonate': the tenant admin to sign in AS.
  // For 'restore':    the super-admin to restore back to.
  targetUserId: string
  // For 'impersonate': the super-admin who initiated it (stashed on the
  // resulting session as `impersonatedBy`).
  // For 'restore':    null.
  superAdminUserId: string | null
  // Seconds since epoch when the grant becomes invalid.
  exp: number
}

const GRANT_TTL_SECONDS = 5 * 60 // 5 minutes

function getSecret(): Buffer {
  const s = process.env.NEXTAUTH_SECRET
  if (!s) throw new Error('NEXTAUTH_SECRET not set — impersonation is unavailable')
  return Buffer.from(s, 'utf8')
}

function toBase64Url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function fromBase64Url(s: string): Buffer {
  const pad = 4 - (s.length % 4)
  const b64 = (s + (pad < 4 ? '='.repeat(pad) : '')).replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(b64, 'base64')
}

export function mintGrant(payload: Omit<GrantPayload, 'exp'>): string {
  const full: GrantPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + GRANT_TTL_SECONDS,
  }
  const body = toBase64Url(Buffer.from(JSON.stringify(full), 'utf8'))
  const sig = createHmac('sha256', getSecret()).update(body).digest()
  return `${body}.${toBase64Url(sig)}`
}

// Verify + decode a grant. Returns null on any failure (bad signature,
// expired, malformed) — never throws.
export function verifyGrant(grant: string): GrantPayload | null {
  try {
    const parts = grant.split('.')
    if (parts.length !== 2) return null
    const [body, sigB64] = parts
    const expected = createHmac('sha256', getSecret()).update(body).digest()
    const got = fromBase64Url(sigB64)
    if (got.length !== expected.length) return null
    if (!timingSafeEqual(got, expected)) return null
    const payload = JSON.parse(fromBase64Url(body).toString('utf8')) as GrantPayload
    if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return null
    if (payload.purpose !== 'impersonate' && payload.purpose !== 'restore') return null
    if (typeof payload.targetUserId !== 'string' || !payload.targetUserId) return null
    if (payload.purpose === 'impersonate' && !payload.superAdminUserId) return null
    if (payload.purpose === 'restore' && payload.superAdminUserId !== null) return null
    return payload
  } catch {
    return null
  }
}
