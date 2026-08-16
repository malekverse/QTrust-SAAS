import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import MessageLog from '@/models/MessageLog'
import { requireTenantSession, TenantAuthError } from '@/lib/tenant'
import { ROLES } from '@/lib/constants'

// GET /api/messaging/logs — recent outbound-message audit records (admin).
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireTenantSession()
    if (ctx.role !== ROLES.ADMIN) {
      return NextResponse.json({ message: 'غير مصرح' }, { status: 403 })
    }
    await dbConnect()
    const { searchParams } = new URL(request.url)
    const limit = Math.min(Number(searchParams.get('limit') || 30), 100)

    const logs = await MessageLog.find({ tenantId: ctx.tenantId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()

    return NextResponse.json(logs)
  } catch (e) {
    if (e instanceof TenantAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status })
    }
    console.error('Message logs error:', e)
    return NextResponse.json({ message: 'حدث خطأ' }, { status: 500 })
  }
}
