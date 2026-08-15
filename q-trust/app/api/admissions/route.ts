import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import dbConnect from '@/lib/db'
import AdmissionApplication from '@/models/AdmissionApplication'
import { requireTenantSession, TenantAuthError } from '@/lib/tenant'
import { ROLES, ADMISSION_STATUS } from '@/lib/constants'

// GET /api/admissions?status=PENDING — list applications for the tenant.
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireTenantSession()
    if (ctx.role !== ROLES.ADMIN) {
      return NextResponse.json({ message: 'غير مصرح' }, { status: 403 })
    }

    await dbConnect()

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    const filter: Record<string, unknown> = { tenantId: ctx.tenantId }
    if (status && Object.values(ADMISSION_STATUS).includes(status as never)) {
      filter.status = status
    }

    const applications = await AdmissionApplication.find(filter)
      .sort({ createdAt: -1 })
      .limit(500)
      .lean()

    const counts = await AdmissionApplication.aggregate([
      { $match: { tenantId: mongoose.Types.ObjectId.createFromHexString(ctx.tenantId) } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ])
    const stats: Record<string, number> = {}
    for (const c of counts) stats[c._id] = c.count

    return NextResponse.json({ applications, stats })
  } catch (e) {
    if (e instanceof TenantAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status })
    }
    console.error('Admissions list error:', e)
    return NextResponse.json({ message: 'حدث خطأ' }, { status: 500 })
  }
}
