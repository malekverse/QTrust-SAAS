import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import dbConnect from '@/lib/db'
import Settings from '@/models/Settings'
import { requireTier } from '@/lib/entitlements'
import { TenantAuthError } from '@/lib/tenant'
import { ROLES, PLANS, MESSAGING_PROVIDER } from '@/lib/constants'
import { getMessagingConfig, MESSAGING_SETTINGS_KEY } from '@/lib/notifications/messaging'

// GET — return config with secrets masked (booleans indicating "is set").
export async function GET() {
  try {
    const { session } = await requireTier(PLANS.STANDARD)
    if (session.role !== ROLES.ADMIN) {
      return NextResponse.json({ message: 'غير مصرح' }, { status: 403 })
    }
    await dbConnect()
    const cfg = await getMessagingConfig(session.tenantId)
    return NextResponse.json({
      provider: cfg.provider,
      paymentRemindersEnabled: cfg.paymentRemindersEnabled,
      whatsapp: {
        phoneNumberId: cfg.whatsapp.phoneNumberId,
        accessTokenSet: !!cfg.whatsapp.accessToken,
      },
      twilio: {
        accountSid: cfg.twilio.accountSid,
        fromNumber: cfg.twilio.fromNumber,
        authTokenSet: !!cfg.twilio.authToken,
      },
    })
  } catch (e) {
    if (e instanceof TenantAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status })
    }
    console.error('Messaging config get error:', e)
    return NextResponse.json({ message: 'حدث خطأ' }, { status: 500 })
  }
}

const putSchema = z.object({
  provider: z.enum([
    MESSAGING_PROVIDER.DISABLED,
    MESSAGING_PROVIDER.WHATSAPP_CLOUD,
    MESSAGING_PROVIDER.TWILIO_SMS,
  ]),
  paymentRemindersEnabled: z.boolean().optional(),
  whatsapp: z
    .object({
      phoneNumberId: z.string().trim().max(100).optional(),
      accessToken: z.string().trim().max(500).optional(), // blank = keep existing
    })
    .optional(),
  twilio: z
    .object({
      accountSid: z.string().trim().max(100).optional(),
      authToken: z.string().trim().max(500).optional(), // blank = keep existing
      fromNumber: z.string().trim().max(30).optional(),
    })
    .optional(),
})

export async function PUT(request: NextRequest) {
  try {
    const { session } = await requireTier(PLANS.STANDARD)
    if (session.role !== ROLES.ADMIN) {
      return NextResponse.json({ message: 'غير مصرح' }, { status: 403 })
    }

    const parsed = putSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ message: parsed.error.issues[0].message }, { status: 400 })
    }
    const d = parsed.data

    await dbConnect()
    const existing = await getMessagingConfig(session.tenantId)

    // Preserve stored secrets when the incoming token field is blank.
    const merged = {
      provider: d.provider,
      paymentRemindersEnabled:
        d.paymentRemindersEnabled ?? existing.paymentRemindersEnabled,
      whatsapp: {
        phoneNumberId: d.whatsapp?.phoneNumberId ?? existing.whatsapp.phoneNumberId,
        accessToken: d.whatsapp?.accessToken ? d.whatsapp.accessToken : existing.whatsapp.accessToken,
      },
      twilio: {
        accountSid: d.twilio?.accountSid ?? existing.twilio.accountSid,
        authToken: d.twilio?.authToken ? d.twilio.authToken : existing.twilio.authToken,
        fromNumber: d.twilio?.fromNumber ?? existing.twilio.fromNumber,
      },
    }

    await Settings.findOneAndUpdate(
      { tenantId: session.tenantId, key: MESSAGING_SETTINGS_KEY },
      { $set: { value: merged, updatedBy: session.userId } },
      { upsert: true, new: true }
    )

    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof TenantAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status })
    }
    console.error('Messaging config save error:', e)
    return NextResponse.json({ message: 'حدث خطأ' }, { status: 500 })
  }
}
