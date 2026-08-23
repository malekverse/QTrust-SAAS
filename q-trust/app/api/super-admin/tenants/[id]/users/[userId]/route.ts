import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { z } from 'zod'
import dbConnect from '@/lib/db'
import { requireSuperAdmin, TenantAuthError } from '@/lib/tenant'
import Tenant from '@/models/Tenant'
import User from '@/models/User'
import { logPlatformAudit } from '@/models/PlatformAuditLog'
import { getClientIp } from '@/lib/rate-limit'
import { ROLES } from '@/lib/constants'

void Tenant
void User

const patchSchema = z.object({
  isActive: z.boolean().optional(),
})

// PATCH /api/super-admin/tenants/[id]/users/[userId]
// Deactivate/reactivate a tenant user. Refuses to deactivate the last
// active ADMIN — a tenant without an admin becomes an unrecoverable
// support ticket.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const actor = await requireSuperAdmin()
    const { id, userId } = await params
    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(userId)) {
      return NextResponse.json({ message: 'معرّف غير صالح' }, { status: 400 })
    }
    const parsed = patchSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ message: parsed.error.issues[0].message }, { status: 400 })
    }
    const d = parsed.data

    await dbConnect()
    const tenantId = new mongoose.Types.ObjectId(id)
    const target = await User.findOne({ _id: userId, tenantId })
    if (!target) return NextResponse.json({ message: 'المستخدم غير موجود' }, { status: 404 })

    // Guard: refuse to deactivate the last active ADMIN.
    if (d.isActive === false && target.role === ROLES.ADMIN && target.isActive) {
      const activeAdmins = await User.countDocuments({
        tenantId,
        role: ROLES.ADMIN,
        isActive: true,
      })
      if (activeAdmins <= 1) {
        return NextResponse.json(
          { message: 'لا يمكن تعطيل آخر مدير نشط لهذه المؤسسة' },
          { status: 409 }
        )
      }
    }

    if (d.isActive !== undefined) target.isActive = d.isActive
    await target.save()

    await logPlatformAudit({
      actorUserId: actor.id,
      actorEmail: actor.email || 'unknown',
      action: 'TENANT_UPDATED',
      targetType: 'User',
      targetId: target._id,
      tenantId,
      metadata: { targetEmail: target.email, isActive: target.isActive },
      ip: getClientIp(request),
      userAgent: request.headers.get('user-agent') || undefined,
    })

    return NextResponse.json({
      _id: target._id,
      isActive: target.isActive,
      role: target.role,
    })
  } catch (e) {
    if (e instanceof TenantAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status })
    }
    console.error('patch tenant user error:', e)
    return NextResponse.json({ message: 'حدث خطأ' }, { status: 500 })
  }
}
