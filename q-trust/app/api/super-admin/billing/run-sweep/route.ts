import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin, TenantAuthError } from '@/lib/tenant'

// POST /api/super-admin/billing/run-sweep
//
// Operator-triggered wrapper around the cron endpoint. Forwards to
// /api/cron/billing with the CRON_SECRET so the cron's idempotent
// operations run on-demand. Never exposes the secret to the client.
export async function POST(request: NextRequest) {
  try {
    await requireSuperAdmin()
    const secret = process.env.CRON_SECRET
    if (!secret) {
      return NextResponse.json(
        { message: 'CRON_SECRET غير مُعد. لا يمكن تشغيل الفوترة الآلية يدوياً.' },
        { status: 503 }
      )
    }
    const origin = new URL(request.url).origin
    const res = await fetch(`${origin}/api/cron/billing`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}` },
    })
    const body = await res.json()
    return NextResponse.json(body, { status: res.status })
  } catch (e) {
    if (e instanceof TenantAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status })
    }
    console.error('run-sweep error:', e)
    return NextResponse.json({ message: 'حدث خطأ' }, { status: 500 })
  }
}
