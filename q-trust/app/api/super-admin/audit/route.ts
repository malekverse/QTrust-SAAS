import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import dbConnect from '@/lib/db'
import { requireSuperAdmin, TenantAuthError } from '@/lib/tenant'
import PlatformAuditLog from '@/models/PlatformAuditLog'
import Tenant from '@/models/Tenant'
import { parsePagination, buildPaginatedResponse } from '@/lib/pagination'

void PlatformAuditLog
void Tenant

// GET /api/super-admin/audit
//   ?action=…&actor=…&tenantId=…&from=…&to=…&page=…&limit=…
//
// Paginated cross-tenant audit trail for the operator console. The list
// is intentionally not tenant-scoped — an action targeting tenant X and
// an action targeting tenant Y are both here.
export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin()
    await dbConnect()

    const url = new URL(request.url)
    const action = url.searchParams.get('action')
    const actor = url.searchParams.get('actor')
    const tenantId = url.searchParams.get('tenantId')
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')
    const pg = parsePagination(request, { limit: 50, maxLimit: 500 })

    const filter: Record<string, unknown> = {}
    if (action) filter.action = action
    if (actor) {
      const rx = new RegExp(actor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      filter.actorEmail = rx
    }
    if (tenantId && mongoose.Types.ObjectId.isValid(tenantId)) {
      filter.tenantId = new mongoose.Types.ObjectId(tenantId)
    }
    if (from || to) {
      const range: Record<string, Date> = {}
      if (from) range.$gte = new Date(from)
      if (to) range.$lte = new Date(to)
      filter.createdAt = range
    }

    const [rows, total] = await Promise.all([
      PlatformAuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(pg.skip)
        .limit(pg.limit)
        .lean(),
      PlatformAuditLog.countDocuments(filter),
    ])

    // Fold tenant names in one $in lookup rather than N per-row queries.
    const tids = Array.from(
      new Set(rows.map((r: any) => (r.tenantId ? String(r.tenantId) : null)).filter(Boolean))
    ) as string[]
    const tenants = tids.length
      ? await Tenant.find({
          _id: { $in: tids.map((id) => new mongoose.Types.ObjectId(id)) },
        })
          .select('_id name slug')
          .lean<{ _id: mongoose.Types.ObjectId; name: string; slug: string }[]>()
      : []
    const tenantMap = new Map(tenants.map((t) => [String(t._id), t]))
    const withTenant = rows.map((r: any) => ({
      ...r,
      tenant: r.tenantId ? tenantMap.get(String(r.tenantId)) ?? null : null,
    }))

    return NextResponse.json(buildPaginatedResponse(withTenant, total, pg))
  } catch (e) {
    if (e instanceof TenantAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status })
    }
    console.error('audit list error:', e)
    return NextResponse.json({ message: 'حدث خطأ' }, { status: 500 })
  }
}
