import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import Notification from '@/models/Notification'
import { requireTenantSession, TenantAuthError } from '@/lib/tenant'

// GET /api/notifications?limit=&offset= — recent notifications for the caller
// plus their unread count. Paginated per the plan's list-endpoint rule.
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireTenantSession()
    await dbConnect()

    const { searchParams } = new URL(request.url)
    const limit = Math.min(Number(searchParams.get('limit') || 20), 50)
    const offset = Math.max(Number(searchParams.get('offset') || 0), 0)

    const filter = { tenantId: ctx.tenantId, userId: ctx.userId }

    const [notifications, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(offset).limit(limit).lean(),
      Notification.countDocuments({ ...filter, read: false }),
    ])

    return NextResponse.json({ notifications, unreadCount })
  } catch (e) {
    if (e instanceof TenantAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status })
    }
    console.error('Notifications list error:', e)
    return NextResponse.json({ message: 'حدث خطأ' }, { status: 500 })
  }
}

// POST /api/notifications/read — mark one ({ id }) or all ({ all: true }) read.
export async function POST(request: NextRequest) {
  try {
    const ctx = await requireTenantSession()
    await dbConnect()

    const body = await request.json().catch(() => ({}))
    const scope = { tenantId: ctx.tenantId, userId: ctx.userId }

    if (body.all === true) {
      await Notification.updateMany({ ...scope, read: false }, { $set: { read: true } })
    } else if (body.id) {
      await Notification.updateOne({ ...scope, _id: body.id }, { $set: { read: true } })
    } else {
      return NextResponse.json({ message: 'حدد الإشعار أو all' }, { status: 400 })
    }

    const unreadCount = await Notification.countDocuments({ ...scope, read: false })
    return NextResponse.json({ ok: true, unreadCount })
  } catch (e) {
    if (e instanceof TenantAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status })
    }
    console.error('Notifications read error:', e)
    return NextResponse.json({ message: 'حدث خطأ' }, { status: 500 })
  }
}
