import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import dbConnect from '@/lib/db'
import { requireSuperAdmin, TenantAuthError } from '@/lib/tenant'
import Tenant from '@/models/Tenant'
import User from '@/models/User'
import { logPlatformAudit } from '@/models/PlatformAuditLog'
import { getClientIp } from '@/lib/rate-limit'
import { mintGrant } from '@/lib/impersonation'
import { ROLES, TENANT_STATUS } from '@/lib/constants'

void Tenant
void User

// POST /api/super-admin/tenants/[id]/impersonate
//
// Mints a short-lived signed "impersonate" grant that the client hands to
// signIn('impersonate', { grant }). The client is left to perform the
// actual signIn — this endpoint only issues the grant and writes an audit
// row, so a failed signIn (network drop, tenant just suspended, etc.) is
// visible without leaving the operator with a half-swapped session.
//
// Refuses to nest impersonation: a session already carrying
// `impersonatedBy` is treated as "not a super-admin" for this endpoint.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireSuperAdmin()
    if (actor.impersonatedBy) {
      return NextResponse.json(
        { message: 'اخرج من انتحال الهوية الحالي أولاً' },
        { status: 409 }
      )
    }
    const { id } = await params
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: 'معرّف غير صالح' }, { status: 400 })
    }
    await dbConnect()

    const tenant = await Tenant.findById(id)
      .select('_id name slug status provisioningState')
      .lean<{
        _id: mongoose.Types.ObjectId
        name: string
        slug: string
        status: string
        provisioningState?: string
      } | null>()
    if (!tenant) return NextResponse.json({ message: 'المؤسسة غير موجودة' }, { status: 404 })
    if (tenant.provisioningState && tenant.provisioningState !== 'READY') {
      return NextResponse.json({ message: 'المؤسسة قيد الإعداد' }, { status: 409 })
    }
    if (tenant.status === TENANT_STATUS.SUSPENDED || tenant.status === TENANT_STATUS.CANCELLED) {
      return NextResponse.json({ message: 'المؤسسة معلّقة' }, { status: 409 })
    }

    const admin = await User.findOne({ tenantId: tenant._id, role: ROLES.ADMIN, isActive: true })
      .sort({ createdAt: 1 })
      .select('_id email fullName')
      .lean<{ _id: mongoose.Types.ObjectId; email: string; fullName: string } | null>()
    if (!admin) return NextResponse.json({ message: 'لا يوجد مدير نشط لهذه المؤسسة' }, { status: 404 })

    const grant = mintGrant({
      purpose: 'impersonate',
      targetUserId: admin._id.toString(),
      superAdminUserId: actor.id,
    })

    await logPlatformAudit({
      actorUserId: actor.id,
      actorEmail: actor.email || 'unknown',
      action: 'IMPERSONATION_STARTED',
      targetType: 'User',
      targetId: admin._id,
      tenantId: tenant._id,
      metadata: { adminEmail: admin.email, tenantSlug: tenant.slug },
      ip: getClientIp(request),
      userAgent: request.headers.get('user-agent') || undefined,
    })

    return NextResponse.json({
      grant,
      callbackUrl: '/admin/dashboard',
      admin: { fullName: admin.fullName, email: admin.email },
      tenant: { name: tenant.name, slug: tenant.slug },
    })
  } catch (e) {
    if (e instanceof TenantAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status })
    }
    console.error('impersonate error:', e)
    return NextResponse.json({ message: 'حدث خطأ' }, { status: 500 })
  }
}
