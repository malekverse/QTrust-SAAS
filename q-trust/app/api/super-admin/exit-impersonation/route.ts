import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import dbConnect from '@/lib/db'
import { auth } from '@/lib/auth'
import { logPlatformAudit } from '@/models/PlatformAuditLog'
import { mintGrant } from '@/lib/impersonation'
import { getClientIp } from '@/lib/rate-limit'
import User from '@/models/User'
import { ROLES } from '@/lib/constants'

void User

// POST /api/super-admin/exit-impersonation
//
// Called from the persistent impersonation banner. Reads the current
// session (which must be marked `impersonatedBy: <superAdminId>`), verifies
// the underlying super-admin still exists + is active, and returns a
// `restore` grant the client hands to signIn('impersonate', { grant }).
//
// The client (not this endpoint) drives the actual re-sign-in — that keeps
// the same server-side "mint grant → signIn" pattern used to start
// impersonation, so the two flows are symmetrical and don't require any
// bespoke cookie/handshake gymnastics inside NextAuth.
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ message: 'يجب تسجيل الدخول' }, { status: 401 })
    }
    const impersonatedBy = session.user.impersonatedBy
    if (!impersonatedBy) {
      return NextResponse.json(
        { message: 'لا توجد جلسة انتحال هوية نشطة' },
        { status: 400 }
      )
    }
    if (!mongoose.Types.ObjectId.isValid(impersonatedBy)) {
      return NextResponse.json({ message: 'معرّف غير صالح' }, { status: 400 })
    }

    await dbConnect()
    const superAdmin = await User.findById(impersonatedBy)
      .select('_id email fullName role isActive')
      .lean<{
        _id: mongoose.Types.ObjectId
        email: string
        fullName: string
        role: string
        isActive: boolean
      } | null>()
    if (!superAdmin || !superAdmin.isActive || superAdmin.role !== ROLES.SUPER_ADMIN) {
      return NextResponse.json({ message: 'حساب مدير المنصة غير متاح' }, { status: 403 })
    }

    const grant = mintGrant({
      purpose: 'restore',
      targetUserId: superAdmin._id.toString(),
      superAdminUserId: null,
    })

    await logPlatformAudit({
      actorUserId: superAdmin._id,
      actorEmail: superAdmin.email,
      action: 'IMPERSONATION_ENDED',
      targetType: 'User',
      targetId: session.user.id,
      tenantId: session.user.tenantId,
      metadata: { impersonatedEmail: session.user.email },
      ip: getClientIp(request),
      userAgent: request.headers.get('user-agent') || undefined,
    })

    return NextResponse.json({ grant, callbackUrl: '/super-admin/tenants' })
  } catch (e) {
    console.error('exit-impersonation error:', e)
    return NextResponse.json({ message: 'حدث خطأ' }, { status: 500 })
  }
}
