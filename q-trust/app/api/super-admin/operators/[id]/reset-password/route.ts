import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import dbConnect from '@/lib/db'
import { requireSuperAdmin, TenantAuthError } from '@/lib/tenant'
import User from '@/models/User'
import ActivationToken, {
  DEFAULT_ACTIVATION_TTL_MS,
  generateActivationToken,
} from '@/models/ActivationToken'
import { ROLES } from '@/lib/constants'
import { logPlatformAudit } from '@/models/PlatformAuditLog'
import { getClientIp } from '@/lib/rate-limit'

void User
void ActivationToken

// POST /api/super-admin/operators/[id]/reset-password
// Issues a fresh activation link so the target operator can set a new
// password. Same mechanism as the tenant-user reset in Phase 4.
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
    await dbConnect()

    const target = await User.findOne({ _id: id, role: ROLES.SUPER_ADMIN })
      .select('_id email fullName isActive')
      .lean<{ _id: mongoose.Types.ObjectId; email: string; fullName: string; isActive: boolean } | null>()
    if (!target) {
      return NextResponse.json({ message: 'مدير المنصة غير موجود' }, { status: 404 })
    }
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
          tenantId: null,
        },
      },
      { upsert: true, returnDocument: 'after' }
    )

    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/$/, '')
    const activationUrl = `${siteUrl}/auth/operator-activate?token=${encodeURIComponent(token)}`

    await logPlatformAudit({
      actorUserId: actor.id,
      actorEmail: actor.email || 'unknown',
      action: 'ADMIN_PASSWORD_RESET',
      targetType: 'User',
      targetId: target._id,
      metadata: { targetEmail: target.email, kind: 'operator' },
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
    console.error('operator reset-password error:', e)
    return NextResponse.json({ message: 'حدث خطأ' }, { status: 500 })
  }
}
