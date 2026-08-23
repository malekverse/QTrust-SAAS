import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { z } from 'zod'
import dbConnect from '@/lib/db'
import { requireSuperAdmin, TenantAuthError } from '@/lib/tenant'
import User from '@/models/User'
import { ROLES } from '@/lib/constants'
import { logPlatformAudit } from '@/models/PlatformAuditLog'
import { getClientIp } from '@/lib/rate-limit'

void User

const patchSchema = z.object({
  isActive: z.boolean().optional(),
})

// PATCH /api/super-admin/operators/[id] — activate/deactivate a
// SUPER_ADMIN. Refuses to deactivate the last active operator (a
// platform without an operator is a lost-key event).
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireSuperAdmin()
    const { id } = await params
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: 'معرّف غير صالح' }, { status: 400 })
    }
    const parsed = patchSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ message: parsed.error.issues[0].message }, { status: 400 })
    }
    const d = parsed.data

    await dbConnect()
    const target = await User.findOne({ _id: id, role: ROLES.SUPER_ADMIN })
    if (!target) {
      return NextResponse.json({ message: 'مدير المنصة غير موجود' }, { status: 404 })
    }

    // Refuse to deactivate the last active operator.
    if (d.isActive === false && target.isActive) {
      const activeCount = await User.countDocuments({
        role: ROLES.SUPER_ADMIN,
        isActive: true,
      })
      if (activeCount <= 1) {
        return NextResponse.json(
          { message: 'لا يمكن تعطيل آخر مدير منصة نشط' },
          { status: 409 }
        )
      }
    }
    // And refuse a self-deactivation — nobody accidentally locks
    // themselves out of the console.
    if (d.isActive === false && String(target._id) === String(actor.id)) {
      return NextResponse.json(
        { message: 'لا يمكنك تعطيل حسابك من هنا' },
        { status: 409 }
      )
    }

    if (d.isActive !== undefined) target.isActive = d.isActive
    await target.save()

    await logPlatformAudit({
      actorUserId: actor.id,
      actorEmail: actor.email || 'unknown',
      action: 'TENANT_UPDATED', // no dedicated OPERATOR action yet; reuse
      targetType: 'User',
      targetId: target._id,
      metadata: { targetEmail: target.email, isActive: target.isActive, kind: 'operator' },
      ip: getClientIp(request),
      userAgent: request.headers.get('user-agent') || undefined,
    })

    return NextResponse.json({
      _id: target._id,
      isActive: target.isActive,
    })
  } catch (e) {
    if (e instanceof TenantAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status })
    }
    console.error('operator patch error:', e)
    return NextResponse.json({ message: 'حدث خطأ' }, { status: 500 })
  }
}
