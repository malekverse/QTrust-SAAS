import Settings from '@/models/Settings'
import MessageLog from '@/models/MessageLog'
import {
  MESSAGING_PROVIDER,
  MESSAGE_STATUS,
  MESSAGE_TYPE,
  type MessagingProvider,
  type MessageType,
} from '@/lib/constants'

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

export async function getMessagingConfig(tenantId: string): Promise<MessagingConfig> {
  const doc = await Settings.findOne({ tenantId, key: MESSAGING_SETTINGS_KEY })
    .lean<{ value: Partial<MessagingConfig> }>()
  const v = doc?.value || {}
  return {
    provider: (v.provider as MessagingProvider) || MESSAGING_PROVIDER.DISABLED,
    paymentRemindersEnabled: v.paymentRemindersEnabled === true,
    whatsapp: {
      phoneNumberId: v.whatsapp?.phoneNumberId || '',
      accessToken: v.whatsapp?.accessToken || '',
    },
    twilio: {
      accountSid: v.twilio?.accountSid || '',
      authToken: v.twilio?.authToken || '',
      fromNumber: v.twilio?.fromNumber || '',
    },
  }
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
