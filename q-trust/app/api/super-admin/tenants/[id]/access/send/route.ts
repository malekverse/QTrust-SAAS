import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { z } from 'zod'
import dbConnect from '@/lib/db'
import { requireSuperAdmin, TenantAuthError } from '@/lib/tenant'
import Tenant from '@/models/Tenant'
import User from '@/models/User'
import ActivationToken, {
  DEFAULT_ACTIVATION_TTL_MS,
  generateActivationToken,
} from '@/models/ActivationToken'
import { logPlatformAudit } from '@/models/PlatformAuditLog'
import { getClientIp } from '@/lib/rate-limit'
import { ROLES } from '@/lib/constants'
import { sendEmail } from '@/lib/email/client'
import { renderTenantWelcomeActivation, type EmailLocale } from '@/lib/email/templates'
import { EMAIL_TEMPLATES } from '@/models/EmailLog'

void Tenant
void User
void ActivationToken

const sendSchema = z.object({
  // Operator can override the destination (e.g. send to the association's
  // shared inbox instead of the admin's personal address). Defaults to the
  // admin's own email.
  to: z.string().email().optional(),
  // Whether to also issue a fresh token. Default true — the primary use of
  // the button is "send them a working link now", which requires a fresh
  // one if the previous is expired or missing.
  reissue: z.boolean().default(true),
})

// POST /api/super-admin/tenants/[id]/access/send
//
// Compose the activation email, send it via SMTP, log the delivery, and
// audit the action. If SMTP is not configured, the EmailLog row is
// SKIPPED and the response makes that visible so the operator can copy
// the link manually instead.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireSuperAdmin()
    const { id } = await params
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: 'معرّف غير صالح' }, { status: 400 })
    }
    const parsed = sendSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ message: parsed.error.issues[0].message }, { status: 400 })
    }
    const { to: toOverride, reissue } = parsed.data

    await dbConnect()
    const tenant = await Tenant.findById(id)
      .select('_id slug name branding.displayName branding.locale')
      .lean<{
        _id: mongoose.Types.ObjectId
        slug: string
        name: string
        branding?: { displayName?: string; locale?: string }
      } | null>()
    if (!tenant) {
      return NextResponse.json({ message: 'المؤسسة غير موجودة' }, { status: 404 })
    }
    const admin = await User.findOne({ tenantId: tenant._id, role: ROLES.ADMIN })
      .sort({ createdAt: 1 })
      .select('_id email fullName isActive')
      .lean<{
        _id: mongoose.Types.ObjectId
        email: string
        fullName: string
        isActive: boolean
      } | null>()
    if (!admin) {
      return NextResponse.json({ message: 'لا يوجد مدير لهذه المؤسسة' }, { status: 404 })
    }
    if (!admin.isActive) {
      return NextResponse.json({ message: 'حساب المدير غير مفعّل' }, { status: 400 })
    }

    // Issue a fresh token if asked. Reusing an old token wouldn't work if
    // it's expired, and it also can't be recovered (only the hash is
    // stored), so "send" always couples with a fresh issue by default.
    let activationToken: string | null = null
    let expiresAt = new Date(Date.now() + DEFAULT_ACTIVATION_TTL_MS)
    if (reissue) {
      const gen = generateActivationToken()
      activationToken = gen.token
      await ActivationToken.findOneAndUpdate(
        { userId: admin._id },
        {
          $set: {
            tokenHash: gen.tokenHash,
            expiresAt,
            issuedBy: new mongoose.Types.ObjectId(actor.id),
            issuedAt: new Date(),
            purpose: 'reissue',
            usedAt: null,
            tenantId: tenant._id,
          },
          $inc: { sendCount: 1 },
          $currentDate: { lastSentAt: true },
        },
        { upsert: true, returnDocument: 'after' }
      )
    } else {
      // No reissue — read the existing token metadata to display an
      // accurate expiry in the email. Cannot recover the plaintext, so
      // this branch is only useful if the previous send failed and we
      // want to bump sendCount without minting a new secret.
      const existing = await ActivationToken.findOne({ userId: admin._id })
        .select('expiresAt tokenHash')
        .lean<{ expiresAt: Date; tokenHash: string } | null>()
      if (!existing) {
        return NextResponse.json(
          { message: 'لا يوجد رابط تفعيل قائم. اختر «إعادة الإصدار».' },
          { status: 409 }
        )
      }
      // Without reissue, we have no plaintext to include in the email.
      return NextResponse.json(
        { message: 'لا يمكن إعادة إرسال رابط قديم — يجب إصدار رابط جديد.' },
        { status: 409 }
      )
    }

    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/$/, '')
    const activationUrl = `${siteUrl}/t/${tenant.slug}/activate?token=${encodeURIComponent(activationToken!)}`
    const loginUrl = `${siteUrl}/t/${tenant.slug}`

    const rawLocale = (tenant.branding?.locale as string | undefined) || 'ar'
    const locale: EmailLocale = rawLocale === 'fr' ? 'fr' : rawLocale === 'en' ? 'en' : 'ar'
    const tenantDisplayName = tenant.branding?.displayName || tenant.name

    const { subject, html, text } = renderTenantWelcomeActivation({
      locale,
      recipientName: admin.fullName,
      tenantName: tenantDisplayName,
      activationUrl,
      loginUrl,
      expiresAt,
      operatorName: actor.fullName,
    })

    const to = (toOverride || admin.email).toLowerCase()
    const send = await sendEmail({
      to,
      subject,
      html,
      text,
      template: EMAIL_TEMPLATES.TENANT_WELCOME_ACTIVATION,
      tenantId: tenant._id,
      targetUserId: admin._id,
      createdBy: actor.id,
    })

    await logPlatformAudit({
      actorUserId: actor.id,
      actorEmail: actor.email || 'unknown',
      action: 'ADMIN_ACCESS_EMAILED',
      targetType: 'User',
      targetId: admin._id,
      tenantId: tenant._id,
      metadata: { to, deliveryStatus: send.status, deliveryError: send.error },
      ip: getClientIp(request),
      userAgent: request.headers.get('user-agent') || undefined,
    })

    return NextResponse.json({
      deliveryStatus: send.status,
      deliveryError: send.error,
      to,
      activation: { url: activationUrl, expiresAt },
    })
  } catch (e) {
    if (e instanceof TenantAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status })
    }
    console.error('send access error:', e)
    return NextResponse.json({ message: 'حدث خطأ' }, { status: 500 })
  }
}
