import Settings from '@/models/Settings'
import MessageLog from '@/models/MessageLog'
import {
  MESSAGING_PROVIDER,
  MESSAGE_STATUS,
  MESSAGE_TYPE,
  type MessagingProvider,
  type MessageType,
} from '@/lib/constants'
import { cryptoReady, decrypt, encrypt, isEncrypted } from '@/lib/crypto'

void Settings
void MessageLog

export const MESSAGING_SETTINGS_KEY = 'messaging_config'

export interface MessagingConfig {
  provider: MessagingProvider
  // Feature toggle for payment reminders — OFF by default. Even with a provider
  // configured, reminders won't send until the admin explicitly enables this.
  paymentRemindersEnabled: boolean
  whatsapp: { phoneNumberId: string; accessToken: string }
  twilio: { accountSid: string; authToken: string; fromNumber: string }
}

// AAD prefixes used when encrypting per-tenant provider secrets. Binding the
// ciphertext to the tenant + field prevents row-swap attacks — a token
// encrypted for tenant A can't be pasted into tenant B's Settings and
// decrypted from there.
function aadFor(tenantId: string, field: 'whatsapp.accessToken' | 'twilio.authToken'): string {
  return `messaging:${field}:${tenantId}`
}

// Decrypt a stored token. Legacy rows carry plaintext; new rows carry the
// `v1.…` wire format from lib/crypto. Anything we can't decrypt yields an
// empty string (fail-closed: the operator reconfigures, we never accidentally
// send with a corrupt/foreign secret).
function readToken(stored: string | undefined, tenantId: string, field: 'whatsapp.accessToken' | 'twilio.authToken'): string {
  if (!stored) return ''
  if (!isEncrypted(stored)) return stored // legacy plaintext row
  if (!cryptoReady()) return ''
  return decrypt(stored, aadFor(tenantId, field)) ?? ''
}

// Encrypt a token for storage. If crypto isn't configured (dev without
// CREDENTIALS_ENCRYPTION_KEY), fall through to plaintext — the runtime
// warning is enough for dev, and prod fails fast at crypto module load.
function writeToken(plaintext: string, tenantId: string, field: 'whatsapp.accessToken' | 'twilio.authToken'): string {
  if (!plaintext) return ''
  if (!cryptoReady()) {
    console.warn('messaging: storing token in plaintext — CREDENTIALS_ENCRYPTION_KEY not set')
    return plaintext
  }
  return encrypt(plaintext, aadFor(tenantId, field))
}

export async function getMessagingConfig(tenantId: string): Promise<MessagingConfig> {
  const doc = await Settings.findOne({ tenantId, key: MESSAGING_SETTINGS_KEY })
    .lean<{ value: Partial<MessagingConfig> }>()
  const v = doc?.value || {}
  return {
    provider: (v.provider as MessagingProvider) || MESSAGING_PROVIDER.DISABLED,
    paymentRemindersEnabled: v.paymentRemindersEnabled === true,
    whatsapp: {
      phoneNumberId: v.whatsapp?.phoneNumberId || '',
      accessToken: readToken(v.whatsapp?.accessToken, tenantId, 'whatsapp.accessToken'),
    },
    twilio: {
      accountSid: v.twilio?.accountSid || '',
      authToken: readToken(v.twilio?.authToken, tenantId, 'twilio.authToken'),
      fromNumber: v.twilio?.fromNumber || '',
    },
  }
}

// Upsert a MessagingConfig for a tenant. Encrypts the two secret fields
// before writing, so anything reading Settings.value directly (a DB dump,
// an unrelated backup script) sees the wire-format ciphertext, not the
// plaintext tokens. Callers pass the config in plaintext form.
export async function saveMessagingConfig(
  tenantId: string,
  config: MessagingConfig,
  updatedBy: string
): Promise<void> {
  const stored = {
    provider: config.provider,
    paymentRemindersEnabled: config.paymentRemindersEnabled,
    whatsapp: {
      phoneNumberId: config.whatsapp.phoneNumberId,
      accessToken: writeToken(config.whatsapp.accessToken, tenantId, 'whatsapp.accessToken'),
    },
    twilio: {
      accountSid: config.twilio.accountSid,
      authToken: writeToken(config.twilio.authToken, tenantId, 'twilio.authToken'),
      fromNumber: config.twilio.fromNumber,
    },
  }
  await Settings.findOneAndUpdate(
    { tenantId, key: MESSAGING_SETTINGS_KEY },
    { $set: { value: stored, updatedBy } },
    { upsert: true, returnDocument: 'after' }
  )
}

// A config is "usable" only when a real provider is selected and its required
// credentials are present. Otherwise sends are recorded as SKIPPED, never sent.
export function isMessagingConfigured(cfg: MessagingConfig): boolean {
  if (cfg.provider === MESSAGING_PROVIDER.WHATSAPP_CLOUD) {
    return !!(cfg.whatsapp.phoneNumberId && cfg.whatsapp.accessToken)
  }
  if (cfg.provider === MESSAGING_PROVIDER.TWILIO_SMS) {
    return !!(cfg.twilio.accountSid && cfg.twilio.authToken && cfg.twilio.fromNumber)
  }
  return false
}

async function sendViaWhatsApp(
  cfg: MessagingConfig,
  to: string,
  body: string
): Promise<{ id?: string }> {
  // WhatsApp Cloud API. NOTE: business-initiated messages outside the 24h
  // customer-service window require pre-approved templates; plain text is used
  // here for simplicity and works inside an open conversation. Swap to a
  // template payload when sending cold notifications in production.
  const url = `https://graph.facebook.com/v21.0/${cfg.whatsapp.phoneNumberId}/messages`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.whatsapp.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: to.replace(/^\+/, ''),
      type: 'text',
      text: { body },
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data?.error?.message || `WhatsApp API error ${res.status}`)
  }
  return { id: data?.messages?.[0]?.id }
}

async function sendViaTwilio(
  cfg: MessagingConfig,
  to: string,
  body: string
): Promise<{ id?: string }> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${cfg.twilio.accountSid}/Messages.json`
  const form = new URLSearchParams({ To: to, From: cfg.twilio.fromNumber, Body: body })
  const auth = Buffer.from(`${cfg.twilio.accountSid}:${cfg.twilio.authToken}`).toString('base64')
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data?.message || `Twilio API error ${res.status}`)
  }
  return { id: data?.sid }
}

export interface SendResult {
  status: (typeof MESSAGE_STATUS)[keyof typeof MESSAGE_STATUS]
  error?: string
}

// Send a message through the tenant's configured provider, always recording a
// MessageLog. Never throws — a messaging failure must not break the caller.
export async function sendMessage(params: {
  tenantId: string
  to: string
  body: string
  type?: MessageType
  studentId?: string
  createdByUserId?: string
}): Promise<SendResult> {
  const { tenantId, to, body } = params
  const type = params.type || MESSAGE_TYPE.GENERAL

  const base = {
    tenantId,
    to,
    type,
    body,
    studentId: params.studentId,
    createdByUserId: params.createdByUserId,
  }

  try {
    const cfg = await getMessagingConfig(tenantId)

    if (!isMessagingConfigured(cfg)) {
      await MessageLog.create({
        ...base,
        provider: cfg.provider,
        status: MESSAGE_STATUS.SKIPPED,
        error: 'مزود الرسائل غير مُفعّل',
      })
      return { status: MESSAGE_STATUS.SKIPPED, error: 'مزود الرسائل غير مُفعّل' }
    }

    let result: { id?: string }
    if (cfg.provider === MESSAGING_PROVIDER.WHATSAPP_CLOUD) {
      result = await sendViaWhatsApp(cfg, to, body)
    } else {
      result = await sendViaTwilio(cfg, to, body)
    }

    await MessageLog.create({
      ...base,
      provider: cfg.provider,
      status: MESSAGE_STATUS.SENT,
      providerMessageId: result.id,
    })
    return { status: MESSAGE_STATUS.SENT }
  } catch (e) {
    const error = e instanceof Error ? e.message : 'خطأ غير معروف'
    try {
      const cfg = await getMessagingConfig(tenantId)
      await MessageLog.create({ ...base, provider: cfg.provider, status: MESSAGE_STATUS.FAILED, error })
    } catch {
      // ignore logging failure
    }
    return { status: MESSAGE_STATUS.FAILED, error }
  }
}
