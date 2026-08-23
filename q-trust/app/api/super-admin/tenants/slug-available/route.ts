import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import { requireSuperAdmin, TenantAuthError } from '@/lib/tenant'
import Tenant from '@/models/Tenant'

void Tenant

// GET /api/super-admin/tenants/slug-available?slug=... — live availability
// check for the /super-admin/tenants/new form. Returns whether the slug is
// syntactically valid AND unclaimed. Does NOT auto-suffix — the operator sees
// the conflict and chooses.
export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin()
    const url = new URL(request.url)
    const raw = url.searchParams.get('slug')?.trim() || ''
    const slug = raw.toLowerCase()

    if (slug.length < 2) {
      return NextResponse.json({ available: false, reason: 'too_short' })
    }
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json({ available: false, reason: 'invalid_chars' })
    }

    await dbConnect()
    const existing = await Tenant.findOne({ slug })
      .select('_id name provisioningState')
      .lean<{ _id: unknown; name: string; provisioningState?: string } | null>()

    if (!existing) {
      return NextResponse.json({ available: true, slug })
    }
    return NextResponse.json({
      available: false,
      reason: 'taken',
      conflictTenant: {
        _id: String(existing._id),
        name: existing.name,
        provisioningState: existing.provisioningState ?? 'READY',
      },
    })
  } catch (e) {
    if (e instanceof TenantAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status })
    }
    console.error('slug-available error:', e)
    return NextResponse.json({ message: 'حدث خطأ' }, { status: 500 })
  }
}
