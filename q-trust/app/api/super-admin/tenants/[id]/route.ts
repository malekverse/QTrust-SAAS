import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { z } from 'zod'
import dbConnect from '@/lib/db'
import { requireSuperAdmin, TenantAuthError } from '@/lib/tenant'
import { clearTenantStatusCache } from '@/lib/tenant-status'
import Tenant from '@/models/Tenant'
import { PLANS, PLAN_LIMITS, TENANT_STATUS } from '@/lib/constants'

void Tenant

const patchSchema = z
  .object({
    plan: z.enum([PLANS.STARTER, PLANS.STANDARD, PLANS.PREMIUM]).optional(),
    status: z
      .enum([
        TENANT_STATUS.TRIAL,
        TENANT_STATUS.ACTIVE,
        TENANT_STATUS.PAST_DUE,
        TENANT_STATUS.SUSPENDED,
        TENANT_STATUS.CANCELLED,
      ])
      .optional(),
  })
  .refine((d) => d.plan !== undefined || d.status !== undefined, {
    message: 'لا توجد تغييرات',
  })

// PATCH /api/super-admin/tenants/[id] — change plan and/or status.
// Changing the plan re-applies that plan's entitlement limits.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperAdmin()
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
    const tenant = await Tenant.findById(id)
    if (!tenant) {
      return NextResponse.json({ message: 'المؤسسة غير موجودة' }, { status: 404 })
    }

    if (d.plan && d.plan !== tenant.plan) {
      const limits = PLAN_LIMITS[d.plan]
      tenant.plan = d.plan
      tenant.maxStudents = limits.maxStudents
      tenant.aiQuotaMonthly = limits.aiQuotaMonthly
    }
    if (d.status) {
      tenant.status = d.status
    }
    await tenant.save()

    // Reflect the change immediately in the per-instance status cache.
    clearTenantStatusCache(id)

    return NextResponse.json({
      _id: tenant._id,
      plan: tenant.plan,
      status: tenant.status,
      maxStudents: tenant.maxStudents,
      aiQuotaMonthly: tenant.aiQuotaMonthly,
    })
  } catch (e) {
    if (e instanceof TenantAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status })
    }
    console.error('Update tenant error:', e)
    return NextResponse.json({ message: 'حدث خطأ أثناء تحديث المؤسسة' }, { status: 500 })
  }
}
