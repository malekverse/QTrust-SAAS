import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
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

void Tenant
void User
void ActivationToken

// POST /api/super-admin/tenants/[id]/users/[userId]/reset-password
// Issues a fresh activation token for the target tenant user. Returns
// the plaintext URL exactly once. This does NOT change the user's
// current password — signing in with the old one keeps working until
// the activation link is used to set a new one.
//
// Same underlying mechanic as the /access/reissue endpoint (which is
// scoped to the *first* admin) but any tenant user can be targeted here.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const actor = await requireSuperAdmin()
    const { id, userId } = await params
    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(userId)) {
      return NextResponse.json({ message: 'معرّف غير صالح' }, { status: 400 })
    }
    await dbConnect()
    const tenant = await Tenant.findById(id).select('_id slug').lean<
      { _id: mongoose.Types.ObjectId; slug: string } | null
    >()
    if (!tenant) return NextResponse.json({ message: 'المؤسسة غير موجودة' }, { status: 404 })

    const target = await User.findOne({ _id: userId, tenantId: tenant._id })
      .select('_id email fullName isActive')
      .lean<{
        _id: mongoose.Types.ObjectId
        email: string
        fullName: string
        isActive: boolean
      } | null>()
    if (!target) return NextResponse.json({ message: 'المستخدم غير موجود' }, { status: 404 })
    if (!target.isActive) {
      return NextResponse.json({ message: 'الحساب غير مفعّل' }, { status: 400 })
    }

    const { token, tokenHash } = generateActivationToken()
    const expiresAt = new Date(Date.now() + DEFAULT_ACTIVATION_TTL_MS)
    await ActivationToken.findOneAndUpdate(
      { userId: target._id },
      {
        $set: {
          tokenHash,
          expiresAt,
          issuedBy: new mongoose.Types.ObjectId(actor.id),
          issuedAt: new Date(),
          purpose: 'reissue',
          usedAt: null,
          sendCount: 0,
          lastSentAt: null,
          tenantId: tenant._id,
        },
      },
      { upsert: true, returnDocument: 'after', runValidators: true }
    )

    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/$/, '')
    const activationUrl = `${siteUrl}/t/${tenant.slug}/activate?token=${encodeURIComponent(token)}`

    await logPlatformAudit({
      actorUserId: actor.id,
      actorEmail: actor.email || 'unknown',
      action: 'ADMIN_PASSWORD_RESET',
      targetType: 'User',
      targetId: target._id,
      tenantId: tenant._id,
      metadata: { targetEmail: target.email },
      ip: getClientIp(request),
      userAgent: request.headers.get('user-agent') || undefined,
    })

    return NextResponse.json({
      activation: { url: activationUrl, expiresAt },
      user: { _id: target._id, email: target.email, fullName: target.fullName },
    })
  } catch (e) {
    if (e instanceof TenantAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status })
    }
    console.error('reset password error:', e)
    return NextResponse.json({ message: 'حدث خطأ' }, { status: 500 })
  }
}
