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
import { ROLES } from '@/lib/constants'

void Tenant
void User
void ActivationToken

// POST /api/super-admin/tenants/[id]/access/reissue
//
// Issues a new activation token for the tenant's first ADMIN, invalidating
// the previous one (single-token-per-user is enforced by a unique index).
// The plaintext token is returned exactly once — the response body is the
// only surface it appears on. Audited as ADMIN_ACCESS_REISSUED.
//
// If the target admin has already activated (mustChangePassword=false), we
// still issue a fresh token — the operator explicitly asked to hand out a
// new access link (e.g. lost password, changed contact). This does NOT
// change the admin's current password; login continues to work with the
// existing password until they use the link to set a new one.
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
    const tenant = await Tenant.findById(id).select('_id slug name').lean<
      { _id: mongoose.Types.ObjectId; slug: string; name: string } | null
    >()
    if (!tenant) {
      return NextResponse.json({ message: 'المؤسسة غير موجودة' }, { status: 404 })
    }
    const admin = await User.findOne({ tenantId: tenant._id, role: ROLES.ADMIN })
      .sort({ createdAt: 1 })
      .select('_id email fullName isActive')
      .lean<{ _id: mongoose.Types.ObjectId; email: string; fullName: string; isActive: boolean } | null>()
    if (!admin) {
      return NextResponse.json({ message: 'لا يوجد مدير لهذه المؤسسة' }, { status: 404 })
    }
    if (!admin.isActive) {
      return NextResponse.json({ message: 'حساب المدير غير مفعّل' }, { status: 400 })
    }

    const { token, tokenHash } = generateActivationToken()
    const expiresAt = new Date(Date.now() + DEFAULT_ACTIVATION_TTL_MS)

    // Upsert: unique index on userId collapses "issue a new token" into
    // "replace the existing row atomically". If the admin still holds a
    // valid token, it's overwritten (invalidated).
    await ActivationToken.findOneAndUpdate(
      { userId: admin._id },
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
      action: 'ADMIN_ACCESS_REISSUED',
      targetType: 'User',
      targetId: admin._id,
      tenantId: tenant._id,
      metadata: { adminEmail: admin.email },
      ip: getClientIp(request),
      userAgent: request.headers.get('user-agent') || undefined,
    })

    return NextResponse.json({
      activation: { url: activationUrl, expiresAt },
      admin: { _id: admin._id, email: admin.email, fullName: admin.fullName },
    })
  } catch (e) {
    if (e instanceof TenantAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status })
    }
    console.error('reissue error:', e)
    return NextResponse.json({ message: 'حدث خطأ' }, { status: 500 })
  }
}
