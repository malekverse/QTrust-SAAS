import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { z } from 'zod'
import dbConnect from '@/lib/db'
import { requireSuperAdmin, TenantAuthError } from '@/lib/tenant'
import Invoice from '@/models/Invoice'
import Tenant from '@/models/Tenant'
import { INVOICE_TYPES, INVOICE_STATUS } from '@/lib/constants'
import { parsePagination, buildPaginatedResponse } from '@/lib/pagination'
import { logPlatformAudit } from '@/models/PlatformAuditLog'
import { getClientIp } from '@/lib/rate-limit'
import { generateInvoiceNumber } from '@/lib/invoice-numbering'

void Invoice
void Tenant

// GET /api/super-admin/invoices?status=&search=&from=&to=&page=&limit=
// Cross-tenant listing for the billing page.
export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin()
    await dbConnect()

    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')
    const search = url.searchParams.get('search')?.trim()
    const pg = parsePagination(request, { limit: 50, maxLimit: 500 })

    const filter: Record<string, unknown> = {}
    if (status && (Object.values(INVOICE_STATUS) as string[]).includes(status)) {
      filter.status = status
    }
    if (from || to) {
      const range: Record<string, Date> = {}
      if (from) range.$gte = new Date(from)
      if (to) range.$lte = new Date(to)
      filter.dueDate = range
    }
    if (search) {
      const esc = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const rx = new RegExp(esc, 'i')
      filter.$or = [{ invoiceNumber: rx }, { referenceNumber: rx }]
    }

    const [rows, total] = await Promise.all([
      Invoice.find(filter)
        .sort({ dueDate: -1, createdAt: -1 })
        .skip(pg.skip)
        .limit(pg.limit)
        .lean(),
      Invoice.countDocuments(filter),
    ])

    // Fold tenant names via one aggregation instead of N per-row lookups.
    const tenantIds = Array.from(new Set(rows.map((r: any) => String(r.tenantId))))
    const tenants = await Tenant.find({
      _id: { $in: tenantIds.map((id) => new mongoose.Types.ObjectId(id)) },
    })
      .select('_id name slug')
      .lean<{ _id: mongoose.Types.ObjectId; name: string; slug: string }[]>()
    const tenantMap = new Map(tenants.map((t) => [String(t._id), t]))
    const withTenant = rows.map((r: any) => ({
      ...r,
      tenant: tenantMap.get(String(r.tenantId)) ?? null,
    }))

    return NextResponse.json(buildPaginatedResponse(withTenant, total, pg))
  } catch (e) {
    if (e instanceof TenantAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status })
    }
    console.error('List invoices error:', e)
    return NextResponse.json({ message: 'حدث خطأ' }, { status: 500 })
  }
}

const createSchema = z.object({
  tenantId: z.string(),
  type: z.enum([INVOICE_TYPES.SETUP, INVOICE_TYPES.ANNUAL_RENEWAL, INVOICE_TYPES.ADDON]),
  amountTND: z.coerce.number().min(0).max(1_000_000),
  dueDate: z.string().datetime({ offset: true }).optional(),
  notes: z.string().max(1000).optional(),
  // Set when the invoice belongs to a specific billing period (used by the
  // renewal cron to keep the {tenantId,type,periodKey} unique index
  // active). Format: "YYYY-MM".
  periodKey: z.string().regex(/^\d{4}-\d{2}$/).optional(),
})

// POST /api/super-admin/invoices — create ad-hoc invoice. Stamps a
// QT-YYYY-#### number and returns 409 on periodKey collision (the cron's
// idempotency guard).
export async function POST(request: NextRequest) {
  try {
    const actor = await requireSuperAdmin()
    const parsed = createSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ message: parsed.error.issues[0].message }, { status: 400 })
    }
    const d = parsed.data
    if (!mongoose.Types.ObjectId.isValid(d.tenantId)) {
      return NextResponse.json({ message: 'معرّف مؤسسة غير صالح' }, { status: 400 })
    }
    await dbConnect()

    const tenant = await Tenant.findById(d.tenantId).select('_id name').lean<
      { _id: mongoose.Types.ObjectId; name: string } | null
    >()
    if (!tenant) return NextResponse.json({ message: 'المؤسسة غير موجودة' }, { status: 404 })

    const invoiceNumber = await generateInvoiceNumber()
    const dueDate = d.dueDate ? new Date(d.dueDate) : new Date()

    let invoice
    try {
      invoice = await Invoice.create({
        tenantId: tenant._id,
        type: d.type,
        amountTND: d.amountTND,
        status: INVOICE_STATUS.PENDING,
        dueDate,
        notes: d.notes,
        invoiceNumber,
        periodKey: d.periodKey,
        createdBy: new mongoose.Types.ObjectId(actor.id),
      })
    } catch (err: any) {
      if (err?.code === 11000) {
        // Almost always a periodKey collision — someone (or the cron)
        // already created this period's renewal.
        return NextResponse.json(
          { message: 'توجد فاتورة مسبقاً لنفس الفترة' },
          { status: 409 }
        )
      }
      throw err
    }

    await logPlatformAudit({
      actorUserId: actor.id,
      actorEmail: actor.email || 'unknown',
      action: 'INVOICE_CREATED',
      targetType: 'Invoice',
      targetId: invoice._id,
      tenantId: tenant._id,
      metadata: {
        invoiceNumber,
        type: d.type,
        amountTND: d.amountTND,
        periodKey: d.periodKey,
      },
      ip: getClientIp(request),
      userAgent: request.headers.get('user-agent') || undefined,
    })

    return NextResponse.json(invoice, { status: 201 })
  } catch (e) {
    if (e instanceof TenantAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status })
    }
    console.error('Create invoice error:', e)
    return NextResponse.json({ message: 'حدث خطأ' }, { status: 500 })
  }
}
