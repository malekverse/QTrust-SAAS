import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import dbConnect from '@/lib/db'
import Lead, { LEAD_STATUS } from '@/models/Lead'
import { requireSuperAdmin, TenantAuthError } from '@/lib/tenant'
import { leadLimiter, enforceRateLimit, getClientIp } from '@/lib/rate-limit'
import { parsePagination, buildPaginatedResponse } from '@/lib/pagination'

void Lead

const leadSchema = z.object({
  name: z.string().min(2, 'الاسم مطلوب').max(120),
  associationName: z.string().min(2, 'اسم الجمعية مطلوب').max(200),
  city: z.string().max(120).optional().or(z.literal('')),
  phone: z.string().min(8, 'رقم الهاتف مطلوب').max(30),
  email: z.string().email('البريد الإلكتروني غير صالح').max(200).optional().or(z.literal('')),
  // Either a STUDENT_RANGES key ("LT_50") or, for backward compatibility with
  // pre-2026-08 clients that had a stale bundle, a legacy free-text label.
  studentCount: z.string().max(30).optional().or(z.literal('')),
  message: z.string().max(2000).optional().or(z.literal('')),
  locale: z.string().max(5).optional(),
  // Honeypot — a hidden field real users never see or fill. Bots often do.
  company: z.string().optional(),
})

// POST /api/leads — public demo-request form submission.
export async function POST(request: NextRequest) {
  try {
    const limited = await enforceRateLimit(leadLimiter, `lead:${getClientIp(request)}`)
    if (limited) return limited

    const parsed = leadSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ message: parsed.error.issues[0].message }, { status: 400 })
    }
    const d = parsed.data

    // Honeypot tripped: answer success (so the bot learns nothing) but save nothing.
    if (d.company && d.company.trim() !== '') {
      return NextResponse.json({ ok: true }, { status: 201 })
    }

    await dbConnect()
    await Lead.create({
      name: d.name,
      associationName: d.associationName,
      city: d.city || undefined,
      phone: d.phone,
      email: d.email || undefined,
      studentCount: d.studentCount || undefined,
      message: d.message || undefined,
      locale: d.locale || 'ar',
    })

    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (e) {
    console.error('Lead submit error:', e)
    return NextResponse.json({ message: 'حدث خطأ. حاول مرة أخرى.' }, { status: 500 })
  }
}

// GET /api/leads?status=&search=&page=&limit= — super-admin only.
// Paginated + filterable list, backing the /super-admin/leads page.
export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin()
    await dbConnect()

    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const search = url.searchParams.get('search')?.trim()
    const pg = parsePagination(request, { limit: 25 })

    const filter: Record<string, unknown> = {}
    if (status && (Object.values(LEAD_STATUS) as string[]).includes(status)) {
      filter.status = status
    }
    if (search) {
      // Escape regex metacharacters; substring, case-insensitive.
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const rx = new RegExp(escaped, 'i')
      filter.$or = [
        { name: rx },
        { associationName: rx },
        { phone: rx },
        { email: rx },
        { city: rx },
      ]
    }

    const [rows, total] = await Promise.all([
      Lead.find(filter).sort({ createdAt: -1 }).skip(pg.skip).limit(pg.limit).lean(),
      Lead.countDocuments(filter),
    ])

    return NextResponse.json(buildPaginatedResponse(rows, total, pg))
  } catch (e) {
    if (e instanceof TenantAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status })
    }
    console.error('List leads error:', e)
    return NextResponse.json({ message: 'حدث خطأ' }, { status: 500 })
  }
}
