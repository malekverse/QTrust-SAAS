import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

// AES-256-GCM authenticated encryption for at-rest secrets:
//   - activation tokens are hashed, not encrypted, so this module is used
//     mainly for the already-shipped plaintext WhatsApp/Twilio access tokens
//     stored in Settings.value.
//
// Format: v1.<keyVersion>.<iv-base64>.<tag-base64>.<ciphertext-base64>
//
// AAD (associated data) is passed by the caller — typically
// `${userId}|${tenantId}` for credentials, or `${tenantId}|messaging` for
// per-tenant provider tokens. Binding the ciphertext to a context prevents
// a row-swap attack from decrypting a secret against a different owner.

const ALGO = 'aes-256-gcm'
const IV_BYTES = 12
const TAG_BYTES = 16
const VERSION = 'v1'

class CryptoConfigError extends Error {}

interface KeySet {
  active: { keyId: string; key: Buffer }
  previous?: { keyId: string; key: Buffer }
}

function loadKey(envValue: string | undefined, name: string): Buffer | undefined {
  if (!envValue) return undefined
  const trimmed = envValue.trim()
  const raw = /^[0-9a-f]{64}$/i.test(trimmed)
    ? Buffer.from(trimmed, 'hex')
    : Buffer.from(trimmed, 'base64')
  if (raw.length !== 32) {
    throw new CryptoConfigError(
      `${name} must decode to exactly 32 bytes (got ${raw.length}). ` +
        'Generate one with: openssl rand -base64 32'
    )
  }
  return raw
}

let cachedKeys: KeySet | null | undefined
// Warning-once state so a misconfigured production deploy still surfaces
// clearly on the first reveal without spamming the request log.
let warnedMissing = false

function getKeys(): KeySet | null {
  if (cachedKeys !== undefined) return cachedKeys
  try {
    const active = loadKey(process.env.CREDENTIALS_ENCRYPTION_KEY, 'CREDENTIALS_ENCRYPTION_KEY')
    if (!active) {
      // Missing at request time: dev keeps working (callers `cryptoReady()`
      // and degrade gracefully); production logs a loud warning once. This
      // is a soft-fail rather than a hard throw because module load happens
      // during `next build`'s page-data collection, and blowing up there
      // makes CI break instead of surfacing a runtime error the operator
      // can actually act on.
      if (process.env.NODE_ENV === 'production' && !warnedMissing) {
        console.error(
          'crypto: CREDENTIALS_ENCRYPTION_KEY is not set in production — ' +
            'secrets fall back to plaintext and encrypted values become unreadable.'
        )
        warnedMissing = true
      }
      cachedKeys = null
      return null
    }
    const previous = loadKey(
      process.env.CREDENTIALS_ENCRYPTION_KEY_PREVIOUS,
      'CREDENTIALS_ENCRYPTION_KEY_PREVIOUS'
    )
    cachedKeys = {
      active: { keyId: '1', key: active },
      previous: previous ? { keyId: '0', key: previous } : undefined,
    }
    return cachedKeys
  } catch (e) {
    if (process.env.NODE_ENV === 'production') {
      console.error('crypto: key load failed —', (e as Error).message)
    } else {
      console.error('crypto: key load failed —', (e as Error).message)
    }
    cachedKeys = null
    return null
  }
}

export function cryptoReady(): boolean {
  return getKeys() !== null
}

export interface EncryptedString {
  v: string
  keyId: string
  iv: string
  tag: string
  ct: string
}

function toWireFormat(e: EncryptedString): string {
  return `${e.v}.${e.keyId}.${e.iv}.${e.tag}.${e.ct}`
}
function fromWireFormat(s: string): EncryptedString | null {
  const parts = s.split('.')
  if (parts.length !== 5) return null
  const [v, keyId, iv, tag, ct] = parts
  if (v !== VERSION) return null
  return { v, keyId, iv, tag, ct }
}

// Return true iff `value` looks like our encrypted-string format. Useful for
// migrating a plaintext-legacy field on the fly without a schema flag.
export function isEncrypted(value: string | undefined | null): boolean {
  if (!value) return false
  const parsed = fromWireFormat(value)
  return parsed !== null
}

export function encrypt(plaintext: string, aad: string): string {
  const keys = getKeys()
  if (!keys) throw new CryptoConfigError('Encryption is not configured (no CREDENTIALS_ENCRYPTION_KEY)')
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGO, keys.active.key, iv, { authTagLength: TAG_BYTES })
  cipher.setAAD(Buffer.from(aad, 'utf8'))
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return toWireFormat({
    v: VERSION,
    keyId: keys.active.keyId,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ct: ct.toString('base64'),
  })
}

// Returns the plaintext, or null on any failure — including a wrong AAD, a
// truncated wire string, or a ciphertext that can't be decrypted with either
// the active or the previous key. Never throws; callers surface a
// user-visible error (e.g. "re-issue this credential") without leaking why.
export function decrypt(wire: string, aad: string): string | null {
  const keys = getKeys()
  if (!keys) return null
  const parsed = fromWireFormat(wire)
  if (!parsed) return null

  const candidates = [keys.active, keys.previous].filter(Boolean) as { keyId: string; key: Buffer }[]
  for (const { key } of candidates) {
    try {
      const iv = Buffer.from(parsed.iv, 'base64')
      const tag = Buffer.from(parsed.tag, 'base64')
      const ct = Buffer.from(parsed.ct, 'base64')
      const decipher = createDecipheriv(ALGO, key, iv, { authTagLength: TAG_BYTES })
      decipher.setAAD(Buffer.from(aad, 'utf8'))
      decipher.setAuthTag(tag)
      const out = Buffer.concat([decipher.update(ct), decipher.final()])
      return out.toString('utf8')
    } catch {
      // try next key
    }
  }
  return null
}
