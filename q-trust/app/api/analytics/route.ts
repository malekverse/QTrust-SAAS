import { NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import { requireTenantSession, TenantAuthError } from '@/lib/tenant'
import { computeAnalytics } from '@/lib/analytics'
import { ROLES } from '@/lib/constants'

export async function GET() {
  try {
    const ctx = await requireTenantSession()
    if (ctx.role !== ROLES.ADMIN) {
      return NextResponse.json({ message: 'غير مصرح' }, { status: 403 })
    }

    await dbConnect()
    const data = await computeAnalytics(ctx.tenantId)
    return NextResponse.json(data)
  } catch (e) {
    if (e instanceof TenantAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status })
    }
    console.error('Analytics error:', e)
    return NextResponse.json({ message: 'حدث خطأ' }, { status: 500 })
  }
}
